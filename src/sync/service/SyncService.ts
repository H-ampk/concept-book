import { parsePrivateSyncRecords } from "../validation";
import { SyncQueueProcessor } from "../queue/processor";
import type { SyncQueueRepository } from "../queue/repository";
import type { PrivateSyncCloudPort, SyncCursor, SyncPullFailure } from "../queue/types";
import type { SyncQueueStatus } from "../queue/types";
import type {
  LocalPrivateSyncPort,
  PullDeferReason,
  PullRunReport,
  PullRunResult,
  SyncRunResult,
  SyncRuntimeState,
  SyncStateRepository,
  SyncStatus
} from "./types";

const BLOCKING_QUEUE_STATUSES: ReadonlySet<SyncQueueStatus> = new Set([
  "pending",
  "processing",
  "failed",
  "blocked"
]);

const DEFAULT_MAX_PAGES = 20;

export type PrivateSyncServiceDeps = {
  cloud: PrivateSyncCloudPort;
  local: LocalPrivateSyncPort;
  queue: SyncQueueRepository;
  state: SyncStateRepository;
  getCurrentUser: () => Promise<{ id: string } | null>;
  /** 省略時は同じ cloud / queue / getCurrentUser で Processor を作る。retry は再実装しない。 */
  processor?: SyncQueueProcessor;
  now?: () => number;
  /** navigator.onLine の代替。false のとき Cloud へ出ない。成功判定には使わない。 */
  isOnline?: () => boolean;
  maxPages?: number;
};

const emptyReport = (): PullRunReport => ({
  received: 0,
  applied: 0,
  rejected: 0,
  deferred: 0,
  rejectedRecords: [],
  deferredRecords: [],
  partial: false,
  cursorCommitted: false
});

const skippedPull = (reason: "unauthenticated" | "offline"): PullRunResult => ({
  outcome: "skipped",
  reason,
  report: emptyReport()
});

const localApplyFailure = (): SyncPullFailure => ({
  kind: "unknown",
  code: "local_apply_failed",
  message: "local apply failed"
});

const stalledCursorFailure = (): SyncPullFailure => ({
  kind: "unknown",
  code: "cursor_stalled",
  message: "pull pagination did not advance the cursor"
});

const pageLimitFailure = (): SyncPullFailure => ({
  kind: "unknown",
  code: "page_limit",
  message: "pull exceeded the page limit"
});

const cloudThrewFailure = (): SyncPullFailure => ({
  kind: "unknown",
  code: "cloud_port_threw",
  message: "cloud port threw a non-structured error"
});

/**
 * Provider 非依存の Private Sync orchestration。
 * React には依存しない。認可は Cloud Adapter / RLS（#82）の責務。
 * owner 比較は誤データの local 適用を止める defense in depth であり、サーバー認可ではない。
 */
export class PrivateSyncService {
  private inflight: Promise<SyncRunResult> | null = null;
  private status: SyncStatus = "idle";
  private readonly processor: SyncQueueProcessor;

  constructor(private readonly deps: PrivateSyncServiceDeps) {
    this.processor =
      deps.processor ??
      new SyncQueueProcessor({
        queue: deps.queue,
        cloud: deps.cloud,
        getCurrentUser: deps.getCurrentUser,
        now: deps.now
      });
  }

  getState(): SyncRuntimeState {
    return { status: this.status };
  }

  /** pull のあと、未送信 queue を既存 Processor で push する。同時呼び出しは同じ run を共有する。 */
  sync(): Promise<SyncRunResult> {
    if (this.inflight) {
      return this.inflight;
    }
    const run = this.runSync().finally(() => {
      this.inflight = null;
    });
    this.inflight = run;
    return run;
  }

  async pull(): Promise<PullRunResult> {
    if (this.inflight) {
      return (await this.inflight).pull;
    }
    const run = this.runPullOnly().finally(() => {
      this.inflight = null;
    });
    this.inflight = run;
    return (await run).pull;
  }

  private async runPullOnly(): Promise<SyncRunResult> {
    this.status = "syncing";
    const prepared = await this.preparePull();
    if (prepared.outcome !== "ready") {
      return prepared.result;
    }
    const pull = await this.pullPages(prepared.ownerUserId);
    if (pull.outcome !== "completed") {
      this.status = "error";
      return { status: "error", pull, push: null };
    }
    await this.markSuccessful(prepared.ownerUserId);
    this.status = "idle";
    return { status: "idle", pull, push: null };
  }

  private async runSync(): Promise<SyncRunResult> {
    this.status = "syncing";
    const prepared = await this.preparePull();
    if (prepared.outcome !== "ready") {
      return prepared.result;
    }

    const pull = await this.pullPages(prepared.ownerUserId);
    if (pull.outcome !== "completed") {
      this.status = "error";
      return { status: "error", pull, push: null };
    }

    const push = await this.processor.processQueue();
    await this.markSuccessful(prepared.ownerUserId);
    this.status = "idle";
    return { status: "idle", pull, push };
  }

  private async preparePull(): Promise<
    | { outcome: "ready"; ownerUserId: string }
    | { outcome: "stopped"; result: SyncRunResult }
  > {
    const user = await this.deps.getCurrentUser();
    if (!user?.id) {
      this.status = "idle";
      return { outcome: "stopped", result: { status: "idle", pull: skippedPull("unauthenticated"), push: null } };
    }
    if (this.deps.isOnline && !this.deps.isOnline()) {
      this.status = "offline";
      return { outcome: "stopped", result: { status: "offline", pull: skippedPull("offline"), push: null } };
    }
    return { outcome: "ready", ownerUserId: user.id };
  }

  private async markSuccessful(ownerUserId: string): Promise<void> {
    const completedAt = new Date(this.deps.now?.() ?? Date.now()).toISOString();
    await this.deps.state.setLastSuccessfulSyncAt(ownerUserId, completedAt);
  }

  private async pullPages(ownerUserId: string): Promise<PullRunResult> {
    const report = emptyReport();
    const stored = await this.deps.state.getState(ownerUserId);
    let cursor: SyncCursor | null = stored.cursor;
    const maxPages = this.deps.maxPages ?? DEFAULT_MAX_PAGES;

    for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
      const requested = cursor;
      let result;
      try {
        result = await this.deps.cloud.pullCurrentUserChanges(requested);
      } catch {
        report.failure = cloudThrewFailure();
        return { outcome: "failed", report };
      }
      if (!result.ok) {
        report.failure = result.failure;
        return { outcome: "failed", report };
      }

      const page = result.page;
      const stalled =
        page.hasMore &&
        (page.nextCursor == null || page.nextCursor.length === 0 || page.nextCursor === requested);
      if (stalled) {
        report.failure = stalledCursorFailure();
        return { outcome: "failed", report };
      }

      const records = Array.isArray(page.records) ? page.records : null;
      if (!records) {
        report.failure = {
          kind: "schema",
          code: "pull_records_not_array",
          message: "pull page records must be an array"
        };
        return { outcome: "failed", report };
      }

      const queueItems = await this.deps.queue.listByOwner(ownerUserId);
      const parsed = parsePrivateSyncRecords(records);
      for (const item of parsed) {
        report.received += 1;
        if (!item.ok) {
          report.rejected += 1;
          report.rejectedRecords.push({ code: item.error.code });
          continue;
        }
        const record = item.value;
        if (record.metadata.ownerUserId !== ownerUserId) {
          report.rejected += 1;
          report.rejectedRecords.push({
            code: "owner_mismatch",
            entityType: record.entityType,
            entityId: record.id
          });
          continue;
        }
        if (record.metadata.deletedAt) {
          report.deferred += 1;
          report.deferredRecords.push({
            reason: "tombstone",
            entityType: record.entityType,
            entityId: record.id
          });
          continue;
        }
        const blocking = queueItems.find(
          (queued) =>
            queued.entityType === record.entityType &&
            queued.entityId === record.id &&
            BLOCKING_QUEUE_STATUSES.has(queued.status)
        );
        if (blocking) {
          report.deferred += 1;
          report.deferredRecords.push({
            reason: blocking.status as PullDeferReason,
            entityType: record.entityType,
            entityId: record.id
          });
          continue;
        }
        try {
          await this.deps.local.applyRemoteRecord(record);
        } catch {
          report.partial = true;
          report.failure = localApplyFailure();
          return { outcome: "failed", report };
        }
        report.applied += 1;
      }

      if (typeof page.nextCursor === "string" && page.nextCursor.length > 0) {
        try {
          await this.deps.state.setCursor(ownerUserId, page.nextCursor);
        } catch {
          report.partial = report.applied > 0;
          report.failure = localApplyFailure();
          return { outcome: "failed", report };
        }
        report.cursorCommitted = true;
        cursor = page.nextCursor;
      }

      if (!page.hasMore) {
        return { outcome: "completed", report };
      }
    }

    report.failure = pageLimitFailure();
    return { outcome: "failed", report };
  }
};
