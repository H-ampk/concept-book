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
import { IndexedDBStorage } from "./indexeddb";
import { subscribeQuizLearningRevision, type QuizLearningRevisionChange } from "./quizLearningRevision";

const iso = "2026-01-01T00:00:00.000Z";

const concept = (id: string): Concept => ({
  ...createEmptyConceptInput(),
  id,
  title: id,
  createdAt: iso,
  updatedAt: iso
});

const contextCard = (id: string): ContextCard => ({
  ...createEmptyContextCardInput(),
  id,
  title: id,
  createdAt: iso,
  updatedAt: iso
});

const question = (id: string): QuizQuestion => ({
  id,
  questionType: "multiple-choice",
  prompt: id,
  choices: [
    { id: "a", text: "A" },
    { id: "b", text: "B" }
  ],
  correctChoiceId: "a",
  visibility: "private",
  schemaVersion: QUIZ_QUESTION_SCHEMA_VERSION,
  createdAt: iso,
  updatedAt: iso
});

const deck = (id: string, questionIds: string[]): QuizDeck => ({
  id,
  title: id,
  questionIds,
  visibility: "private",
  schemaVersion: QUIZ_DECK_SCHEMA_VERSION,
  createdAt: iso,
  updatedAt: iso
});

const log = (id: string, questionId: string): QuizAttemptLog => ({
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
  schemaVersion: QUIZ_ATTEMPT_LOG_SCHEMA_VERSION
});

const parseSkipped = {
  quizQuestionParseSkipped: 0,
  quizDeckParseSkipped: 0,
  quizAttemptLogParseSkipped: 0
};

const deleteDb = (): Promise<void> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase("concept-book-db");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });

describe("quiz learning revision writes", () => {
  let storage: IndexedDBStorage;
  let changes: QuizLearningRevisionChange[];
  let unsubscribe: () => void;

  beforeEach(async () => {
    await deleteDb();
    storage = new IndexedDBStorage();
    changes = [];
    unsubscribe = subscribeQuizLearningRevision((change) => {
      changes.push(change);
    });
  });

  afterEach(async () => {
    unsubscribe();
    vi.restoreAllMocks();
    await deleteDb();
  });

  it("問題とデッキの一括保存が成功したときだけ問題の変更を通知する", async () => {
    await expect(storage.saveQuizQuestionsAndDeck([question("q1")], { ...deck("d1", ["q1"]), title: " " })).rejects.toThrow();
    expect(changes).toEqual([]);

    const originalPut = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (this: IDBObjectStore, value, key) {
      if (this.name === "quizQuestions") {
        throw new Error("injected question put failure");
      }
      return originalPut.call(this, value, key);
    });
    await expect(storage.saveQuizQuestionsAndDeck([question("q1")], deck("d1", ["q1"]))).rejects.toThrow(
      "injected question put failure"
    );
    expect(changes).toEqual([]);
    vi.restoreAllMocks();

    await storage.saveQuizQuestionsAndDeck([question("q1")], deck("d1", ["q1"]));
    expect(changes).toEqual([{ logs: false, questions: true }]);
    expect((await storage.getQuizQuestions()).map((item) => item.id)).toEqual(["q1"]);
  });

  it("マージ取り込みは確定した問題の直後に通知し、後続失敗ではログを通知しない", async () => {
    vi.spyOn(
      IndexedDBStorage.prototype as unknown as {
        importQuizDecks: (decks: QuizDeck[], mode: "merge", ids: Set<string>) => Promise<unknown>;
      },
      "importQuizDecks"
    ).mockRejectedValue(new Error("deck failed"));

    await expect(
      storage.importBackupData(
        {
          concepts: [concept("c1")],
          contextCards: [contextCard("ctx")],
          quizQuestions: [question("q-new")],
          quizDecks: [deck("d-new", ["q-new"])],
          quizAttemptLogs: [log("log-new", "q-new")],
          ...parseSkipped
        },
        "merge"
      )
    ).rejects.toThrow("deck failed");

    expect(changes).toEqual([{ logs: false, questions: true }]);
    expect((await storage.getQuizQuestions()).map((item) => item.id)).toEqual(["q-new"]);
    expect(await storage.getQuizAttemptLogs()).toEqual([]);
  });

  it("ZIP の replace はデータ置換の直後、PDF 復元の前に通知する", async () => {
    vi.spyOn(IndexedDBStorage.prototype, "saveLearningMaterial").mockRejectedValue(new Error("pdf failed"));
    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
    const payload = {
      concepts: [concept("c1")],
      contextCards: [contextCard("ctx")],
      quizQuestions: [question("q1")],
      quizDecks: [deck("d1", ["q1"])],
      quizAttemptLogs: [log("log-1", "q1")],
      learningMaterials: [
        {
          id: "pdf-1",
          contextCardId: "ctx",
          type: "pdf",
          title: "資料",
          fileName: "a.pdf",
          mimeType: "application/pdf",
          fileSize: pdf.byteLength,
          createdAt: iso,
          updatedAt: iso
        }
      ]
    };
    const zipped = buildConceptBookZip(JSON.stringify(payload), [], [{ id: "pdf-1", data: pdf }]);
    const file = new File([new Uint8Array(zipped)], "backup.zip", { type: "application/zip" });

    await expect(storage.importConceptBookPackage(file, "replace")).rejects.toThrow("pdf failed");
    expect(changes).toEqual([{ logs: true, questions: true }]);
    expect((await storage.getQuizQuestions()).map((item) => item.id)).toEqual(["q1"]);
    expect((await storage.getQuizAttemptLogs()).map((item) => item.id)).toEqual(["log-1"]);
  });
});
