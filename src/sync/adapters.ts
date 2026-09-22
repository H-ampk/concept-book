import { getSyncStrategy } from "./entityConfig";
import {
  PRIVATE_SYNC_INITIAL_VERSION,
  PRIVATE_SYNC_SCHEMA_VERSION,
  type PrivateSyncEntityRecord,
  type PrivateSyncRecord,
  type SyncDomainDataByType,
  type SyncEntityType,
  type SyncMetadata,
  type ToPrivateSyncRecordInput
} from "./types";

const requireNonEmpty = (value: string, label: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${label} は必須です`);
  }
  return trimmed;
};

const resolveRecordId = <TType extends SyncEntityType>(
  entityType: TType,
  data: SyncDomainDataByType[TType],
  explicitId?: string
): string => {
  if (explicitId?.trim()) {
    return explicitId.trim();
  }
  if (entityType === "setting") {
    return (data as SyncDomainDataByType["setting"]).key;
  }
  return requireNonEmpty((data as { id: string }).id, "id");
};

const resolveUpdatedAt = <TType extends SyncEntityType>(
  entityType: TType,
  data: SyncDomainDataByType[TType],
  explicit?: string
): string => {
  if (explicit?.trim()) {
    return explicit.trim();
  }
  if (entityType === "quizAttemptLog") {
    return (data as SyncDomainDataByType["quizAttemptLog"]).answeredAt;
  }
  if (entityType === "setting") {
    throw new Error("setting の Private Sync Record には updatedAt が必要です");
  }
  return requireNonEmpty((data as { updatedAt: string }).updatedAt, "updatedAt");
};

const buildMetadata = (input: {
  ownerUserId: string;
  version: number;
  updatedAt: string;
  deletedAt?: string;
  deviceId?: string;
}): SyncMetadata => {
  const metadata: SyncMetadata = {
    ownerUserId: requireNonEmpty(input.ownerUserId, "ownerUserId"),
    version: input.version,
    updatedAt: requireNonEmpty(input.updatedAt, "updatedAt")
  };
  if (input.deletedAt?.trim()) {
    metadata.deletedAt = input.deletedAt.trim();
  }
  if (input.deviceId?.trim()) {
    metadata.deviceId = input.deviceId.trim();
  }
  return metadata;
};

export const toPrivateSyncRecord = <TType extends SyncEntityType>(
  input: ToPrivateSyncRecordInput<TType>
): PrivateSyncEntityRecord<TType> => {
  const version = input.version ?? PRIVATE_SYNC_INITIAL_VERSION;
  if (!Number.isInteger(version) || version < 1) {
    throw new Error("version は 1 以上の整数である必要があります");
  }
  const record = {
    schemaVersion: PRIVATE_SYNC_SCHEMA_VERSION,
    id: resolveRecordId(input.entityType, input.data, input.id),
    entityType: input.entityType,
    strategy: getSyncStrategy(input.entityType),
    metadata: buildMetadata({
      ownerUserId: input.ownerUserId,
      version,
      updatedAt: resolveUpdatedAt(input.entityType, input.data, input.updatedAt),
      deletedAt: input.deletedAt,
      deviceId: input.deviceId
    }),
    data: input.data
  };
  return record as PrivateSyncEntityRecord<TType>;
};

export const toConceptSyncRecord = (
  input: Omit<ToPrivateSyncRecordInput<"concept">, "entityType">
): PrivateSyncEntityRecord<"concept"> => toPrivateSyncRecord({ ...input, entityType: "concept" });

export const toContextCardSyncRecord = (
  input: Omit<ToPrivateSyncRecordInput<"contextCard">, "entityType">
): PrivateSyncEntityRecord<"contextCard"> =>
  toPrivateSyncRecord({ ...input, entityType: "contextCard" });

export const toQuizQuestionSyncRecord = (
  input: Omit<ToPrivateSyncRecordInput<"quizQuestion">, "entityType">
): PrivateSyncEntityRecord<"quizQuestion"> =>
  toPrivateSyncRecord({ ...input, entityType: "quizQuestion" });

export const toQuizDeckSyncRecord = (
  input: Omit<ToPrivateSyncRecordInput<"quizDeck">, "entityType">
): PrivateSyncEntityRecord<"quizDeck"> => toPrivateSyncRecord({ ...input, entityType: "quizDeck" });

export const toQuizAttemptLogSyncRecord = (
  input: Omit<ToPrivateSyncRecordInput<"quizAttemptLog">, "entityType">
): PrivateSyncEntityRecord<"quizAttemptLog"> =>
  toPrivateSyncRecord({ ...input, entityType: "quizAttemptLog" });

export const toResearchReportSyncRecord = (
  input: Omit<ToPrivateSyncRecordInput<"researchReport">, "entityType">
): PrivateSyncEntityRecord<"researchReport"> =>
  toPrivateSyncRecord({ ...input, entityType: "researchReport" });

export const toLearningMaterialSyncRecord = (
  input: Omit<ToPrivateSyncRecordInput<"learningMaterial">, "entityType">
): PrivateSyncEntityRecord<"learningMaterial"> =>
  toPrivateSyncRecord({ ...input, entityType: "learningMaterial" });

export const toConceptSourceAnchorSyncRecord = (
  input: Omit<ToPrivateSyncRecordInput<"conceptSourceAnchor">, "entityType">
): PrivateSyncEntityRecord<"conceptSourceAnchor"> =>
  toPrivateSyncRecord({ ...input, entityType: "conceptSourceAnchor" });

export const toSettingSyncRecord = (
  input: Omit<ToPrivateSyncRecordInput<"setting">, "entityType">
): PrivateSyncEntityRecord<"setting"> => toPrivateSyncRecord({ ...input, entityType: "setting" });

export const toMediaMetadataSyncRecord = (
  input: Omit<ToPrivateSyncRecordInput<"media">, "entityType">
): PrivateSyncEntityRecord<"media"> => toPrivateSyncRecord({ ...input, entityType: "media" });

export const asPrivateSyncRecord = (record: PrivateSyncRecord): PrivateSyncRecord => record;
