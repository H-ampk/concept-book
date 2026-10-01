import { parsePrivateSyncRecord } from "../validation";
import { isProcessingLeaseStale, SYNC_QUEUE_BATCH_SIZE, computeNextAttemptAt } from "./backoff";
import { toStoredFailure } from "./failure";
import type { SyncQueueRepository } from "./repository";
import type { PrivateSyncCloudPort, SyncQueueItem } from "./types";

export type SyncQueueUser = { id: string };

export type ProcessQueueReport = {
  ran: boolean;
  reason?: "unauthenticated";
  ownerUserId?: string;
  succeeded: string[];
  failed: string[];
  blocked: string[];
};

export type SyncQueueProcessorDeps = {
  queue: SyncQueueRepository;
  cloud: PrivateSyncCloudPort;
  getCurrentUser: () => Promise<SyncQueueUser | null>;
  now?: () => number;
  batchSize?: number;
};

const emptyReport = (extra: Partial<ProcessQueueReport> = {}): ProcessQueueReport => ({
  ran: false,
  succeeded: [],
  failed: [],
  blocked: [],
  ...extra
});

/**
 * UI から分離した Queue Processor。
 * current user 以外の item は送信も状態変更もしない。
 * owner 比較は誤送信防止であり、サーバー認可（#82）ではない。
 */
export class SyncQueueProcessor {
  private inflight: Promise<ProcessQueueReport> | null = null;

  constructor(private readonly deps: SyncQueueProcessorDeps) {}

  processQueue(): Promise<ProcessQueueReport> {
    if (this.inflight) {
      return this.inflight;
    }
    const run = this.run().finally(() => {
      this.inflight = null;
    });
    this.inflight = run;
    return run;
  }

  private async run(): Promise<ProcessQueueReport> {
    const user = await this.deps.getCurrentUser();
    if (!user?.id) {
      return emptyReport({ reason: "unauthenticated" });
    }
    const now = this.deps.now ?? (() => Date.now());
    const nowMs = now();
    const ownerUserId = user.id;
    await this.deps.queue.recoverStaleProcessing(ownerUserId, nowMs, (lastAttemptAt) =>
      isProcessingLeaseStale(lastAttemptAt, nowMs)
    );

    const processable = await this.deps.queue.listProcessable(ownerUserId, new Date(nowMs).toISOString());
    const batch = processable.slice(0, this.deps.batchSize ?? SYNC_QUEUE_BATCH_SIZE);
    const report = emptyReport({ ran: true, ownerUserId });

    for (const item of batch) {
      const outcome = await this.processOne(item, now);
      report[outcome].push(item.id);
    }
    return report;
  }

  private async processOne(
    item: SyncQueueItem,
    now: () => number
  ): Promise<"succeeded" | "failed" | "blocked"> {
    const attemptMs = now();
    const attemptIso = new Date(attemptMs).toISOString();
    const processing = await this.deps.queue.markProcessing(item.id, attemptIso);
    if (!processing) {
      return "blocked";
    }

    const parsed = parsePrivateSyncRecord(processing.snapshot);
    if (!parsed.ok || parsed.value.metadata.ownerUserId !== processing.ownerUserId) {
      await this.deps.queue.markBlocked(processing.id, {
        lastAttemptAt: attemptIso,
        retryCount: processing.retryCount,
        errorCode: parsed.ok ? "owner_mismatch" : parsed.error.code,
        lastError: parsed.ok
          ? "snapshot owner does not match queue owner"
          : parsed.error.message
      });
      return "blocked";
    }

    let result;
    try {
      result = await this.deps.cloud.pushCurrentUserChanges([parsed.value]);
    } catch {
      result = {
        ok: false as const,
        failure: {
          kind: "unknown" as const,
          code: "cloud_port_threw",
          message: "cloud port threw a non-structured error"
        }
      };
    }

    if (result.ok) {
      await this.deps.queue.markSucceeded(processing.id);
      return "succeeded";
    }

    const stored = toStoredFailure(result.failure);
    if (stored.status === "blocked") {
      await this.deps.queue.markBlocked(processing.id, {
        lastAttemptAt: attemptIso,
        retryCount: processing.retryCount + 1,
        errorCode: stored.errorCode,
        lastError: stored.lastError
      });
      return "blocked";
    }

    const retryCount = processing.retryCount + 1;
    const failedAt = now();
    await this.deps.queue.markFailed(processing.id, {
      retryCount,
      lastAttemptAt: new Date(failedAt).toISOString(),
      nextAttemptAt: computeNextAttemptAt(retryCount, failedAt),
      errorCode: stored.errorCode,
      lastError: stored.lastError
    });
    return "failed";
  }
};
