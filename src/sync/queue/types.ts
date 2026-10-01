import type { PrivateSyncRecord, SyncEntityType } from "../types";

export type SyncQueueStatus = "pending" | "processing" | "failed" | "blocked";

export type SyncQueueOperation = "upsert" | "delete";

/**
 * IndexedDB に永続化する同期要求。
 * ownerUserId はローカルキューの誤送信防止用であり、クラウド認可ではない。
 * snapshot は enqueue 時点の Private Sync Record。Domain 再読込はしない。
 */
export type SyncQueueItem = {
  id: string;
  ownerUserId: string;
  entityType: SyncEntityType;
  entityId: string;
  operation: SyncQueueOperation;
  status: SyncQueueStatus;
  createdAt: string;
  updatedAt: string;
  retryCount: number;
  lastAttemptAt?: string;
  nextAttemptAt?: string;
  errorCode?: string;
  lastError?: string;
  snapshot: PrivateSyncRecord;
};

export type SyncQueueSummary = {
  pending: number;
  processing: number;
  failed: number;
  blocked: number;
  total: number;
};

export type SyncPushFailureKind =
  | "network"
  | "timeout"
  | "rateLimit"
  | "server"
  | "auth"
  | "permission"
  | "validation"
  | "conflict"
  | "schema"
  | "unknown";

/** Cloud Port が Processor に返す構造化失敗。raw exception の文字列解析には使わない。 */
export type SyncPushFailure = {
  kind: SyncPushFailureKind;
  code: string;
  message: string;
};

export type PushCurrentUserResult =
  | { ok: true }
  | { ok: false; failure: SyncPushFailure };

/**
 * #71 の push 接続点。identity は Adapter 側の session から取る。
 * userId を引数にしない。pull と実 backend は #71 / #82。
 */
export type PrivateSyncCloudPort = {
  pushCurrentUserChanges(changes: PrivateSyncRecord[]): Promise<PushCurrentUserResult>;
};
