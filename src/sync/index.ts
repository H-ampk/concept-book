export {
  PRIVATE_SYNC_INITIAL_VERSION,
  PRIVATE_SYNC_SCHEMA_VERSION,
  SYNCABLE_SETTING_KEYS,
  SYNC_ENTITY_TYPES,
  type DomainColorSettingValue,
  type PrivateSyncEntityRecord,
  type PrivateSyncRecord,
  type SyncDomainDataByType,
  type SyncEntityType,
  type SyncMetadata,
  type SyncStrategy,
  type SyncValidationError,
  type SyncValidationResult,
  type SyncableMediaMetadata,
  type SyncableSettingKey,
  type SyncableSettingPayload,
  type ToPrivateSyncRecordInput
} from "./types";

export {
  LOCAL_ONLY_SETTING_KEYS,
  NEVER_SYNC_SETTING_KEYS,
  SYNC_STRATEGY_BY_ENTITY,
  getSettingSyncPolicy,
  getSyncStrategy,
  isSyncEntityType,
  isSyncableSettingKey
} from "./entityConfig";

export {
  asPrivateSyncRecord,
  toConceptSourceAnchorSyncRecord,
  toConceptSyncRecord,
  toContextCardSyncRecord,
  toLearningMaterialSyncRecord,
  toMediaMetadataSyncRecord,
  toPrivateSyncRecord,
  toQuizAttemptLogSyncRecord,
  toQuizDeckSyncRecord,
  toQuizQuestionSyncRecord,
  toResearchReportSyncRecord,
  toSettingSyncRecord
} from "./adapters";

export { parsePrivateSyncRecord, parsePrivateSyncRecords, partitionPrivateSyncRecords } from "./validation";

export {
  ENTITY_ID_PREFIXES,
  createEntityId,
  createRandomUuid,
  isPrefixedEntityId,
  type EntityIdPrefix
} from "./ids";

export {
  SYNC_PROCESSING_LEASE_MS,
  SYNC_QUEUE_BATCH_SIZE,
  SYNC_RETRY_MAX_DELAY_MS,
  computeBackoffDelayMs,
  computeNextAttemptAt,
  isProcessingLeaseStale
} from "./queue/backoff";
export { queueStatusForFailure, sanitizeSyncErrorMessage } from "./queue/failure";
export { createSyncQueueIntegration } from "./queue/integration";
export { SyncQueueProcessor, type ProcessQueueSkipReason } from "./queue/processor";
export { SyncQueueScheduler, createSyncQueueScheduler, MAX_TIMER_DELAY_MS } from "./queue/scheduler";
export {
  SyncQueueEnqueueError,
  createSyncQueueRepository,
  type EnqueueSyncQueueInput,
  type SyncQueueRepository
} from "./queue/repository";
export type {
  PrivateSyncCloudPort,
  PushCurrentUserResult,
  SyncPushFailure,
  SyncPushFailureKind,
  SyncQueueItem,
  SyncQueueOperation,
  SyncQueueStatus,
  SyncQueueSummary
} from "./queue/types";
