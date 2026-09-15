import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyConceptInput, type Concept } from "../types/concept";
import { createEmptyContextCardInput, type ContextCard } from "../types/contextCard";
import {
  QUIZ_ATTEMPT_LOG_SCHEMA_VERSION,
  QUIZ_DECK_SCHEMA_VERSION,
  QUIZ_QUESTION_SCHEMA_VERSION,
  type QuizAttemptLog,
  type QuizDeck,
  type QuizQuestion
} from "../types/quiz";
import { buildConceptBookZip } from "../utils/conceptBookZip";
import { ContextCardIndexedDBStorage, IndexedDBStorage } from "./indexeddb";

const iso = "2026-01-01T00:00:00.000Z";

const concept = (id: string, extras: Partial<Concept> = {}): Concept => ({
  ...createEmptyConceptInput(),
  id,
  title: extras.title ?? id,
  createdAt: iso,
  updatedAt: iso,
  ...extras
});

const contextCard = (id: string, extras: Partial<ContextCard> = {}): ContextCard => ({
  ...createEmptyContextCardInput(),
  id,
  title: extras.title ?? id,
  createdAt: iso,
  updatedAt: iso,
  ...extras
});

const question = (id: string, extras: Partial<QuizQuestion> = {}): QuizQuestion => ({
  id,
  questionType: "multiple-choice",
  prompt: extras.prompt ?? id,
  choices: [
    { id: "a", text: "A" },
    { id: "b", text: "B" }
  ],
  correctChoiceId: "a",
  visibility: "private",
  schemaVersion: QUIZ_QUESTION_SCHEMA_VERSION,
  createdAt: iso,
  updatedAt: iso,
  ...extras
});

const deck = (id: string, questionIds: string[], extras: Partial<QuizDeck> = {}): QuizDeck => ({
  id,
  title: extras.title ?? id,
  questionIds,
  visibility: "private",
  schemaVersion: QUIZ_DECK_SCHEMA_VERSION,
  createdAt: iso,
  updatedAt: iso,
  ...extras
});

const log = (id: string, questionId: string, extras: Partial<QuizAttemptLog> = {}): QuizAttemptLog => ({
  id,
  questionId,
  questionType: "multiple-choice",
  questionPromptSnapshot: "q",
  selectedChoiceId: "a",
  selectedChoiceTextSnapshot: "A",
  correctChoiceId: "a",
  correctChoiceTextSnapshot: "A",
  correct: true,
  startedAt: iso,
  answeredAt: iso,
  timeMs: 10,
  schemaVersion: QUIZ_ATTEMPT_LOG_SCHEMA_VERSION,
  ...extras
});

const parseSkipped = {
  quizQuestionParseSkipped: 0,
  quizDeckParseSkipped: 0,
  quizAttemptLogParseSkipped: 0
};

const pngBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const pngFile = (name = "pic.png"): File => new File([pngBytes], name, { type: "image/png" });

const zipFileFrom = (
  payload: Record<string, unknown>,
  mediaFiles: { id: string; data: Uint8Array }[] = []
): File => {
  const zipped = buildConceptBookZip(JSON.stringify(payload), mediaFiles);
  return new File([new Uint8Array(zipped)], "backup.zip", { type: "application/zip" });
};

const deleteDb = (): Promise<void> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase("concept-book-db");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });

const seedOld = async (storage: IndexedDBStorage) => {
  await storage.importBackupData(
    {
      concepts: [concept("old_c", { title: "旧概念" })],
      contextCards: [contextCard("old_ctx", { title: "旧文脈" })],
      quizQuestions: [question("old_q", { prompt: "旧問い" })],
      quizDecks: [deck("old_d", ["old_q"], { title: "旧デッキ" })],
      quizAttemptLogs: [log("old_log", "old_q")],
      ...parseSkipped
    },
    "replace"
  );
  const created = await storage.getConceptById("old_c");
  if (!created) {
    throw new Error("seed failed");
  }
  const ref = await storage.addMedia({ conceptId: created.id, file: pngFile("old.png") });
  return ref;
};

const expectOldIntact = async (storage: IndexedDBStorage, mediaId: string) => {
  const contextStorage = new ContextCardIndexedDBStorage();
  expect((await storage.getConceptById("old_c"))?.title).toBe("旧概念");
  expect((await contextStorage.getContextCardById("old_ctx"))?.title).toBe("旧文脈");
  expect((await storage.getQuizQuestions()).map((q) => q.id)).toEqual(["old_q"]);
  expect((await storage.getQuizDecks()).map((d) => d.id)).toEqual(["old_d"]);
  expect((await storage.getQuizAttemptLogs()).map((row) => row.id)).toEqual(["old_log"]);
  expect(await storage.getMediaBlob(mediaId)).toBeDefined();
  expect(await storage.getConceptById("new_c")).toBeUndefined();
  expect((await storage.getQuizQuestions()).some((q) => q.id === "new_q")).toBe(false);
};

describe("replace import atomicity (#154)", () => {
  let storage: IndexedDBStorage;

  beforeEach(async () => {
    await deleteDb();
    storage = new IndexedDBStorage();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await deleteDb();
  });

  it("JSON replace 成功時は全ストアが新データになり media は空になる", async () => {
    const ref = await seedOld(storage);

    await storage.importBackupData(
      {
        concepts: [concept("new_c", { title: "新概念" })],
        contextCards: [contextCard("new_ctx", { title: "新文脈" })],
        quizQuestions: [question("new_q", { prompt: "新問い" })],
        quizDecks: [deck("new_d", ["new_q"], { title: "新デッキ" })],
        quizAttemptLogs: [log("new_log", "new_q")],
        ...parseSkipped
      },
      "replace"
    );

    expect((await storage.getConceptById("new_c"))?.title).toBe("新概念");
    expect(await storage.getConceptById("old_c")).toBeUndefined();
    expect((await new ContextCardIndexedDBStorage().getContextCardById("new_ctx"))?.title).toBe("新文脈");
    expect((await storage.getQuizQuestions()).map((q) => q.id)).toEqual(["new_q"]);
    const decks = await storage.getQuizDecks();
    expect(decks).toHaveLength(1);
    expect(decks[0]?.id).toBe("new_d");
    expect(decks[0]?.questionIds).toEqual(["new_q"]);
    expect((await storage.getQuizAttemptLogs()).map((row) => row.id)).toEqual(["new_log"]);
    expect(await storage.getMediaBlob(ref.id)).toBeUndefined();
    expect((await storage.getConceptById("new_c"))?.media === undefined || (await storage.getConceptById("new_c"))?.media?.length === 0).toBe(
      true
    );
  });

  it("JSON replace で QuizDeck 書き込み失敗時は旧データが残る", async () => {
    const ref = await seedOld(storage);
    const originalPut = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (this: IDBObjectStore, value, key) {
      if (this.name === "quizDecks") {
        throw new Error("injected quizDecks put failure");
      }
      return originalPut.call(this, value, key);
    });

    await expect(
      storage.importBackupData(
        {
          concepts: [concept("new_c", { title: "新概念" })],
          contextCards: [contextCard("new_ctx", { title: "新文脈" })],
          quizQuestions: [question("new_q", { prompt: "新問い" })],
          quizDecks: [deck("new_d", ["new_q"], { title: "新デッキ" })],
          quizAttemptLogs: [log("new_log", "new_q")],
          ...parseSkipped
        },
        "replace"
      )
    ).rejects.toThrow("injected quizDecks put failure");

    vi.restoreAllMocks();
    await expectOldIntact(storage, ref.id);
  });

  it("ZIP replace で循環 prerequisite なら reject し旧データが残る", async () => {
    const ref = await seedOld(storage);
    const cyclic = zipFileFrom({
      concepts: [
        concept("A", { title: "A", prerequisiteIds: ["B"] }),
        concept("B", { title: "B", prerequisiteIds: ["A"] })
      ],
      contextCards: [],
      quizQuestions: [],
      quizDecks: [],
      quizAttemptLogs: []
    });

    await expect(storage.importConceptBookPackage(cyclic, "replace")).rejects.toThrow();
    await expectOldIntact(storage, ref.id);
  });

  it("ZIP replace で後半 store の put 失敗時も旧データが残る", async () => {
    const ref = await seedOld(storage);
    const originalPut = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (this: IDBObjectStore, value, key) {
      if (this.name === "quizAttemptLogs") {
        throw new Error("injected quizAttemptLogs put failure");
      }
      return originalPut.call(this, value, key);
    });

    const zip = zipFileFrom({
      concepts: [concept("new_c", { title: "新概念" })],
      contextCards: [contextCard("new_ctx", { title: "新文脈" })],
      quizQuestions: [question("new_q", { prompt: "新問い" })],
      quizDecks: [deck("new_d", ["new_q"], { title: "新デッキ" })],
      quizAttemptLogs: [log("new_log", "new_q")]
    });

    await expect(storage.importConceptBookPackage(zip, "replace")).rejects.toThrow(
      "injected quizAttemptLogs put failure"
    );

    vi.restoreAllMocks();
    await expectOldIntact(storage, ref.id);
  });

  it("ZIP replace 成功時は Concept / Quiz / media blob まで置換される", async () => {
    const created = await storage.createConcept({
      ...createEmptyConceptInput(),
      title: "メディア付き"
    });
    const ref = await storage.addMedia({ conceptId: created.id, file: pngFile("zip.png") });
    const zipBlob = await storage.exportConceptBookPackage();

    await storage.createConcept({
      ...createEmptyConceptInput(),
      title: "ZIP前の別概念"
    });

    const result = await storage.importConceptBookPackage(
      new File([zipBlob], "backup.zip", { type: "application/zip" }),
      "replace"
    );

    expect(result.importedMedia).toBe(1);
    expect(result.missingMedia).toBe(0);
    expect(await storage.getConceptById(created.id)).toBeDefined();
    expect((await storage.getAllConcepts()).some((c) => c.title === "ZIP前の別概念")).toBe(false);
    const blob = await storage.getMediaBlob(ref.id);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob && blob.size > 0).toBe(true);
  });

  it("merge import は既存 Concept を消さない", async () => {
    await seedOld(storage);
    await storage.importBackupData(
      {
        concepts: [concept("merged_c", { title: "追加概念" })],
        contextCards: [],
        quizQuestions: [],
        quizDecks: [],
        quizAttemptLogs: [],
        ...parseSkipped
      },
      "merge"
    );

    expect((await storage.getConceptById("old_c"))?.title).toBe("旧概念");
    expect((await storage.getConceptById("merged_c"))?.title).toBe("追加概念");
    expect((await storage.getQuizDecks()).map((d) => d.id)).toEqual(["old_d"]);
  });
});
