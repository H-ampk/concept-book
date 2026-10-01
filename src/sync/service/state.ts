import {
  CONCEPT_BOOK_DB_NAME,
  SYNC_STATE_STORE_NAME,
  openConceptBookDatabase
} from "../../storage/indexeddb";
import type { SyncCursor } from "../queue/types";
import type { SyncOwnerState, SyncStateRepository } from "./types";

type StoredSyncState = {
  ownerUserId: string;
  cursor: SyncCursor | null;
  lastSuccessfulSyncAt: string | null;
};

const requestToPromise = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const withStore = async <T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => Promise<T>): Promise<T> => {
  const db = await openConceptBookDatabase();
  try {
    const tx = db.transaction(SYNC_STATE_STORE_NAME, mode);
    const store = tx.objectStore(SYNC_STATE_STORE_NAME);
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

const emptyState = (ownerUserId: string): SyncOwnerState => ({
  ownerUserId,
  cursor: null,
  lastSuccessfulSyncAt: null
});

export const createSyncStateRepository = (): SyncStateRepository => {
  const read = async (ownerUserId: string): Promise<StoredSyncState | null> => {
    const row = await withStore("readonly", async (store) => requestToPromise(store.get(ownerUserId)));
    if (!row || typeof row !== "object") {
      return null;
    }
    return row as StoredSyncState;
  };

  const write = async (row: StoredSyncState): Promise<void> => {
    await withStore("readwrite", async (store) => {
      await requestToPromise(store.put(row));
    });
  };

  return {
    async getState(ownerUserId) {
      const row = await read(ownerUserId);
      if (!row || row.ownerUserId !== ownerUserId) {
        return emptyState(ownerUserId);
      }
      return {
        ownerUserId,
        cursor: typeof row.cursor === "string" && row.cursor.length > 0 ? row.cursor : null,
        lastSuccessfulSyncAt:
          typeof row.lastSuccessfulSyncAt === "string" && row.lastSuccessfulSyncAt.length > 0
            ? row.lastSuccessfulSyncAt
            : null
      };
    },
    async setCursor(ownerUserId, cursor) {
      const current = await this.getState(ownerUserId);
      await write({
        ownerUserId,
        cursor,
        lastSuccessfulSyncAt: current.lastSuccessfulSyncAt
      });
    },
    async setLastSuccessfulSyncAt(ownerUserId, iso) {
      const current = await this.getState(ownerUserId);
      await write({
        ownerUserId,
        cursor: current.cursor,
        lastSuccessfulSyncAt: iso
      });
    }
  };
};

export const SYNC_STATE_DB_NAME = CONCEPT_BOOK_DB_NAME;
