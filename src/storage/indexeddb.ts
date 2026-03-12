import type { Concept, ConceptInput } from "../types/concept";
import { nowIso } from "../utils/date";
import type { ConceptStorage } from "./types";

const DB_NAME = "concept-book-db";
const DB_VERSION = 1;
const STORE_NAME = "concepts";

const createConceptId = (): string =>
  `concept_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const toArray = <T>(value: T[] | undefined): T[] => (Array.isArray(value) ? value : []);

type StoredConcept = Partial<Concept> & {
  tags?: string[];
};

const sanitizeConcept = (
  concept: StoredConcept
): {
  concept: Concept;
  migrated: boolean;
} => {
  const legacyTags = toArray(concept.tags).filter(Boolean);
  const hasLegacyTags = legacyTags.length > 0;
  const domainTags = toArray(concept.domainTags).filter(Boolean);
  const researchTags = toArray(concept.researchTags).filter(Boolean);
  const normalizedDomainTags = domainTags.length > 0 ? domainTags : legacyTags;

  const normalized: Concept = {
    id: concept.id ?? createConceptId(),
    title: concept.title ?? "",
    definition: concept.definition ?? "",
    myInterpretation: concept.myInterpretation ?? "",
    domainTags: normalizedDomainTags,
    researchTags,
    relatedIds: toArray(concept.relatedIds).filter(Boolean),
    source: {
      book: concept.source?.book ?? "",
      page: concept.source?.page ?? "",
      author: concept.source?.author ?? null
    },
    notes: concept.notes ?? "",
    status: concept.status ?? "active",
    favorite: Boolean(concept.favorite),
    createdAt: concept.createdAt ?? nowIso(),
    updatedAt: concept.updatedAt ?? nowIso()
  };

  const migrated =
    hasLegacyTags ||
    concept.domainTags === undefined ||
    concept.researchTags === undefined;

  return { concept: normalized, migrated };
};

const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("title", "title", { unique: false });
        store.createIndex("updatedAt", "updatedAt", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const withStore = async <T>(
  mode: IDBTransactionMode,
  executor: (store: IDBObjectStore) => Promise<T>
): Promise<T> => {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const result = await executor(store);

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });

    return result;
  } finally {
    db.close();
  }
};

const requestToPromise = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

export class IndexedDBStorage implements ConceptStorage {
  async getAllConcepts(): Promise<Concept[]> {
    return withStore("readwrite", async (store) => {
      const data = (await requestToPromise(store.getAll())) as StoredConcept[];
      const normalized = await Promise.all(
        data.map(async (raw) => {
          const { concept, migrated } = sanitizeConcept(raw);
          if (migrated) {
            await requestToPromise(store.put(concept));
          }
          return concept;
        })
      );
      return normalized.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    });
  }

  async getConceptById(id: string): Promise<Concept | undefined> {
    return withStore("readwrite", async (store) => {
      const result = (await requestToPromise(store.get(id))) as StoredConcept | undefined;
      if (!result) {
        return undefined;
      }
      const normalized = sanitizeConcept(result);
      if (normalized.migrated) {
        await requestToPromise(store.put(normalized.concept));
      }
      return normalized.concept;
    });
  }

  async createConcept(input: ConceptInput): Promise<Concept> {
    return withStore("readwrite", async (store) => {
      const now = nowIso();
      const concept: Concept = {
        ...input,
        id: createConceptId(),
        domainTags: toArray(input.domainTags)
          .map((tag) => tag.trim())
          .filter(Boolean),
        researchTags: toArray(input.researchTags)
          .map((tag) => tag.trim())
          .filter(Boolean),
        relatedIds: toArray(input.relatedIds).map((id) => id.trim()).filter(Boolean),
        createdAt: now,
        updatedAt: now
      };
      await requestToPromise(store.add(concept));
      return concept;
    });
  }

  async updateConcept(
    id: string,
    updates: Partial<ConceptInput> & {
      relatedIds?: string[];
      domainTags?: string[];
      researchTags?: string[];
    }
  ): Promise<Concept | undefined> {
    return withStore("readwrite", async (store) => {
      const existingRaw = (await requestToPromise(store.get(id))) as StoredConcept | undefined;
      const existing = existingRaw ? sanitizeConcept(existingRaw).concept : undefined;
      if (!existing) {
        return undefined;
      }
      const updated: Concept = {
        ...existing,
        ...updates,
        domainTags:
          updates.domainTags !== undefined
            ? updates.domainTags.map((tag) => tag.trim()).filter(Boolean)
            : existing.domainTags,
        researchTags:
          updates.researchTags !== undefined
            ? updates.researchTags.map((tag) => tag.trim()).filter(Boolean)
            : existing.researchTags,
        relatedIds:
          updates.relatedIds !== undefined
            ? updates.relatedIds.map((relatedId) => relatedId.trim()).filter(Boolean)
            : existing.relatedIds,
        source: {
          book: updates.source?.book ?? existing.source.book,
          page: updates.source?.page ?? existing.source.page,
          author: updates.source?.author ?? existing.source.author
        },
        updatedAt: nowIso()
      };
      await requestToPromise(store.put(updated));
      return updated;
    });
  }

  async deleteConcept(id: string): Promise<void> {
    await withStore("readwrite", async (store) => {
      await requestToPromise(store.delete(id));

      const all = (await requestToPromise(store.getAll())) as StoredConcept[];
      const touched = all
        .map((item) => sanitizeConcept(item).concept)
        .filter((concept) => concept.relatedIds.includes(id));
      await Promise.all(
        touched.map(async (concept) => {
          const next: Concept = {
            ...concept,
            relatedIds: concept.relatedIds.filter((relatedId) => relatedId !== id),
            updatedAt: nowIso()
          };
          await requestToPromise(store.put(next));
        })
      );
    });
  }

  async exportConcepts(): Promise<Concept[]> {
    return this.getAllConcepts();
  }

  async importConcepts(
    concepts: Concept[],
    mode: "replace" | "merge"
  ): Promise<{ imported: number; skipped: number }> {
    return withStore("readwrite", async (store) => {
      let imported = 0;
      let skipped = 0;
      if (mode === "replace") {
        await requestToPromise(store.clear());
      }

      for (const raw of concepts) {
        if (!raw?.id || !raw?.title) {
          skipped += 1;
          continue;
        }
        const concept = sanitizeConcept(raw as StoredConcept).concept;
        if (mode === "merge") {
          const existing = (await requestToPromise(store.get(concept.id))) as Concept | undefined;
          if (existing) {
            const newer =
              existing.updatedAt.localeCompare(concept.updatedAt) >= 0 ? existing : concept;
            await requestToPromise(store.put(newer));
            imported += 1;
            continue;
          }
        }
        await requestToPromise(store.put(concept));
        imported += 1;
      }
      return { imported, skipped };
    });
  }
}
