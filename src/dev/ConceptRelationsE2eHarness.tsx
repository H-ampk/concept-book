import { useEffect, useState } from "react";
import { IndexedDBStorage } from "../storage/indexeddb";
import type { Concept } from "../types/concept";
import { createEmptyConceptInput } from "../types/concept";

const DB_NAME = "concept-book-db";
const STORE_CONCEPTS = "concepts";

export type ConceptRelationSnapshot = {
  id: string;
  title: string;
  relatedIds: string[];
  updatedAt: string;
};

export type RawConceptSeed = {
  id: string;
  title: string;
  relatedIds: string[];
  updatedAt?: string;
};

type ConceptRelationE2eApi = {
  resetDb: () => Promise<void>;
  list: () => Promise<ConceptRelationSnapshot[]>;
  createUntitled: (title: string) => Promise<ConceptRelationSnapshot>;
  addRelated: (fromId: string, toId: string) => Promise<void>;
  unlinkRelated: (fromId: string, toId: string) => Promise<void>;
  setRelatedIds: (id: string, relatedIds: string[]) => Promise<void>;
  deleteConcept: (id: string) => Promise<void>;
  putRawConcepts: (records: RawConceptSeed[]) => Promise<void>;
  seedLegacyV6: (records: RawConceptSeed[]) => Promise<void>;
  /** 本番 IndexedDBStorage.openDb を発火する。concepts の getAll repair は通さない。 */
  openProductionDb: () => Promise<{ dbVersion: number }>;
  /** object store を直接読む。getAllConcepts は呼ばない。 */
  readRawConcepts: () => Promise<ConceptRelationSnapshot[]>;
  mergeImportConcepts: (records: RawConceptSeed[]) => Promise<void>;
  replaceImportConcepts: (records: RawConceptSeed[]) => Promise<void>;
  zipReplaceRoundtrip: () => Promise<void>;
};

declare global {
  interface Window {
    __conceptRelationE2e?: ConceptRelationE2eApi;
  }
}

const emptyBackupFields = {
  contextCards: [],
  quizQuestions: [],
  quizQuestionParseSkipped: 0,
  quizDecks: [],
  quizDeckParseSkipped: 0,
  quizAttemptLogs: [],
  quizAttemptLogParseSkipped: 0
};

const toSnapshot = (concept: Concept): ConceptRelationSnapshot => ({
  id: concept.id,
  title: concept.title,
  relatedIds: [...concept.relatedIds].sort((a, b) => a.localeCompare(b)),
  updatedAt: concept.updatedAt
});

const toConcept = (record: RawConceptSeed): Concept => ({
  id: record.id,
  title: record.title,
  definition: "",
  myInterpretation: "",
  domainTags: [],
  researchTags: [],
  relatedIds: record.relatedIds,
  source: { book: "", page: "", author: null },
  notes: "",
  status: "draft",
  favorite: false,
  createdAt: record.updatedAt ?? "2020-01-01T00:00:00.000Z",
  updatedAt: record.updatedAt ?? "2020-01-01T00:00:00.000Z"
});

const deleteDatabase = (name: string): Promise<void> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("deleteDatabase failed"));
    request.onblocked = () => undefined;
  });

const requestToPromise = <T,>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const openDbVersion = (version: number): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, version);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_CONCEPTS)) {
        const store = db.createObjectStore(STORE_CONCEPTS, { keyPath: "id" });
        store.createIndex("title", "title", { unique: false });
        store.createIndex("updatedAt", "updatedAt", { unique: false });
      }
      if (!db.objectStoreNames.contains("media")) {
        const mediaStore = db.createObjectStore("media", { keyPath: "id" });
        mediaStore.createIndex("conceptId", "conceptId", { unique: false });
      }
      if (!db.objectStoreNames.contains("contextCards")) {
        db.createObjectStore("contextCards", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("quizQuestions")) {
        db.createObjectStore("quizQuestions", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("quizAttemptLogs")) {
        db.createObjectStore("quizAttemptLogs", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("quizDecks")) {
        db.createObjectStore("quizDecks", { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const openExistingDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const readRawConceptSnapshots = async (): Promise<ConceptRelationSnapshot[]> => {
  const db = await openExistingDb();
  try {
    if (!db.objectStoreNames.contains(STORE_CONCEPTS)) {
      return [];
    }
    const tx = db.transaction(STORE_CONCEPTS, "readonly");
    const store = tx.objectStore(STORE_CONCEPTS);
    const data = (await requestToPromise(store.getAll())) as Concept[];
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    return data.map(toSnapshot).sort((a, b) => a.title.localeCompare(b.title));
  } finally {
    db.close();
  }
};

const putRecordsIntoOpenDb = async (db: IDBDatabase, records: RawConceptSeed[]): Promise<void> => {
  const tx = db.transaction(STORE_CONCEPTS, "readwrite");
  const store = tx.objectStore(STORE_CONCEPTS);
  await Promise.all(records.map((record) => requestToPromise(store.put(toConcept(record)))));
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

const createApi = (): ConceptRelationE2eApi => {
  const storage = new IndexedDBStorage();

  return {
    resetDb: async () => {
      await deleteDatabase(DB_NAME);
    },
    list: async () => {
      const concepts = await storage.getAllConcepts();
      return concepts.map(toSnapshot).sort((a, b) => a.title.localeCompare(b.title));
    },
    createUntitled: async (title) => {
      const created = await storage.createConcept({
        ...createEmptyConceptInput(),
        title
      });
      return toSnapshot(created);
    },
    addRelated: async (fromId, toId) => {
      const from = await storage.getConceptById(fromId);
      if (!from) {
        throw new Error(`missing concept ${fromId}`);
      }
      await storage.updateConcept(fromId, {
        relatedIds: [...from.relatedIds, toId]
      });
    },
    unlinkRelated: async (fromId, toId) => {
      const from = await storage.getConceptById(fromId);
      if (!from) {
        throw new Error(`missing concept ${fromId}`);
      }
      await storage.updateConcept(fromId, {
        relatedIds: from.relatedIds.filter((id) => id !== toId)
      });
    },
    setRelatedIds: async (id, relatedIds) => {
      await storage.updateConcept(id, { relatedIds });
    },
    deleteConcept: async (id) => {
      await storage.deleteConcept(id);
    },
    putRawConcepts: async (records) => {
      await storage.getAllConcepts();
      const db = await openDbVersion(7);
      try {
        await putRecordsIntoOpenDb(db, records);
      } finally {
        db.close();
      }
    },
    seedLegacyV6: async (records) => {
      await deleteDatabase(DB_NAME);
      const db = await openDbVersion(6);
      try {
        await putRecordsIntoOpenDb(db, records);
      } finally {
        db.close();
      }
    },
    openProductionDb: async () => {
      // quiz store を読むことで本番 openDb（v7）だけを走らせ、concepts の getAll repair は避ける。
      await storage.getQuizQuestions();
      const db = await openExistingDb();
      try {
        return { dbVersion: db.version };
      } finally {
        db.close();
      }
    },
    readRawConcepts: async () => readRawConceptSnapshots(),
    mergeImportConcepts: async (records) => {
      await storage.importBackupData(
        {
          concepts: records.map(toConcept),
          ...emptyBackupFields
        },
        "merge"
      );
    },
    replaceImportConcepts: async (records) => {
      await storage.importBackupData(
        {
          concepts: records.map(toConcept),
          ...emptyBackupFields
        },
        "replace"
      );
    },
    zipReplaceRoundtrip: async () => {
      const blob = await storage.exportConceptBookPackage();
      const file = new File([blob], "concept-book.zip", { type: "application/zip" });
      await storage.importConceptBookPackage(file, "replace");
    }
  };
};

export const ConceptRelationsE2eHarness = () => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    window.__conceptRelationE2e = createApi();
    setReady(true);
    return () => {
      delete window.__conceptRelationE2e;
    };
  }, []);

  return (
    <div className="p-4 text-sm text-celestial-textMain">
      <p className="text-xs text-celestial-textSub">concept relations storage e2e harness (DEV)</p>
      <p data-testid="concept-relations-e2e-ready">{ready ? "ready" : "loading"}</p>
    </div>
  );
};
