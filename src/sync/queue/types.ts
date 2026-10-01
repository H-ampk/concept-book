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

/**
 * Cloud Port の構造化失敗種別。push / pull で共有する。
 * 未認証は空の成功ではなく auth（または permission）failure。
 */
export type SyncCloudFailureKind =
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

export type SyncPushFailureKind = SyncCloudFailureKind;

/** Cloud Port が Processor に返す構造化失敗。raw exception の文字列解析には使わない。 */
export type SyncPushFailure = {
  kind: SyncPushFailureKind;
  code: string;
  message: string;
};

export type SyncPullFailure = {
  kind: SyncCloudFailureKind;
  code: string;
  message: string;
};

export type PushCurrentUserResult =
  | { ok: true }
  | { ok: false; failure: SyncPushFailure };

/**
 * Provider が決める差分同期トークン。ISO 時刻とは限らない。
 * null は初回 pull（cursor 未保存）。
 */
export type SyncCursor = string;

export type PullCurrentUserPage = {
  /** Cloud 応答は検証前の unknown。PrivateSyncRecord として信用しない。 */
  records: unknown[];
  nextCursor: SyncCursor | null;
  hasMore: boolean;
};

export type PullCurrentUserResult =
  | { ok: true; page: PullCurrentUserPage }
  | { ok: false; failure: SyncPullFailure };

/**
 * 認証済み session の現在ユーザーだけを対象にする。
 * userId 引数で対象アカウントを選ばせない（#82）。
 * identity は Adapter が session から取る。実 Supabase table は #82 まで作らない。
 */
export type PrivateSyncCloudPort = {
  pushCurrentUserChanges(changes: PrivateSyncRecord[]): Promise<PushCurrentUserResult>;
  pullCurrentUserChanges(cursor: SyncCursor | null): Promise<PullCurrentUserResult>;
};
