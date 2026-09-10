import {
  AI_EMBEDDING_CACHE_DB_NAME,
  AI_EMBEDDING_CACHE_DB_VERSION,
  AI_EMBEDDING_CACHE_STORE
} from "./constants";
import type { ConceptEmbeddingCacheEntry } from "./types";

export const embeddingCacheEntryKey = (conceptId: string, model: string): string =>
  `${conceptId}::${model}`;

export interface ConceptEmbeddingCache {
  getAll(): Promise<ConceptEmbeddingCacheEntry[]>;
  putMany(entries: readonly ConceptEmbeddingCacheEntry[]): Promise<void>;
  deleteKeys(keys: readonly string[]): Promise<void>;
}

type StoredEmbeddingCacheEntry = ConceptEmbeddingCacheEntry & { id: string };

const toStored = (entry: ConceptEmbeddingCacheEntry): StoredEmbeddingCacheEntry => ({
  id: embeddingCacheEntryKey(entry.conceptId, entry.model),
  conceptId: entry.conceptId,
  model: entry.model,
  fingerprint: entry.fingerprint,
  vector: [...entry.vector],
  ...(entry.norm !== undefined ? { norm: entry.norm } : {})
});

const fromStored = (raw: unknown): ConceptEmbeddingCacheEntry | null => {
  if (typeof raw !== "object" || raw === null) {
    return null;
  }
  const record = raw as Partial<StoredEmbeddingCacheEntry>;
  if (
    typeof record.conceptId !== "string" ||
    record.conceptId.length === 0 ||
    typeof record.model !== "string" ||
    record.model.length === 0 ||
    typeof record.fingerprint !== "string" ||
    record.fingerprint.length === 0 ||
    !Array.isArray(record.vector)
  ) {
    return null;
  }
  return {
    conceptId: record.conceptId,
    model: record.model,
    fingerprint: record.fingerprint,
    vector: record.vector.filter((value): value is number => typeof value === "number"),
    ...(typeof record.norm === "number" ? { norm: record.norm } : {})
  };
};

export class MemoryConceptEmbeddingCache implements ConceptEmbeddingCache {
  private readonly entries = new Map<string, ConceptEmbeddingCacheEntry>();

  async getAll(): Promise<ConceptEmbeddingCacheEntry[]> {
    return [...this.entries.values()].map((entry) => ({
      ...entry,
      vector: [...entry.vector]
    }));
  }

  async putMany(entries: readonly ConceptEmbeddingCacheEntry[]): Promise<void> {
    for (const entry of entries) {
      this.entries.set(embeddingCacheEntryKey(entry.conceptId, entry.model), {
        ...entry,
        vector: [...entry.vector]
      });
    }
  }

  async deleteKeys(keys: readonly string[]): Promise<void> {
    for (const key of keys) {
      this.entries.delete(key);
    }
  }
}

const requestToPromise = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("AI cache の読み書きに失敗しました。"));
  });

const openAiCacheDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(AI_EMBEDDING_CACHE_DB_NAME, AI_EMBEDDING_CACHE_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(AI_EMBEDDING_CACHE_STORE)) {
        db.createObjectStore(AI_EMBEDDING_CACHE_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("AI cache を開けませんでした。"));
  });

export class IndexedDBConceptEmbeddingCache implements ConceptEmbeddingCache {
  constructor(private readonly db: IDBDatabase) {}

  static async open(): Promise<IndexedDBConceptEmbeddingCache> {
    const db = await openAiCacheDb();
    return new IndexedDBConceptEmbeddingCache(db);
  }

  async getAll(): Promise<ConceptEmbeddingCacheEntry[]> {
    const tx = this.db.transaction(AI_EMBEDDING_CACHE_STORE, "readonly");
    const store = tx.objectStore(AI_EMBEDDING_CACHE_STORE);
    const rows = await requestToPromise(store.getAll());
    return (Array.isArray(rows) ? rows : []).flatMap((row) => {
      const entry = fromStored(row);
      return entry ? [entry] : [];
    });
  }

  async putMany(entries: readonly ConceptEmbeddingCacheEntry[]): Promise<void> {
    if (entries.length === 0) {
      return;
    }
    const tx = this.db.transaction(AI_EMBEDDING_CACHE_STORE, "readwrite");
    const store = tx.objectStore(AI_EMBEDDING_CACHE_STORE);
    await Promise.all(entries.map((entry) => requestToPromise(store.put(toStored(entry)))));
  }

  async deleteKeys(keys: readonly string[]): Promise<void> {
    if (keys.length === 0) {
      return;
    }
    const tx = this.db.transaction(AI_EMBEDDING_CACHE_STORE, "readwrite");
    const store = tx.objectStore(AI_EMBEDDING_CACHE_STORE);
    await Promise.all(keys.map((key) => requestToPromise(store.delete(key))));
  }
}

let defaultCachePromise: Promise<ConceptEmbeddingCache> | null = null;

export const getConceptEmbeddingCache = (): Promise<ConceptEmbeddingCache> => {
  if (!defaultCachePromise) {
    defaultCachePromise = IndexedDBConceptEmbeddingCache.open().catch(
      () => new MemoryConceptEmbeddingCache()
    );
  }
  return defaultCachePromise;
};

export const resetConceptEmbeddingCacheSingleton = (): void => {
  defaultCachePromise = null;
};
