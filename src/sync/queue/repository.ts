import { getSyncStrategy } from "../entityConfig";
import { parsePrivateSyncRecord } from "../validation";
import type { PrivateSyncRecord, SyncEntityType } from "../types";
import {
  CONCEPT_BOOK_DB_NAME,
  SYNC_QUEUE_STORE_NAME,
  openConceptBookDatabase
} from "../../storage/indexeddb";
import type { SyncQueueItem, SyncQueueOperation, SyncQueueSummary } from "./types";

export class SyncQueueEnqueueError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "SyncQueueEnqueueError";
    this.code = code;
  }
}

export type EnqueueSyncQueueInput = {
  ownerUserId: string;
  operation: SyncQueueOperation;
  record: PrivateSyncRecord;
  now?: string;
};

const requestToPromise = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const withStore = async <T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => Promise<T>): Promise<T> => {
  const db = await openConceptBookDatabase();
  try {
    const tx = db.transaction(SYNC_QUEUE_STORE_NAME, mode);
    const store = tx.objectStore(SYNC_QUEUE_STORE_NAME);
    const completed = new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    const result = await run(store);
    await completed;
    return result;
  } finally {
    db.close();
  }
};

const createQueueId = (): string => {
  const uuid = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
  return `syncq_${uuid}`;
};

const sameEntity = (item: SyncQueueItem, ownerUserId: string, entityType: SyncEntityType, entityId: string): boolean =>
  item.ownerUserId === ownerUserId && item.entityType === entityType && item.entityId === entityId;

const isCoalescable = (item: SyncQueueItem): boolean => item.status === "pending" || item.status === "failed";

const applySnapshot = (
  item: SyncQueueItem,
  input: { operation: SyncQueueOperation; record: PrivateSyncRecord; now: string },
  resetRetry: boolean
): SyncQueueItem => {
  const next: SyncQueueItem = {
    ...item,
    operation: input.operation,
    snapshot: input.record,
    status: "pending",
    updatedAt: input.now,
    errorCode: undefined,
    lastError: undefined,
    nextAttemptAt: undefined
  };
  if (resetRetry) {
    next.retryCount = 0;
    next.lastAttemptAt = undefined;
  }
  return next;
};

const assertEnqueueable = (input: EnqueueSyncQueueInput): PrivateSyncRecord => {
  const ownerUserId = input.ownerUserId.trim();
  if (!ownerUserId) {
    throw new SyncQueueEnqueueError("owner_required", "ownerUserId は必須です");
  }
  const parsed = parsePrivateSyncRecord(input.record);
  if (!parsed.ok) {
    throw new SyncQueueEnqueueError(parsed.error.code, parsed.error.message);
  }
  if (parsed.value.metadata.ownerUserId !== ownerUserId) {
    throw new SyncQueueEnqueueError(
      "owner_mismatch",
      "Queue item の ownerUserId と snapshot の ownerUserId が一致しません"
    );
  }
  if (input.operation !== "upsert" && input.operation !== "delete") {
    throw new SyncQueueEnqueueError("operation_invalid", "operation が不正です");
  }
  return parsed.value;
};

export type SyncQueueRepository = {
  enqueue(input: EnqueueSyncQueueInput): Promise<SyncQueueItem>;
  getById(id: string): Promise<SyncQueueItem | null>;
  listByOwner(ownerUserId: string): Promise<SyncQueueItem[]>;
  listProcessable(ownerUserId: string, nowIso: string): Promise<SyncQueueItem[]>;
  /** current owner の次に処理可能になる時刻。pending は即時、blocked / processing は対象外。 */
  getNextProcessableAt(ownerUserId: string): Promise<string | null>;
  markProcessing(id: string, nowIso: string): Promise<SyncQueueItem | null>;
  markSucceeded(id: string): Promise<void>;
  markFailed(
    id: string,
    update: { retryCount: number; lastAttemptAt: string; nextAttemptAt: string; errorCode: string; lastError: string }
  ): Promise<SyncQueueItem | null>;
  markBlocked(
    id: string,
    update: { lastAttemptAt: string; errorCode: string; lastError: string; retryCount: number }
  ): Promise<SyncQueueItem | null>;
  recoverStaleProcessing(ownerUserId: string, nowMs: number, isStale: (lastAttemptAt?: string) => boolean): Promise<number>;
  getSummary(ownerUserId: string): Promise<SyncQueueSummary>;
};

export const createSyncQueueRepository = (): SyncQueueRepository => {
  const readAll = async (): Promise<SyncQueueItem[]> =>
    withStore("readonly", async (store) => (await requestToPromise(store.getAll())) as SyncQueueItem[]);

  const put = async (item: SyncQueueItem): Promise<void> => {
    await withStore("readwrite", async (store) => {
      await requestToPromise(store.put(item));
    });
  };

  const remove = async (id: string): Promise<void> => {
    await withStore("readwrite", async (store) => {
      await requestToPromise(store.delete(id));
    });
  };

  return {
    async enqueue(input) {
      const record = assertEnqueueable(input);
      const now = input.now ?? new Date().toISOString();
      const ownerUserId = input.ownerUserId.trim();
      const entityType = record.entityType;
      const entityId = record.id;
      const strategy = getSyncStrategy(entityType);
      const existing = await readAll();
      const related = existing.filter((item) => sameEntity(item, ownerUserId, entityType, entityId));

      if (strategy === "append-only") {
        const duplicate = related.find((item) => item.operation === input.operation);
        if (duplicate) {
          return duplicate;
        }
      } else if (input.operation === "upsert" || input.operation === "delete") {
        const mutable = related.filter(
          (item) => isCoalescable(item) && (item.operation === "upsert" || item.operation === "delete")
        );
        if (mutable.length > 0) {
          const [keep, ...rest] = mutable;
          const next = applySnapshot(keep, { operation: input.operation, record, now }, true);
          await put(next);
          for (const extra of rest) {
            await remove(extra.id);
          }
          return next;
        }
      }

      const created: SyncQueueItem = {
        id: createQueueId(),
        ownerUserId,
        entityType,
        entityId,
        operation: input.operation,
        status: "pending",
        createdAt: now,
        updatedAt: now,
        retryCount: 0,
        snapshot: record
      };
      await put(created);
      return created;
    },

    async getById(id) {
      return withStore("readonly", async (store) => {
        const found = (await requestToPromise(store.get(id))) as SyncQueueItem | undefined;
        return found ?? null;
      });
    },

    async listByOwner(ownerUserId) {
      const all = await readAll();
      return all
        .filter((item) => item.ownerUserId === ownerUserId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },

    async listProcessable(ownerUserId, nowIso) {
      const owned = await this.listByOwner(ownerUserId);
      return owned.filter((item) => {
        if (item.status === "pending") {
          return true;
        }
        if (item.status === "failed") {
          return !item.nextAttemptAt || item.nextAttemptAt <= nowIso;
        }
        return false;
      });
    },

    async getNextProcessableAt(ownerUserId) {
      const owned = await this.listByOwner(ownerUserId);
      let earliestFailed: string | null = null;
      for (const item of owned) {
        if (item.status === "pending" || (item.status === "failed" && !item.nextAttemptAt)) {
          return new Date(0).toISOString();
        }
        if (item.status !== "failed" || !item.nextAttemptAt) {
          continue;
        }
        if (!earliestFailed || item.nextAttemptAt < earliestFailed) {
          earliestFailed = item.nextAttemptAt;
        }
      }
      return earliestFailed;
    },

    async markProcessing(id, nowIso) {
      const current = await this.getById(id);
      if (!current || current.status === "blocked") {
        return null;
      }
      const next: SyncQueueItem = {
        ...current,
        status: "processing",
        updatedAt: nowIso,
        lastAttemptAt: nowIso
      };
      await put(next);
      return next;
    },

    async markSucceeded(id) {
      await remove(id);
    },

    async markFailed(id, update) {
      const current = await this.getById(id);
      if (!current) {
        return null;
      }
      const next: SyncQueueItem = {
        ...current,
        status: "failed",
        updatedAt: update.lastAttemptAt,
        retryCount: update.retryCount,
        lastAttemptAt: update.lastAttemptAt,
        nextAttemptAt: update.nextAttemptAt,
        errorCode: update.errorCode,
        lastError: update.lastError
      };
      await put(next);
      return next;
    },

    async markBlocked(id, update) {
      const current = await this.getById(id);
      if (!current) {
        return null;
      }
      const next: SyncQueueItem = {
        ...current,
        status: "blocked",
        updatedAt: update.lastAttemptAt,
        retryCount: update.retryCount,
        lastAttemptAt: update.lastAttemptAt,
        nextAttemptAt: undefined,
        errorCode: update.errorCode,
        lastError: update.lastError
      };
      await put(next);
      return next;
    },

    async recoverStaleProcessing(ownerUserId, nowMs, isStale) {
      const owned = await this.listByOwner(ownerUserId);
      let recovered = 0;
      const nowIso = new Date(nowMs).toISOString();
      for (const item of owned) {
        if (item.status !== "processing" || !isStale(item.lastAttemptAt)) {
          continue;
        }
        await put({
          ...item,
          status: "failed",
          updatedAt: nowIso,
          nextAttemptAt: nowIso,
          errorCode: "processing_lease_expired",
          lastError: "processing lease expired before completion"
        });
        recovered += 1;
      }
      return recovered;
    },

    async getSummary(ownerUserId) {
      const owned = await this.listByOwner(ownerUserId);
      const summary: SyncQueueSummary = {
        pending: 0,
        processing: 0,
        failed: 0,
        blocked: 0,
        total: owned.length
      };
      for (const item of owned) {
        summary[item.status] += 1;
      }
      return summary;
    }
  };
};

export const syncQueueDatabaseName = CONCEPT_BOOK_DB_NAME;
