import { buildConceptBookZip, parseConceptBookZip } from "../utils/conceptBookZip";
import { validateBackupImportPayload } from "../utils/conceptImportValidation";
import { normalizeMediaRefs } from "../utils/conceptImportValidation";
import { nowIso } from "../utils/date";
import { guessMimeFromFileName } from "../utils/mediaConstraints";
import { MAX_MEDIA_FILES_PER_CONCEPT, validateMediaFile } from "../utils/mediaConstraints";
import type { Concept, ConceptInput, ContextDefinition } from "../types/concept";
import type { ContextCard, ContextCardInput } from "../types/contextCard";
import type { ConceptMediaRef, MediaRecord } from "../types/media";
import type { QuizAttemptLog, QuizChoice, QuizDeck, QuizQuestion, QuizVisibility } from "../types/quiz";
import {
  QUIZ_ATTEMPT_LOG_SCHEMA_VERSION,
  QUIZ_DECK_SCHEMA_VERSION,
  QUIZ_QUESTION_SCHEMA_VERSION
} from "../types/quiz";
import { stripInvalidQuizReferences } from "../utils/quizConceptLink";
import type { ConceptStorage, ContextCardStorage } from "./types";

const DB_NAME = "concept-book-db";
const DB_VERSION = 6;
const STORE_CONCEPTS = "concepts";
const STORE_MEDIA = "media";
const STORE_CONTEXT_CARDS = "contextCards";
const STORE_QUIZ_QUESTIONS = "quizQuestions";
const STORE_QUIZ_DECKS = "quizDecks";
const STORE_QUIZ_ATTEMPT_LOGS = "quizAttemptLogs";

const createConceptId = (): string =>
  `concept_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const createMediaId = (): string =>
  `media_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const toArray = <T>(value: T[] | undefined): T[] => (Array.isArray(value) ? value : []);

type StoredConcept = Partial<Concept> & {
  tags?: string[];
};

const normalizeContextDefinitions = (value: unknown): Concept["contextDefinitions"] =>
  toArray(value as Concept["contextDefinitions"])
    .map((item, index) => {
      const raw = (item ?? {}) as Partial<ContextDefinition> & {
        label?: string;
        text?: string;
      };
      const context = (raw.context ?? raw.label ?? "").toString();
      const definition = (raw.definition ?? raw.text ?? "").toString();
      if (!context.trim() && !definition.trim()) {
        return null;
      }
      return {
        id: raw.id?.toString() || `ctx_${index}_${Math.random().toString(36).slice(2, 8)}`,
        context,
        definition
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

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
  const mediaNorm = normalizeMediaRefs(concept.media ?? []);

  const normalized: Concept = {
    id: concept.id ?? createConceptId(),
    title: concept.title ?? "",
    definition: concept.definition ?? "",
    myInterpretation: concept.myInterpretation ?? "",
    domainTags: normalizedDomainTags,
    researchTags,
    relatedIds: toArray(concept.relatedIds).filter(Boolean),
    media: mediaNorm.length > 0 ? mediaNorm : undefined,
    source: {
      book: concept.source?.book ?? "",
      page: concept.source?.page ?? "",
      author: concept.source?.author ?? null
    },
    notes: concept.notes ?? "",
    status: concept.status ?? "active",
    favorite: Boolean(concept.favorite),
    createdAt: concept.createdAt ?? nowIso(),
    updatedAt: concept.updatedAt ?? nowIso(),
    contextDefinitions: normalizeContextDefinitions(concept.contextDefinitions)
  };

  const migrated =
    hasLegacyTags ||
    concept.domainTags === undefined ||
    concept.researchTags === undefined;

  return { concept: normalized, migrated };
};

type StoredQuizQuestion = Partial<QuizQuestion> & {
  choices?: unknown;
};

const isQuizVisibility = (v: unknown): v is QuizVisibility =>
  v === "private" || v === "public";

const normalizeQuizQuestion = (raw: StoredQuizQuestion): QuizQuestion => {
  const choices: QuizChoice[] = Array.isArray(raw.choices)
    ? raw.choices.map((c, index) => {
        const item = (c ?? {}) as Partial<QuizChoice>;
        const id = item.id?.toString() || `choice_${index}_${Math.random().toString(36).slice(2, 8)}`;
        const text = item.text?.toString() ?? "";
        const lidRaw = item.linkedConceptId?.toString().trim();
        const choice: QuizChoice = { id, text };
        if (lidRaw) {
          choice.linkedConceptId = lidRaw;
        }
        return choice;
      })
    : [];

  const visibility: QuizVisibility = isQuizVisibility(raw.visibility) ? raw.visibility : "private";
  const schemaVersion =
    typeof raw.schemaVersion === "number" && Number.isFinite(raw.schemaVersion)
      ? raw.schemaVersion
      : QUIZ_QUESTION_SCHEMA_VERSION;

  const cidRaw = raw.conceptId?.toString().trim();

  return {
    id: raw.id?.toString() ?? "",
    ...(cidRaw ? { conceptId: cidRaw } : {}),
    prompt: raw.prompt?.toString() ?? "",
    choices,
    correctChoiceId: raw.correctChoiceId?.toString() ?? "",
    explanation: raw.explanation !== undefined ? raw.explanation.toString() : undefined,
    visibility,
    sortOrder: typeof raw.sortOrder === "number" && Number.isFinite(raw.sortOrder) ? raw.sortOrder : undefined,
    schemaVersion,
    createdAt: raw.createdAt?.toString() ?? nowIso(),
    updatedAt: raw.updatedAt?.toString() ?? nowIso()
  };
};

type StoredQuizAttemptLog = Partial<QuizAttemptLog>;

type StoredQuizDeck = Partial<QuizDeck>;

const dedupeStringsPreserveOrder = (items: string[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    if (!item || seen.has(item)) {
      continue;
    }
    seen.add(item);
    out.push(item);
  }
  return out;
};

const normalizeDomainTags = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const trimmed = value
    .map((t) => (t ?? "").toString().trim())
    .filter(Boolean);
  const unique = dedupeStringsPreserveOrder(trimmed);
  return unique.length > 0 ? unique : undefined;
};

const normalizeQuestionIds = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  const ids = value
    .map((id) => (id ?? "").toString().trim())
    .filter(Boolean);
  return dedupeStringsPreserveOrder(ids);
};

/** DB 読み出し・保存前の共通正規化（save 側で id / title の必須検証を行う） */
const normalizeQuizDeck = (raw: StoredQuizDeck): QuizDeck => {
  const visibility: QuizVisibility = isQuizVisibility(raw.visibility) ? raw.visibility : "private";
  const schemaVersion =
    typeof raw.schemaVersion === "number" && Number.isFinite(raw.schemaVersion)
      ? raw.schemaVersion
      : QUIZ_DECK_SCHEMA_VERSION;

  const title = raw.title?.toString().trim() ?? "";
  const dk = raw.deckKey?.toString().trim();
  const tags = normalizeDomainTags(raw.domainTags);
  const questionIds = normalizeQuestionIds(raw.questionIds);

  const deck: QuizDeck = {
    id: raw.id?.toString() ?? "",
    title,
    questionIds,
    visibility,
    schemaVersion,
    createdAt: raw.createdAt?.toString() ?? nowIso(),
    updatedAt: raw.updatedAt?.toString() ?? nowIso()
  };

  const desc = raw.description?.toString().trim();
  if (desc) {
    deck.description = desc;
  }
  if (dk) {
    deck.deckKey = dk;
  }
  if (tags) {
    deck.domainTags = tags;
  }

  return deck;
};

const stripQuestionIdsFromAllDecks = async (
  deckStore: IDBObjectStore,
  removeIds: Set<string>
): Promise<void> => {
  if (removeIds.size === 0) {
    return;
  }
  const all = (await requestToPromise(deckStore.getAll())) as StoredQuizDeck[];
  const now = nowIso();
  await Promise.all(
    all.map(async (row) => {
      const deck = normalizeQuizDeck(row);
      if (!deck.id) {
        return;
      }
      const nextIds = deck.questionIds.filter((qid) => !removeIds.has(qid));
      if (nextIds.length === deck.questionIds.length) {
        return;
      }
      const updated = normalizeQuizDeck({
        ...deck,
        questionIds: nextIds,
        updatedAt: now
      });
      await requestToPromise(deckStore.put(updated));
    })
  );
};

const normalizeQuizAttemptLog = (raw: StoredQuizAttemptLog): QuizAttemptLog => {
  const timeMsRaw = raw.timeMs;
  const timeMs =
    typeof timeMsRaw === "number" && Number.isFinite(timeMsRaw) && timeMsRaw >= 0 ? timeMsRaw : 0;
  const schemaVersion =
    typeof raw.schemaVersion === "number" && Number.isFinite(raw.schemaVersion)
      ? raw.schemaVersion
      : QUIZ_ATTEMPT_LOG_SCHEMA_VERSION;

  const sid = raw.sessionId?.toString().trim();
  const qcid = raw.questionConceptId?.toString().trim();
  const selLink = raw.selectedLinkedConceptId?.toString().trim();
  const corrLink = raw.correctLinkedConceptId?.toString().trim();
  const did = raw.deckId?.toString().trim();
  const dts = raw.deckTitleSnapshot?.toString().trim();

  return {
    id: raw.id?.toString() ?? "",
    ...(sid ? { sessionId: sid } : {}),
    questionId: raw.questionId?.toString() ?? "",
    questionPromptSnapshot: raw.questionPromptSnapshot?.toString() ?? "",
    ...(qcid ? { questionConceptId: qcid } : {}),
    selectedChoiceId: raw.selectedChoiceId?.toString() ?? "",
    selectedChoiceTextSnapshot: raw.selectedChoiceTextSnapshot?.toString() ?? "",
    ...(selLink ? { selectedLinkedConceptId: selLink } : {}),
    correctChoiceId: raw.correctChoiceId?.toString() ?? "",
    correctChoiceTextSnapshot: raw.correctChoiceTextSnapshot?.toString() ?? "",
    ...(corrLink ? { correctLinkedConceptId: corrLink } : {}),
    ...(did ? { deckId: did } : {}),
    ...(dts ? { deckTitleSnapshot: dts } : {}),
    correct: Boolean(raw.correct),
    startedAt: raw.startedAt?.toString() ?? nowIso(),
    answeredAt: raw.answeredAt?.toString() ?? nowIso(),
    timeMs,
    schemaVersion
  };
};

const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      const oldVersion = event.oldVersion;

      if (!db.objectStoreNames.contains(STORE_CONCEPTS)) {
        const store = db.createObjectStore(STORE_CONCEPTS, { keyPath: "id" });
        store.createIndex("title", "title", { unique: false });
        store.createIndex("updatedAt", "updatedAt", { unique: false });
      }

      if (oldVersion < 2 && !db.objectStoreNames.contains(STORE_MEDIA)) {
        const mediaStore = db.createObjectStore(STORE_MEDIA, { keyPath: "id" });
        mediaStore.createIndex("conceptId", "conceptId", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_CONTEXT_CARDS)) {
        const contextStore = db.createObjectStore(STORE_CONTEXT_CARDS, { keyPath: "id" });
        contextStore.createIndex("title", "title", { unique: false });
        contextStore.createIndex("domain", "domain", { unique: false });
        contextStore.createIndex("updatedAt", "updatedAt", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_QUIZ_QUESTIONS)) {
        const quizStore = db.createObjectStore(STORE_QUIZ_QUESTIONS, { keyPath: "id" });
        quizStore.createIndex("conceptId", "conceptId", { unique: false });
        quizStore.createIndex("visibility", "visibility", { unique: false });
        quizStore.createIndex("updatedAt", "updatedAt", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_QUIZ_ATTEMPT_LOGS)) {
        const logStore = db.createObjectStore(STORE_QUIZ_ATTEMPT_LOGS, { keyPath: "id" });
        logStore.createIndex("questionId", "questionId", { unique: false });
        logStore.createIndex("questionConceptId", "questionConceptId", { unique: false });
        logStore.createIndex("selectedLinkedConceptId", "selectedLinkedConceptId", { unique: false });
        logStore.createIndex("correctLinkedConceptId", "correctLinkedConceptId", { unique: false });
        logStore.createIndex("answeredAt", "answeredAt", { unique: false });
        logStore.createIndex("sessionId", "sessionId", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_QUIZ_DECKS)) {
        const deckStore = db.createObjectStore(STORE_QUIZ_DECKS, { keyPath: "id" });
        deckStore.createIndex("deckKey", "deckKey", { unique: false });
        deckStore.createIndex("visibility", "visibility", { unique: false });
        deckStore.createIndex("updatedAt", "updatedAt", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const withTransaction = async <T>(
  storeNames: string[],
  mode: IDBTransactionMode,
  run: (getStore: (name: string) => IDBObjectStore) => Promise<T>
): Promise<T> => {
  const db = await openDb();
  try {
    const tx = db.transaction(storeNames, mode);
    const getStore = (name: string) => {
      if (!storeNames.includes(name)) {
        throw new Error(`Store ${name} is not in this transaction`);
      }
      return tx.objectStore(name);
    };
    const result = await run(getStore);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error("Transaction aborted"));
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
    return withTransaction([STORE_CONCEPTS], "readwrite", async (getStore) => {
      const store = getStore(STORE_CONCEPTS);
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
    return withTransaction([STORE_CONCEPTS], "readwrite", async (getStore) => {
      const store = getStore(STORE_CONCEPTS);
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
    return withTransaction([STORE_CONCEPTS], "readwrite", async (getStore) => {
      const store = getStore(STORE_CONCEPTS);
      const now = nowIso();
      const mediaNorm = normalizeMediaRefs(input.media ?? []);
      const concept: Concept = {
        ...input,
        id: createConceptId(),
        domainTags: toArray(input.domainTags)
          .map((tag) => tag.trim())
          .filter(Boolean),
        researchTags: toArray(input.researchTags)
          .map((tag) => tag.trim())
          .filter(Boolean),
        relatedIds: toArray(input.relatedIds).map((rid) => rid.trim()).filter(Boolean),
        media: mediaNorm.length > 0 ? mediaNorm : undefined,
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
      media?: ConceptMediaRef[];
    }
  ): Promise<Concept | undefined> {
    return withTransaction([STORE_CONCEPTS], "readwrite", async (getStore) => {
      const store = getStore(STORE_CONCEPTS);
      const existingRaw = (await requestToPromise(store.get(id))) as StoredConcept | undefined;
      const existing = existingRaw ? sanitizeConcept(existingRaw).concept : undefined;
      if (!existing) {
        return undefined;
      }
      const nextMedia =
        updates.media !== undefined
          ? (() => {
              const n = normalizeMediaRefs(updates.media);
              return n.length > 0 ? n : undefined;
            })()
          : existing.media;

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
        media: nextMedia,
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

  private async deleteMediaForConceptId(conceptId: string): Promise<void> {
    await withTransaction([STORE_MEDIA], "readwrite", async (getStore) => {
      const mediaStore = getStore(STORE_MEDIA);
      const index = mediaStore.index("conceptId");
      const records = (await requestToPromise(index.getAll(conceptId))) as MediaRecord[];
      await Promise.all(records.map((r) => requestToPromise(mediaStore.delete(r.id))));
    });
  }

  private async stripQuizReferencesToDeletedConcept(deletedConceptId: string): Promise<void> {
    await withTransaction([STORE_QUIZ_QUESTIONS], "readwrite", async (getStore) => {
      const store = getStore(STORE_QUIZ_QUESTIONS);
      const all = (await requestToPromise(store.getAll())) as StoredQuizQuestion[];
      for (const raw of all) {
        const q = normalizeQuizQuestion(raw);
        let changed = false;
        let nextConceptId = q.conceptId;
        if (nextConceptId === deletedConceptId) {
          nextConceptId = undefined;
          changed = true;
        }
        const nextChoices: QuizChoice[] = q.choices.map((c) => {
          if (c.linkedConceptId === deletedConceptId) {
            changed = true;
            const { linkedConceptId: _, ...rest } = c;
            return rest;
          }
          return c;
        });
        if (!changed) {
          continue;
        }
        const next: QuizQuestion = {
          ...q,
          conceptId: nextConceptId,
          choices: nextChoices,
          updatedAt: nowIso()
        };
        await requestToPromise(store.put(normalizeQuizQuestion(next as StoredQuizQuestion)));
      }
    });
  }

  async deleteConcept(id: string): Promise<void> {
    await this.deleteMediaForConceptId(id);
    await this.stripQuizReferencesToDeletedConcept(id);
    await withTransaction([STORE_CONCEPTS], "readwrite", async (getStore) => {
      const store = getStore(STORE_CONCEPTS);
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

  async getQuizQuestions(): Promise<QuizQuestion[]> {
    return withTransaction([STORE_QUIZ_QUESTIONS], "readonly", async (getStore) => {
      const store = getStore(STORE_QUIZ_QUESTIONS);
      const data = (await requestToPromise(store.getAll())) as StoredQuizQuestion[];
      return data
        .map((raw) => normalizeQuizQuestion(raw))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    });
  }

  async getQuizQuestionsByConceptId(conceptId: string): Promise<QuizQuestion[]> {
    return withTransaction([STORE_QUIZ_QUESTIONS], "readonly", async (getStore) => {
      const store = getStore(STORE_QUIZ_QUESTIONS);
      const data = (await requestToPromise(store.getAll())) as StoredQuizQuestion[];
      return data
        .map((raw) => normalizeQuizQuestion(raw))
        .filter(
          (q) =>
            q.conceptId === conceptId ||
            q.choices.some((c) => c.linkedConceptId === conceptId)
        )
        .sort((a, b) => {
          const orderA = a.sortOrder ?? 0;
          const orderB = b.sortOrder ?? 0;
          if (orderA !== orderB) {
            return orderA - orderB;
          }
          return b.updatedAt.localeCompare(a.updatedAt);
        });
    });
  }

  async saveQuizQuestion(question: QuizQuestion): Promise<void> {
    if (!question.id?.trim()) {
      throw new Error("QuizQuestion の id が空です。");
    }
    return withTransaction([STORE_QUIZ_QUESTIONS], "readwrite", async (getStore) => {
      const normalized = normalizeQuizQuestion(question);
      await requestToPromise(getStore(STORE_QUIZ_QUESTIONS).put(normalized));
    });
  }

  async deleteQuizQuestion(id: string): Promise<void> {
    return withTransaction([STORE_QUIZ_QUESTIONS, STORE_QUIZ_DECKS], "readwrite", async (getStore) => {
      await stripQuestionIdsFromAllDecks(getStore(STORE_QUIZ_DECKS), new Set([id]));
      await requestToPromise(getStore(STORE_QUIZ_QUESTIONS).delete(id));
    });
  }

  async deleteQuizQuestionsByConceptId(conceptId: string): Promise<void> {
    return withTransaction([STORE_QUIZ_QUESTIONS, STORE_QUIZ_DECKS], "readwrite", async (getStore) => {
      const store = getStore(STORE_QUIZ_QUESTIONS);
      const index = store.index("conceptId");
      const rows = (await requestToPromise(index.getAll(conceptId))) as StoredQuizQuestion[];
      const keys = new Set(
        rows.map((r) => r.id?.toString()).filter((key): key is string => Boolean(key))
      );
      await stripQuestionIdsFromAllDecks(getStore(STORE_QUIZ_DECKS), keys);
      await Promise.all([...keys].map((key) => requestToPromise(store.delete(key))));
    });
  }

  async getQuizDecks(): Promise<QuizDeck[]> {
    return withTransaction([STORE_QUIZ_DECKS], "readonly", async (getStore) => {
      const store = getStore(STORE_QUIZ_DECKS);
      const data = (await requestToPromise(store.getAll())) as StoredQuizDeck[];
      return data
        .map((raw) => normalizeQuizDeck(raw))
        .filter((d) => d.id.length > 0)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    });
  }

  async getQuizDeck(id: string): Promise<QuizDeck | undefined> {
    return withTransaction([STORE_QUIZ_DECKS], "readonly", async (getStore) => {
      const row = (await requestToPromise(getStore(STORE_QUIZ_DECKS).get(id))) as StoredQuizDeck | undefined;
      if (!row) {
        return undefined;
      }
      const deck = normalizeQuizDeck(row);
      return deck.id ? deck : undefined;
    });
  }

  async getQuizDecksByDeckKey(deckKey: string): Promise<QuizDeck[]> {
    const key = deckKey.trim();
    if (!key) {
      return [];
    }
    return withTransaction([STORE_QUIZ_DECKS], "readonly", async (getStore) => {
      const store = getStore(STORE_QUIZ_DECKS);
      const index = store.index("deckKey");
      const data = (await requestToPromise(index.getAll(key))) as StoredQuizDeck[];
      return data
        .map((raw) => normalizeQuizDeck(raw))
        .filter((d) => d.id.length > 0)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    });
  }

  async saveQuizDeck(deck: QuizDeck): Promise<void> {
    if (!deck.id?.trim()) {
      throw new Error("QuizDeck の id が空です。");
    }
    const titleTrim = deck.title?.trim() ?? "";
    if (!titleTrim) {
      throw new Error("QuizDeck の title が空です。");
    }
    const normalized = normalizeQuizDeck({ ...deck, title: titleTrim });
    return withTransaction([STORE_QUIZ_DECKS], "readwrite", async (getStore) => {
      await requestToPromise(getStore(STORE_QUIZ_DECKS).put(normalized));
    });
  }

  async deleteQuizDeck(id: string): Promise<void> {
    return withTransaction([STORE_QUIZ_DECKS], "readwrite", async (getStore) => {
      await requestToPromise(getStore(STORE_QUIZ_DECKS).delete(id));
    });
  }

  async getQuizAttemptLogs(): Promise<QuizAttemptLog[]> {
    return withTransaction([STORE_QUIZ_ATTEMPT_LOGS], "readonly", async (getStore) => {
      const store = getStore(STORE_QUIZ_ATTEMPT_LOGS);
      const data = (await requestToPromise(store.getAll())) as StoredQuizAttemptLog[];
      return data
        .map((raw) => normalizeQuizAttemptLog(raw))
        .filter((l) => l.id.length > 0 && l.questionId.length > 0)
        .sort((a, b) => b.answeredAt.localeCompare(a.answeredAt));
    });
  }

  async getQuizAttemptLogsByQuestionId(questionId: string): Promise<QuizAttemptLog[]> {
    return withTransaction([STORE_QUIZ_ATTEMPT_LOGS], "readonly", async (getStore) => {
      const store = getStore(STORE_QUIZ_ATTEMPT_LOGS);
      const index = store.index("questionId");
      const data = (await requestToPromise(index.getAll(questionId))) as StoredQuizAttemptLog[];
      return data
        .map((raw) => normalizeQuizAttemptLog(raw))
        .sort((a, b) => b.answeredAt.localeCompare(a.answeredAt));
    });
  }

  async saveQuizAttemptLog(log: QuizAttemptLog): Promise<void> {
    if (!log.id?.trim()) {
      throw new Error("QuizAttemptLog の id が空です。");
    }
    if (!log.questionId?.trim()) {
      throw new Error("QuizAttemptLog の questionId が空です。");
    }
    if (!log.selectedChoiceId?.trim() || !log.correctChoiceId?.trim()) {
      throw new Error("QuizAttemptLog の選択肢 ID が空です。");
    }
    return withTransaction([STORE_QUIZ_ATTEMPT_LOGS], "readwrite", async (getStore) => {
      const normalized = normalizeQuizAttemptLog(log);
      await requestToPromise(getStore(STORE_QUIZ_ATTEMPT_LOGS).put(normalized));
    });
  }

  async deleteQuizAttemptLog(id: string): Promise<void> {
    return withTransaction([STORE_QUIZ_ATTEMPT_LOGS], "readwrite", async (getStore) => {
      await requestToPromise(getStore(STORE_QUIZ_ATTEMPT_LOGS).delete(id));
    });
  }

  async clearQuizAttemptLogs(): Promise<void> {
    return withTransaction([STORE_QUIZ_ATTEMPT_LOGS], "readwrite", async (getStore) => {
      await requestToPromise(getStore(STORE_QUIZ_ATTEMPT_LOGS).clear());
    });
  }

  async exportConcepts(): Promise<Concept[]> {
    return this.getAllConcepts();
  }

  async exportBackupData(): Promise<{
    concepts: Concept[];
    contextCards: ContextCard[];
    quizQuestions: QuizQuestion[];
    quizDecks: QuizDeck[];
  }> {
    const concepts = await this.getAllConcepts();
    const contextStorage = new ContextCardIndexedDBStorage();
    const contextCards = await contextStorage.getAllContextCards();
    const quizQuestions = await this.getQuizQuestions();
    const quizDecks = await this.getQuizDecks();

    // Ensure contextDefinitions is present in each concept
    const conceptsWithContextDefs = concepts.map((concept) => ({
      ...concept,
      contextDefinitions: concept.contextDefinitions ?? []
    }));

    return { concepts: conceptsWithContextDefs, contextCards, quizQuestions, quizDecks };
  }

  async importConcepts(
    concepts: Concept[],
    mode: "replace" | "merge"
  ): Promise<{ imported: number; skipped: number }> {
    return withTransaction([STORE_CONCEPTS], "readwrite", async (getStore) => {
      const store = getStore(STORE_CONCEPTS);
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

  private async importQuizQuestions(
    questions: QuizQuestion[],
    mode: "replace" | "merge"
  ): Promise<{ imported: number; skipped: number }> {
    return withTransaction([STORE_QUIZ_QUESTIONS], "readwrite", async (getStore) => {
      const store = getStore(STORE_QUIZ_QUESTIONS);
      let imported = 0;
      let skipped = 0;
      if (mode === "replace") {
        await requestToPromise(store.clear());
      }
      for (const q of questions) {
        if (!q.id?.trim()) {
          skipped += 1;
          continue;
        }
        const normalized = normalizeQuizQuestion(q);
        if (mode === "merge") {
          const existingRaw = (await requestToPromise(store.get(normalized.id))) as StoredQuizQuestion | undefined;
          if (existingRaw) {
            const existing = normalizeQuizQuestion(existingRaw);
            const newer =
              existing.updatedAt.localeCompare(normalized.updatedAt) >= 0 ? existing : normalized;
            await requestToPromise(store.put(newer));
            imported += 1;
            continue;
          }
        }
        await requestToPromise(store.put(normalized));
        imported += 1;
      }
      return { imported, skipped };
    });
  }

  private async importQuizDecks(
    decks: QuizDeck[],
    mode: "replace" | "merge",
    validQuestionIds: Set<string>
  ): Promise<{ imported: number; skipped: number }> {
    return withTransaction([STORE_QUIZ_DECKS], "readwrite", async (getStore) => {
      const store = getStore(STORE_QUIZ_DECKS);
      let imported = 0;
      let skipped = 0;
      if (mode === "replace") {
        await requestToPromise(store.clear());
      }

      const prune = (d: QuizDeck): QuizDeck =>
        normalizeQuizDeck({
          ...d,
          questionIds: d.questionIds.filter((id) => validQuestionIds.has(id))
        });

      for (const rawDeck of decks) {
        const pruned = prune(rawDeck);
        if (!pruned.id.trim() || !pruned.title.trim()) {
          skipped += 1;
          continue;
        }
        if (mode === "merge") {
          const existingRaw = (await requestToPromise(store.get(pruned.id))) as StoredQuizDeck | undefined;
          if (existingRaw) {
            const existing = normalizeQuizDeck(existingRaw);
            const existingPruned = prune(existing);
            const newer =
              existingPruned.updatedAt.localeCompare(pruned.updatedAt) >= 0 ? existingPruned : pruned;
            await requestToPromise(store.put(normalizeQuizDeck(newer)));
            imported += 1;
            continue;
          }
        }
        await requestToPromise(store.put(pruned));
        imported += 1;
      }
      return { imported, skipped };
    });
  }

  async importBackupData(
    data: {
      concepts: Concept[];
      contextCards: ContextCard[];
      quizQuestions: QuizQuestion[];
      quizQuestionParseSkipped: number;
      quizDecks: QuizDeck[];
      quizDeckParseSkipped: number;
    },
    mode: "replace" | "merge"
  ): Promise<{
    importedConcepts: number;
    skippedConcepts: number;
    importedContextCards: number;
    skippedContextCards: number;
    importedQuizQuestions: number;
    skippedQuizQuestions: number;
    importedQuizDecks: number;
    skippedQuizDecks: number;
  }> {
    const conceptResult = await this.importConcepts(data.concepts, mode);
    const contextStorage = new ContextCardIndexedDBStorage();
    const contextCardResult = await contextStorage.importContextCards(data.contextCards, mode);

    const allConcepts = await this.getAllConcepts();
    const validConceptIds = new Set(allConcepts.map((c) => c.id));
    const quizSanitized = data.quizQuestions.map((q) => stripInvalidQuizReferences(q, validConceptIds));
    const quizResult = await this.importQuizQuestions(quizSanitized, mode);

    const skippedQuizQuestions = data.quizQuestionParseSkipped + quizResult.skipped;

    const validQuestionIds = new Set((await this.getQuizQuestions()).map((q) => q.id));
    const deckResult = await this.importQuizDecks(data.quizDecks, mode, validQuestionIds);
    const skippedQuizDecks = data.quizDeckParseSkipped + deckResult.skipped;

    return {
      importedConcepts: conceptResult.imported,
      skippedConcepts: conceptResult.skipped,
      importedContextCards: contextCardResult.imported,
      skippedContextCards: contextCardResult.skipped,
      importedQuizQuestions: quizResult.imported,
      skippedQuizQuestions,
      importedQuizDecks: deckResult.imported,
      skippedQuizDecks
    };
  }

  async addMedia(input: {
    conceptId: string;
    file: File;
    caption?: string;
  }): Promise<ConceptMediaRef> {
    const validated = validateMediaFile(input.file);
    if (!validated.ok) {
      throw new Error(validated.message);
    }

    return withTransaction([STORE_CONCEPTS, STORE_MEDIA], "readwrite", async (getStore) => {
      const conceptStore = getStore(STORE_CONCEPTS);
      const mediaStore = getStore(STORE_MEDIA);

      const existingRaw = (await requestToPromise(conceptStore.get(input.conceptId))) as
        | StoredConcept
        | undefined;
      if (!existingRaw) {
        throw new Error("概念が見つかりません。");
      }
      const { concept } = sanitizeConcept(existingRaw);
      const refs = concept.media ?? [];
      if (refs.length >= MAX_MEDIA_FILES_PER_CONCEPT) {
        throw new Error(`1概念あたり最大 ${MAX_MEDIA_FILES_PER_CONCEPT} 件までです。`);
      }

      const id = createMediaId();
      const now = nowIso();
      const record: MediaRecord = {
        id,
        conceptId: input.conceptId,
        kind: validated.kind,
        blob: input.file,
        mimeType: validated.mimeType,
        fileName: input.file.name,
        fileSize: input.file.size,
        caption: input.caption,
        createdAt: now,
        updatedAt: now
      };
      await requestToPromise(mediaStore.add(record));

      const sortOrder = refs.length === 0 ? 0 : Math.max(...refs.map((r) => r.sortOrder), 0) + 1;
      const ref: ConceptMediaRef = {
        id,
        kind: validated.kind,
        fileName: input.file.name,
        caption: input.caption,
        sortOrder
      };
      const nextConcept: Concept = {
        ...concept,
        media: [...refs, ref],
        updatedAt: nowIso()
      };
      await requestToPromise(conceptStore.put(nextConcept));
      return ref;
    });
  }

  async deleteMedia(mediaId: string): Promise<void> {
    await withTransaction([STORE_CONCEPTS, STORE_MEDIA], "readwrite", async (getStore) => {
      const conceptStore = getStore(STORE_CONCEPTS);
      const mediaStore = getStore(STORE_MEDIA);
      const record = (await requestToPromise(mediaStore.get(mediaId))) as MediaRecord | undefined;
      if (!record) {
        return;
      }
      await requestToPromise(mediaStore.delete(mediaId));
      const existingRaw = (await requestToPromise(conceptStore.get(record.conceptId))) as
        | StoredConcept
        | undefined;
      if (!existingRaw) {
        return;
      }
      const { concept } = sanitizeConcept(existingRaw);
      const nextMedia = (concept.media ?? []).filter((m) => m.id !== mediaId);
      const nextConcept: Concept = {
        ...concept,
        media: nextMedia.length > 0 ? nextMedia : undefined,
        updatedAt: nowIso()
      };
      await requestToPromise(conceptStore.put(nextConcept));
    });
  }

  async updateMediaCaption(mediaId: string, caption: string | undefined): Promise<void> {
    await withTransaction([STORE_CONCEPTS, STORE_MEDIA], "readwrite", async (getStore) => {
      const conceptStore = getStore(STORE_CONCEPTS);
      const mediaStore = getStore(STORE_MEDIA);
      const record = (await requestToPromise(mediaStore.get(mediaId))) as MediaRecord | undefined;
      if (!record) {
        return;
      }
      const now = nowIso();
      const nextRecord: MediaRecord = { ...record, caption, updatedAt: now };
      await requestToPromise(mediaStore.put(nextRecord));

      const existingRaw = (await requestToPromise(conceptStore.get(record.conceptId))) as
        | StoredConcept
        | undefined;
      if (!existingRaw) {
        return;
      }
      const { concept } = sanitizeConcept(existingRaw);
      const nextMedia = (concept.media ?? []).map((m) =>
        m.id === mediaId ? { ...m, caption } : m
      );
      await requestToPromise(
        conceptStore.put({
          ...concept,
          media: nextMedia.length > 0 ? nextMedia : undefined,
          updatedAt: now
        })
      );
    });
  }

  async getMediaBlob(mediaId: string): Promise<Blob | undefined> {
    return withTransaction([STORE_MEDIA], "readonly", async (getStore) => {
      const record = (await requestToPromise(getStore(STORE_MEDIA).get(mediaId))) as
        | MediaRecord
        | undefined;
      return record?.blob;
    });
  }

  async exportConceptBookPackage(): Promise<Blob> {
    const data = await this.exportBackupData();
    const mediaRecords: MediaRecord[] = [];
    const mediaFiles: { id: string; data: Uint8Array }[] = [];
    const seen = new Set<string>();

    // Transaction 内では IndexedDB アクセスのみ実行する。
    await withTransaction([STORE_MEDIA], "readonly", async (getStore) => {
      const mediaStore = getStore(STORE_MEDIA);
      for (const c of data.concepts) {
        for (const ref of c.media ?? []) {
          if (seen.has(ref.id)) {
            continue;
          }
          seen.add(ref.id);
          const rec = (await requestToPromise(mediaStore.get(ref.id))) as MediaRecord | undefined;
          if (!rec) {
            continue;
          }
          mediaRecords.push(rec);
        }
      }
    });

    // IDB transaction の外で Blob -> Uint8Array に変換する。
    for (const rec of mediaRecords) {
      const buf = await rec.blob.arrayBuffer();
      mediaFiles.push({ id: rec.id, data: new Uint8Array(buf) });
    }

    const json = JSON.stringify(data, null, 2);
    const zipped = buildConceptBookZip(json, mediaFiles);
    return new Blob([new Uint8Array(zipped)], { type: "application/zip" });
  }

  async importConceptBookPackage(
    file: File,
    mode: "replace" | "merge"
  ): Promise<{
    importedConcepts: number;
    skippedConcepts: number;
    importedContextCards: number;
    skippedContextCards: number;
    importedQuizQuestions: number;
    skippedQuizQuestions: number;
    importedQuizDecks: number;
    skippedQuizDecks: number;
    importedMedia: number;
    missingMedia: number;
  }> {
    const buffer = await file.arrayBuffer();
    const { conceptsText, mediaEntries } = parseConceptBookZip(buffer);
    const parsed: unknown = JSON.parse(conceptsText);

    const validation = validateBackupImportPayload(parsed);
    if (!validation.success) {
      throw new Error(validation.errorMessage);
    }

    if (mode === "replace") {
      await withTransaction(
        [STORE_CONCEPTS, STORE_MEDIA, STORE_QUIZ_QUESTIONS, STORE_QUIZ_DECKS],
        "readwrite",
        async (getStore) => {
          await requestToPromise(getStore(STORE_MEDIA).clear());
          await requestToPromise(getStore(STORE_CONCEPTS).clear());
          await requestToPromise(getStore(STORE_QUIZ_QUESTIONS).clear());
          await requestToPromise(getStore(STORE_QUIZ_DECKS).clear());
        }
      );
    }

    const {
      importedConcepts,
      skippedConcepts,
      importedContextCards,
      skippedContextCards,
      importedQuizQuestions,
      skippedQuizQuestions,
      importedQuizDecks,
      skippedQuizDecks
    } = await this.importBackupData(
      {
        concepts: validation.concepts,
        contextCards: validation.contextCards,
        quizQuestions: validation.quizQuestions,
        quizQuestionParseSkipped: validation.quizQuestionParseSkipped,
        quizDecks: validation.quizDecks,
        quizDeckParseSkipped: validation.quizDeckParseSkipped
      },
      mode
    );

    let importedMedia = 0;
    let missingMedia = 0;

    await withTransaction([STORE_CONCEPTS, STORE_MEDIA], "readwrite", async (getStore) => {
      const conceptStore = getStore(STORE_CONCEPTS);
      const mediaStore = getStore(STORE_MEDIA);

      const reconcileInTx = async (conceptId: string, nextRefs: ConceptMediaRef[]): Promise<void> => {
        const index = mediaStore.index("conceptId");
        const existing = (await requestToPromise(index.getAll(conceptId))) as MediaRecord[];
        const keep = new Set(nextRefs.map((r) => r.id));
        await Promise.all(
          existing
            .filter((r) => !keep.has(r.id))
            .map((r) => requestToPromise(mediaStore.delete(r.id)))
        );
      };

      for (const c of validation.concepts) {
        const row = (await requestToPromise(conceptStore.get(c.id))) as StoredConcept | undefined;
        if (!row) {
          continue;
        }
        const { concept: finalConcept } = sanitizeConcept(row);

        if (mode === "merge") {
          await reconcileInTx(finalConcept.id, finalConcept.media ?? []);
        }

        for (const ref of finalConcept.media ?? []) {
          const bytes = mediaEntries.get(ref.id);
          if (!bytes) {
            missingMedia += 1;
            continue;
          }
          const mime = guessMimeFromFileName(ref.fileName, ref.kind);
          const blob = new Blob([new Uint8Array(bytes)], { type: mime });
          const now = nowIso();
          const record: MediaRecord = {
            id: ref.id,
            conceptId: finalConcept.id,
            kind: ref.kind,
            blob,
            mimeType: mime,
            fileName: ref.fileName,
            fileSize: blob.size,
            caption: ref.caption,
            createdAt: now,
            updatedAt: now
          };
          await requestToPromise(mediaStore.put(record));
          importedMedia += 1;
        }
      }
    });

    return {
      importedConcepts,
      skippedConcepts,
      importedContextCards,
      skippedContextCards,
      importedQuizQuestions,
      skippedQuizQuestions,
      importedQuizDecks,
      skippedQuizDecks,
      importedMedia,
      missingMedia
    };
  }
}

const createContextCardId = (): string =>
  `context_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const sanitizeContextCard = (
  card: Partial<ContextCard>
): ContextCard => {
  const domainTags = Array.isArray(card.domainTags) ? card.domainTags.filter(Boolean) : [];
  const fallbackDomainTags = domainTags.length > 0 ? domainTags : (card.domain ? [card.domain] : []);
  return {
    id: card.id ?? createContextCardId(),
    title: card.title ?? "",
    domain: card.domain,
    domainTags: fallbackDomainTags,
    centralQuestion: card.centralQuestion ?? "",
    background: card.background ?? "",
    flow: card.flow ?? "",
    keyConcepts: card.keyConcepts ?? "",
    linkedConcepts: Array.isArray(card.linkedConcepts) ? card.linkedConcepts.filter(Boolean) : [],
    createdAt: card.createdAt ?? nowIso(),
    updatedAt: card.updatedAt ?? nowIso()
  };
};

export class ContextCardIndexedDBStorage implements ContextCardStorage {
  async getAllContextCards(): Promise<ContextCard[]> {
    return withTransaction([STORE_CONTEXT_CARDS], "readwrite", async (getStore) => {
      const store = getStore(STORE_CONTEXT_CARDS);
      const data = (await requestToPromise(store.getAll())) as Partial<ContextCard>[];
      const normalized = data.map((raw) => sanitizeContextCard(raw));
      return normalized.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    });
  }

  async getContextCardById(id: string): Promise<ContextCard | undefined> {
    return withTransaction([STORE_CONTEXT_CARDS], "readwrite", async (getStore) => {
      const store = getStore(STORE_CONTEXT_CARDS);
      const raw = (await requestToPromise(store.get(id))) as Partial<ContextCard> | undefined;
      return raw ? sanitizeContextCard(raw) : undefined;
    });
  }

  async createContextCard(input: ContextCardInput): Promise<ContextCard> {
    return withTransaction([STORE_CONTEXT_CARDS], "readwrite", async (getStore) => {
      const store = getStore(STORE_CONTEXT_CARDS);
      const now = nowIso();
      const domainTags = Array.isArray(input.domainTags) ? input.domainTags.map((tag) => tag.trim()).filter(Boolean) : [];
      const card: ContextCard = {
        ...input,
        id: createContextCardId(),
        domain: domainTags[0] || undefined,
        domainTags,
        linkedConcepts: Array.isArray(input.linkedConcepts) ? input.linkedConcepts.map((link) => link.trim()).filter(Boolean) : [],
        createdAt: now,
        updatedAt: now
      };
      await requestToPromise(store.add(card));
      return card;
    });
  }

  async updateContextCard(
    id: string,
    updates: Partial<ContextCardInput>
  ): Promise<ContextCard | undefined> {
    return withTransaction([STORE_CONTEXT_CARDS], "readwrite", async (getStore) => {
      const store = getStore(STORE_CONTEXT_CARDS);
      const existingRaw = (await requestToPromise(store.get(id))) as Partial<ContextCard> | undefined;
      if (!existingRaw) {
        return undefined;
      }
      const existing = sanitizeContextCard(existingRaw);
      const domainTags =
        updates.domainTags !== undefined
          ? updates.domainTags.map((tag) => tag.trim()).filter(Boolean)
          : existing.domainTags;
      const updated: ContextCard = {
        ...existing,
        ...updates,
        domain: domainTags[0] || existing.domain,
        domainTags,
        linkedConcepts:
          updates.linkedConcepts !== undefined
            ? updates.linkedConcepts.map((link) => link.trim()).filter(Boolean)
            : existing.linkedConcepts,
        updatedAt: nowIso()
      };
      await requestToPromise(store.put(updated));
      return updated;
    });
  }

  async deleteContextCard(id: string): Promise<void> {
    await withTransaction([STORE_CONTEXT_CARDS], "readwrite", async (getStore) => {
      const store = getStore(STORE_CONTEXT_CARDS);
      await requestToPromise(store.delete(id));
    });
  }

  async importContextCards(
    contextCards: ContextCard[],
    mode: "replace" | "merge"
  ): Promise<{ imported: number; skipped: number }> {
    return withTransaction([STORE_CONTEXT_CARDS], "readwrite", async (getStore) => {
      const store = getStore(STORE_CONTEXT_CARDS);
      let imported = 0;
      let skipped = 0;
      if (mode === "replace") {
        await requestToPromise(store.clear());
      }

      for (const raw of contextCards) {
        if (!raw?.id || !raw?.title) {
          skipped += 1;
          continue;
        }
        const card = sanitizeContextCard(raw);
        if (mode === "merge") {
          const existing = (await requestToPromise(store.get(card.id))) as ContextCard | undefined;
          if (existing) {
            const newer =
              existing.updatedAt.localeCompare(card.updatedAt) >= 0 ? existing : card;
            await requestToPromise(store.put(newer));
            imported += 1;
            continue;
          }
        }
        await requestToPromise(store.put(card));
        imported += 1;
      }
      return { imported, skipped };
    });
  }
}
