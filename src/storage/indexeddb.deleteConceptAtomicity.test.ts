import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyConceptInput, type Concept } from "../types/concept";
import {
  DATA_LAB_ANALYSIS_SNAPSHOT_SCHEMA_VERSION,
  type ResearchReport
} from "../types/researchReport";
import {
  QUIZ_ATTEMPT_LOG_SCHEMA_VERSION,
  QUIZ_DECK_SCHEMA_VERSION,
  QUIZ_QUESTION_SCHEMA_VERSION,
  type QuizAttemptLog,
  type QuizDeck,
  type QuizQuestion
} from "../types/quiz";
import { DEFAULT_DATA_LAB_FILTERS } from "../utils/dataLab/filterDataLabLogs";
import { ContextCardIndexedDBStorage, IndexedDBStorage } from "./indexeddb";

const iso = "2026-01-01T00:00:00.000Z";
const CTX_DEF_A = "ctx_a_1";
const pngBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const pngFile = (name = "pic.png"): File => new File([pngBytes], name, { type: "image/png" });

const concept = (id: string, extras: Partial<Concept> = {}): Concept => ({
  ...createEmptyConceptInput(),
  id,
  title: extras.title ?? id,
  createdAt: iso,
  updatedAt: iso,
  ...extras
});

const question = (overrides: Partial<QuizQuestion> = {}): QuizQuestion => ({
  id: "q-a",
  questionType: "multiple-choice",
  prompt: "A の問い",
  choices: [
    {
      id: "a",
      text: "オペラント条件づけ",
      displayText: "○○条件づけ",
      linkedConceptId: "A",
      sourceConceptId: "A",
      contextDefinitionId: CTX_DEF_A,
      sourceStrategy: "same-context"
    },
    { id: "b", text: "誤答" }
  ],
  correctChoiceId: "a",
  visibility: "private",
  schemaVersion: QUIZ_QUESTION_SCHEMA_VERSION,
  createdAt: iso,
  updatedAt: iso,
  conceptId: "A",
  source: {
    type: "contextualConceptCard",
    sourceId: `A:${CTX_DEF_A}`,
    sourceTitle: "A / 文脈"
  },
  ...overrides
});

const deleteDb = (): Promise<void> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase("concept-book-db");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });

const blobMeta = async (blob: Blob | undefined) =>
  blob ? { exists: true, size: blob.size, type: blob.type } : { exists: false };

type SeededDeleteState = {
  storage: IndexedDBStorage;
  contextStorage: ContextCardIndexedDBStorage;
  mediaId: string;
  cardId: string;
};

const seedDeleteGraph = async (
  storage: IndexedDBStorage,
  contextStorage: ContextCardIndexedDBStorage
): Promise<SeededDeleteState> => {
  await storage.importConcepts(
    [
      concept("A", { relatedIds: ["B"] }),
      concept("B", { relatedIds: ["A"], prerequisiteIds: ["A"] })
    ],
    "replace"
  );
  const mediaRef = await storage.addMedia({ conceptId: "A", file: pngFile("a.png") });
  await storage.addMedia({ conceptId: "B", file: pngFile("b.png") });
  await storage.saveConceptSourceAnchor({
    id: "anchor-a",
    materialId: "material-1",
    conceptId: "A",
    pageIndex: 0,
    rects: [{ x: 0.1, y: 0.1, width: 0.2, height: 0.1 }],
    createdAt: iso,
    updatedAt: iso
  });
  await storage.saveConceptSourceAnchor({
    id: "anchor-b",
    materialId: "material-1",
    conceptId: "B",
    pageIndex: 1,
    rects: [{ x: 0.3, y: 0.3, width: 0.2, height: 0.1 }],
    createdAt: iso,
    updatedAt: iso
  });
  await storage.saveQuizQuestion(question());
  await storage.saveQuizQuestion(
    question({
      id: "q-b",
      prompt: "B の問い",
      conceptId: "B",
      source: {
        type: "contextualConceptCard",
        sourceId: "B:ctx_b",
        sourceTitle: "B / 文脈"
      },
      choices: [
        {
          id: "a",
          text: "古典的条件づけ",
          linkedConceptId: "B",
          sourceConceptId: "B",
          contextDefinitionId: "ctx_b"
        },
        { id: "b", text: "誤答B" }
      ]
    })
  );
  const cardA = await contextStorage.createContextCard({
    title: "カードA",
    domainTags: ["心理学"],
    centralQuestion: "Q",
    background: "",
    flow: "",
    keyConcepts: "",
    linkedConcepts: ["A", "B"]
  });
  await contextStorage.createContextCard({
    title: "カードB",
    domainTags: ["心理学"],
    centralQuestion: "Q2",
    background: "",
    flow: "",
    keyConcepts: "",
    linkedConcepts: ["B"]
  });
  await storage.saveQuizDeck({
    id: "deck-1",
    title: "Deck",
    questionIds: ["q-a", "q-b"],
    visibility: "private",
    schemaVersion: QUIZ_DECK_SCHEMA_VERSION,
    createdAt: iso,
    updatedAt: iso
  } satisfies QuizDeck);
  await storage.saveQuizAttemptLog({
    id: "log-a",
    conceptId: "A",
    questionId: "q-a",
    questionType: "multiple-choice",
    questionPromptSnapshot: "A の問い",
    questionConceptId: "A",
    selectedChoiceId: "a",
    selectedChoiceTextSnapshot: "オペラント条件づけ",
    selectedLinkedConceptId: "A",
    correctChoiceId: "a",
    correctChoiceTextSnapshot: "オペラント条件づけ",
    correctLinkedConceptId: "A",
    correct: true,
    startedAt: iso,
    answeredAt: iso,
    timeMs: 1000,
    schemaVersion: QUIZ_ATTEMPT_LOG_SCHEMA_VERSION
  } satisfies QuizAttemptLog);
  await storage.saveResearchReport({
    id: "report-1",
    title: "分析",
    createdAt: iso,
    updatedAt: iso,
    blocks: [
      {
        id: "block-1",
        type: "data-lab-analysis",
        commentary: "note",
        snapshot: {
          schemaVersion: DATA_LAB_ANALYSIS_SNAPSHOT_SCHEMA_VERSION,
          createdAt: iso,
          source: "data-lab",
          filters: {
            ...DEFAULT_DATA_LAB_FILTERS,
            conceptIds: ["A", "B"],
            deckIds: ["deck-1"]
          },
          filterChips: [],
          filterLabels: [],
          groupBy: "concept",
          metric: "accuracy",
          displayMode: "table",
          sourceLogCount: 1,
          rows: [],
          totalRowCount: 0,
          savedRowCount: 0,
          truncated: false
        }
      }
    ]
  } satisfies ResearchReport);
  return { storage, contextStorage, mediaId: mediaRef.id, cardId: cardA.id };
};

const snapshotDeleteRelevantState = async (
  storage: IndexedDBStorage,
  contextStorage: ContextCardIndexedDBStorage,
  mediaId: string
) => {
  const conceptA = await storage.getConceptById("A");
  const media = await storage.getMediaBlob(mediaId);
  return {
    conceptA,
    conceptB: await storage.getConceptById("B"),
    media: await blobMeta(media),
    conceptAMediaIds: conceptA?.media?.map((item) => item.id) ?? [],
    anchorsA: await storage.getAnchorsByConceptId("A"),
    anchorsB: await storage.getAnchorsByConceptId("B"),
    questions: await storage.getQuizQuestions(),
    cards: await contextStorage.getAllContextCards(),
    decks: await storage.getQuizDecks(),
    logs: await storage.getQuizAttemptLogs(),
    report: await storage.getResearchReport("report-1")
  };
};

describe("deleteConcept atomicity (#198)", () => {
  let storage: IndexedDBStorage;
  let contextStorage: ContextCardIndexedDBStorage;

  beforeEach(async () => {
    await deleteDb();
    storage = new IndexedDBStorage();
    contextStorage = new ContextCardIndexedDBStorage();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await deleteDb();
  });

  it("成功時は live refs だけ掃除し historical data は保持する", async () => {
    const { mediaId, cardId } = await seedDeleteGraph(storage, contextStorage);
    const logBefore = (await storage.getQuizAttemptLogs()).find((item) => item.id === "log-a");
    const reportBefore = await storage.getResearchReport("report-1");
    const bMediaBefore = (await storage.getConceptById("B"))?.media;

    await storage.deleteConcept("A");

    expect(await storage.getConceptById("A")).toBeUndefined();
    expect(await storage.getMediaBlob(mediaId)).toBeUndefined();
    expect(await storage.getAnchorsByConceptId("A")).toEqual([]);

    const remainingB = await storage.getConceptById("B");
    expect(remainingB).toBeDefined();
    expect(remainingB?.relatedIds).toEqual([]);
    expect(remainingB?.prerequisiteIds).toEqual([]);
    expect(remainingB?.media).toEqual(bMediaBefore);
    expect((await storage.getAnchorsByConceptId("B"))[0]?.id).toBe("anchor-b");

    const questions = await storage.getQuizQuestions();
    const savedA = questions.find((item) => item.id === "q-a");
    const savedB = questions.find((item) => item.id === "q-b");
    expect(savedA).toBeDefined();
    expect(savedA?.conceptId).toBeUndefined();
    expect(savedA?.source).toBeUndefined();
    const choiceA = savedA?.choices.find((item) => item.id === "a");
    expect(choiceA).not.toHaveProperty("linkedConceptId");
    expect(choiceA).not.toHaveProperty("sourceConceptId");
    expect(choiceA).not.toHaveProperty("contextDefinitionId");
    expect(savedB?.conceptId).toBe("B");
    expect(savedB?.choices.find((item) => item.id === "a")?.linkedConceptId).toBe("B");

    const cards = await contextStorage.getAllContextCards();
    expect(cards.find((item) => item.id === cardId)?.linkedConcepts).toEqual(["B"]);
    expect(cards.find((item) => item.title === "カードB")?.linkedConcepts).toEqual(["B"]);

    expect((await storage.getQuizDecks())[0]?.questionIds).toEqual(["q-a", "q-b"]);
    expect((await storage.getQuizAttemptLogs()).find((item) => item.id === "log-a")).toEqual(logBefore);
    expect(await storage.getResearchReport("report-1")).toEqual(reportBefore);
  });

  it("media / anchor なしの Concept も削除できる", async () => {
    await storage.importConcepts([concept("A"), concept("B")], "replace");
    await storage.deleteConcept("A");
    expect(await storage.getConceptById("A")).toBeUndefined();
    expect(await storage.getConceptById("B")).toBeDefined();
  });

  it("存在しない Concept の削除は no-op で他データを壊さない", async () => {
    const { mediaId } = await seedDeleteGraph(storage, contextStorage);
    const before = await snapshotDeleteRelevantState(storage, contextStorage, mediaId);
    await storage.deleteConcept("missing");
    const after = await snapshotDeleteRelevantState(storage, contextStorage, mediaId);
    expect(after).toEqual(before);
  });

  it("quizQuestions put 失敗時は media / anchor を含め完全 rollback する", async () => {
    const { mediaId } = await seedDeleteGraph(storage, contextStorage);
    const before = await snapshotDeleteRelevantState(storage, contextStorage, mediaId);
    const originalPut = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (this: IDBObjectStore, value, key) {
      if (this.name === "quizQuestions") {
        throw new Error("injected quizQuestions put failure");
      }
      return originalPut.call(this, value, key);
    });

    await expect(storage.deleteConcept("A")).rejects.toThrow("injected quizQuestions put failure");
    expect(await snapshotDeleteRelevantState(storage, contextStorage, mediaId)).toEqual(before);

    vi.restoreAllMocks();
    await storage.deleteConcept("A");
    expect(await storage.getConceptById("A")).toBeUndefined();
    expect(await storage.getMediaBlob(mediaId)).toBeUndefined();
  });

  it("Concept 本体 delete 失敗時は先行 cleanup も rollback する", async () => {
    const { mediaId } = await seedDeleteGraph(storage, contextStorage);
    const before = await snapshotDeleteRelevantState(storage, contextStorage, mediaId);
    const originalDelete = IDBObjectStore.prototype.delete;
    vi.spyOn(IDBObjectStore.prototype, "delete").mockImplementation(function (this: IDBObjectStore, key) {
      if (this.name === "concepts" && key === "A") {
        throw new Error("injected concept delete failure");
      }
      return originalDelete.call(this, key);
    });

    await expect(storage.deleteConcept("A")).rejects.toThrow("injected concept delete failure");
    expect(await snapshotDeleteRelevantState(storage, contextStorage, mediaId)).toEqual(before);

    vi.restoreAllMocks();
    await storage.deleteConcept("A");
    expect(await storage.getConceptById("A")).toBeUndefined();
  });

  it("peer Concept put 失敗時は対象 Concept の delete 自体も rollback する", async () => {
    const { mediaId } = await seedDeleteGraph(storage, contextStorage);
    const before = await snapshotDeleteRelevantState(storage, contextStorage, mediaId);
    const originalPut = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (this: IDBObjectStore, value, key) {
      if (
        this.name === "concepts" &&
        value !== undefined &&
        typeof value === "object" &&
        value !== null &&
        "id" in value &&
        (value as { id: unknown }).id === "B"
      ) {
        throw new Error("injected peer concept put failure");
      }
      return originalPut.call(this, value, key);
    });

    await expect(storage.deleteConcept("A")).rejects.toThrow("injected peer concept put failure");
    const after = await snapshotDeleteRelevantState(storage, contextStorage, mediaId);
    expect(after.conceptA).toEqual(before.conceptA);
    expect(after.conceptB).toEqual(before.conceptB);
    expect(after).toEqual(before);

    vi.restoreAllMocks();
    await storage.deleteConcept("A");
    expect(await storage.getConceptById("A")).toBeUndefined();
    expect((await storage.getConceptById("B"))?.relatedIds).toEqual([]);
    expect((await storage.getConceptById("B"))?.prerequisiteIds).toEqual([]);
  });
});
