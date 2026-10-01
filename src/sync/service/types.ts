import type { PrivateSyncRecord, SyncEntityType } from "../types";
import type { SyncCursor, SyncPullFailure } from "../queue/types";
import type { ProcessQueueReport } from "../queue/processor";

/**
 * Sync Service が IndexedDB 実装へ直接依存しないための境界。
 * 全 Domain への実 apply は後続。今回は契約と fake で pull orchestration を固定する。
 */
export type LocalPrivateSyncPort = {
  applyRemoteRecord(record: PrivateSyncRecord): Promise<void>;
};

export type SyncOwnerState = {
  ownerUserId: string;
  cursor: SyncCursor | null;
  lastSuccessfulSyncAt: string | null;
};

/** owner ごとに cursor と成功時刻を分ける。User A の cursor を User B は使わない。 */
export type SyncStateRepository = {
  getState(ownerUserId: string): Promise<SyncOwnerState>;
  setCursor(ownerUserId: string, cursor: SyncCursor | null): Promise<void>;
  setLastSuccessfulSyncAt(ownerUserId: string, iso: string): Promise<void>;
};

export type SyncStatus = "idle" | "syncing" | "offline" | "error";

export type SyncRuntimeState = {
  status: SyncStatus;
};

/**
 * 同 entity の未送信 queue または tombstone。
 * conflict の自動解決（#73）はしない。適用を止めた印だけ。
 */
export type PullDeferReason = "pending" | "failed" | "processing" | "blocked" | "tombstone";

export type PullRejectedNote = {
  code: string;
  entityType?: SyncEntityType;
  entityId?: string;
};

export type PullDeferredNote = {
  reason: PullDeferReason;
  entityType: SyncEntityType;
  entityId: string;
};

export type PullRunReport = {
  received: number;
  applied: number;
  rejected: number;
  deferred: number;
  rejectedRecords: PullRejectedNote[];
  deferredRecords: PullDeferredNote[];
  /** Local apply が途中で失敗し、以降を止めた */
  partial: boolean;
  cursorCommitted: boolean;
  failure?: SyncPullFailure;
};

export type PullSkipReason = "unauthenticated" | "offline";

export type PullRunResult = {
  outcome: "completed" | "failed" | "skipped";
  reason?: PullSkipReason;
  report: PullRunReport;
};

export type SyncRunResult = {
  status: SyncStatus;
  pull: PullRunResult;
  /** pull が完了しなかったときは push しない */
  push: ProcessQueueReport | null;
};
