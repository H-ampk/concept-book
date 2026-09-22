import { getSyncStrategy, isSyncEntityType } from "./entityConfig";
import { isIsoTimestamp, parseDomainPayload } from "./domainPayloads";
import {
  PRIVATE_SYNC_SCHEMA_VERSION,
  type PrivateSyncRecord,
  type SyncMetadata,
  type SyncValidationError,
  type SyncValidationResult
} from "./types";

const fail = (code: string, message: string, path?: string): SyncValidationResult<never> => ({
  ok: false,
  error: { code, message, ...(path ? { path } : {}) }
});

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const parseMetadata = (raw: unknown): SyncValidationResult<SyncMetadata> => {
  const obj = asRecord(raw);
  if (!obj) {
    return fail("metadata_invalid", "metadata は object である必要があります", "metadata");
  }
  if (typeof obj.ownerUserId !== "string" || obj.ownerUserId.trim().length === 0) {
    return fail("owner_user_id_missing", "ownerUserId は必須です", "metadata.ownerUserId");
  }
  if (!Number.isInteger(obj.version) || (obj.version as number) < 1) {
    return fail("version_invalid", "version は 1 以上の整数である必要があります", "metadata.version");
  }
  if (!isIsoTimestamp(obj.updatedAt)) {
    return fail("updated_at_invalid", "metadata.updatedAt が不正です", "metadata.updatedAt");
  }
  if (obj.deletedAt !== undefined && !isIsoTimestamp(obj.deletedAt)) {
    return fail("deleted_at_invalid", "metadata.deletedAt が不正です", "metadata.deletedAt");
  }
  if (obj.deviceId !== undefined && (typeof obj.deviceId !== "string" || obj.deviceId.trim().length === 0)) {
    return fail("device_id_invalid", "deviceId は空でない文字列である必要があります", "metadata.deviceId");
  }
  const metadata: SyncMetadata = {
    ownerUserId: obj.ownerUserId.trim(),
    version: obj.version as number,
    updatedAt: obj.updatedAt as string
  };
  if (typeof obj.deletedAt === "string") {
    metadata.deletedAt = obj.deletedAt;
  }
  if (typeof obj.deviceId === "string") {
    metadata.deviceId = obj.deviceId.trim();
  }
  return { ok: true, value: metadata };
};

/**
 * クラウド由来の unknown を PrivateSyncRecord へ変換する。
 * 失敗しても throw せず、レコード単位の Result を返す。
 */
export const parsePrivateSyncRecord = (raw: unknown): SyncValidationResult<PrivateSyncRecord> => {
  const obj = asRecord(raw);
  if (!obj) {
    return fail("not_object", "Private Sync Record は object である必要があります");
  }
  if (obj.schemaVersion !== PRIVATE_SYNC_SCHEMA_VERSION) {
    return fail(
      "schema_version_unsupported",
      `未対応の Private Sync schemaVersion です（expected ${PRIVATE_SYNC_SCHEMA_VERSION}）`,
      "schemaVersion"
    );
  }
  if (typeof obj.id !== "string" || obj.id.trim().length === 0) {
    return fail("id_missing", "id は必須です", "id");
  }
  if (!isSyncEntityType(obj.entityType)) {
    return fail("entity_type_invalid", "entityType が不正です", "entityType");
  }
  const expectedStrategy = getSyncStrategy(obj.entityType);
  if (obj.strategy !== expectedStrategy) {
    return fail(
      "strategy_mismatch",
      `strategy は ${expectedStrategy} である必要があります`,
      "strategy"
    );
  }
  const metadataResult = parseMetadata(obj.metadata);
  if (!metadataResult.ok) {
    return metadataResult;
  }
  const dataResult = parseDomainPayload(obj.entityType, obj.data);
  if (!dataResult.ok) {
    return fail("data_invalid", dataResult.message, "data");
  }

  return {
    ok: true,
    value: {
      schemaVersion: PRIVATE_SYNC_SCHEMA_VERSION,
      id: obj.id.trim(),
      entityType: obj.entityType,
      strategy: expectedStrategy,
      metadata: metadataResult.value,
      data: dataResult.value
    } as PrivateSyncRecord
  };
};

export const parsePrivateSyncRecords = (
  rawItems: unknown
): SyncValidationResult<PrivateSyncRecord>[] => {
  if (!Array.isArray(rawItems)) {
    return [fail("not_array", "Private Sync Record の配列である必要があります")];
  }
  return rawItems.map((item) => parsePrivateSyncRecord(item));
};

export const partitionPrivateSyncRecords = (
  rawItems: unknown
): { accepted: PrivateSyncRecord[]; rejected: SyncValidationError[] } => {
  const results = parsePrivateSyncRecords(rawItems);
  const accepted: PrivateSyncRecord[] = [];
  const rejected: SyncValidationError[] = [];
  for (const result of results) {
    if (result.ok) {
      accepted.push(result.value);
    } else {
      rejected.push(result.error);
    }
  }
  return { accepted, rejected };
};
