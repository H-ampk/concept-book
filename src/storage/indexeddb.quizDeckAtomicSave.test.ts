import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  QUIZ_DECK_SCHEMA_VERSION,
  QUIZ_QUESTION_SCHEMA_VERSION,
  type QuizDeck,
  type QuizQuestion
} from "../types/quiz";
import { IndexedDBStorage } from "./indexeddb";

const iso = "2026-01-01T00:00:00.000Z";

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

const deleteDb = (): Promise<void> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase("concept-book-db");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });

const idsOf = (items: { id: string }[]): string[] => items.map((item) => item.id).sort();

describe("IndexedDBStorage quiz deck atomic save", () => {
  let storage: IndexedDBStorage;

  beforeEach(async () => {
    await deleteDb();
    storage = new IndexedDBStorage();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("3 Question と新規 Deck を同一 transaction で保存する", async () => {
    const questions = [question("q1"), question("q2"), question("q3")];
    const nextDeck = deck("d1", ["q1", "q2", "q3"], { title: "新規デッキ" });

    await storage.saveQuizQuestionsAndDeck(questions, nextDeck);

    expect(idsOf(await storage.getQuizQuestions())).toEqual(["q1", "q2", "q3"]);
    const saved = await storage.getQuizDeck("d1");
    expect(saved?.questionIds).toEqual(["q1", "q2", "q3"]);
  });

  it("3問目の Question put 失敗時は Question / Deck を確定しない", async () => {
    const originalPut = IDBObjectStore.prototype.put;
    let questionPutCount = 0;
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (this: IDBObjectStore, value, key) {
      if (this.name === "quizQuestions") {
        questionPutCount += 1;
        if (questionPutCount === 3) {
          throw new Error("injected third question failure");
        }
      }
      return originalPut.call(this, value, key);
    });

    await expect(
      storage.saveQuizQuestionsAndDeck(
        [question("q1"), question("q2"), question("q3")],
        deck("d1", ["q1", "q2", "q3"], { title: "新規デッキ" })
      )
    ).rejects.toThrow("injected third question failure");

    vi.restoreAllMocks();
    expect(await storage.getQuizQuestions()).toEqual([]);
    expect(await storage.getQuizDeck("d1")).toBeUndefined();
  });

  it("Deck put 失敗時は新規 Question を orphan として残さない", async () => {
    await storage.saveQuizQuestion(question("old_q"));
    await storage.saveQuizDeck(deck("old_d", ["old_q"], { title: "既存デッキ" }));

    const originalPut = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (this: IDBObjectStore, value, key) {
      if (this.name === "quizDecks") {
        throw new Error("injected quizDecks put failure");
      }
      return originalPut.call(this, value, key);
    });

    await expect(
      storage.saveQuizQuestionsAndDeck(
        [question("q1"), question("q2"), question("q3")],
        deck("d1", ["q1", "q2", "q3"], { title: "新規デッキ" })
      )
    ).rejects.toThrow("injected quizDecks put failure");

    vi.restoreAllMocks();
    expect(idsOf(await storage.getQuizQuestions())).toEqual(["old_q"]);
    expect(await storage.getQuizDeck("d1")).toBeUndefined();
    expect((await storage.getQuizDeck("old_d"))?.questionIds).toEqual(["old_q"]);
  });

  it("sync 相当の Deck 更新失敗時は既存 membership を保ち新規 Question を残さない", async () => {
    await storage.saveQuizQuestion(question("q1"));
    await storage.saveQuizDeck(deck("d1", ["q1"], { title: "同期デッキ" }));

    const originalPut = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (this: IDBObjectStore, value, key) {
      if (this.name === "quizDecks") {
        throw new Error("injected quizDecks put failure");
      }
      return originalPut.call(this, value, key);
    });

    await expect(
      storage.saveQuizQuestionsAndDeck(
        [question("q2"), question("q3")],
        deck("d1", ["q1", "q2", "q3"], { title: "同期デッキ" })
      )
    ).rejects.toThrow("injected quizDecks put failure");

    vi.restoreAllMocks();
    expect(idsOf(await storage.getQuizQuestions())).toEqual(["q1"]);
    expect((await storage.getQuizDeck("d1"))?.questionIds).toEqual(["q1"]);
  });

  it("失敗後の retry で Question が増殖しない", async () => {
    const questions = [question("q1"), question("q2"), question("q3")];
    const nextDeck = deck("d1", ["q1", "q2", "q3"], { title: "retryデッキ" });

    const originalPut = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (this: IDBObjectStore, value, key) {
      if (this.name === "quizDecks") {
        throw new Error("injected quizDecks put failure");
      }
      return originalPut.call(this, value, key);
    });

    await expect(storage.saveQuizQuestionsAndDeck(questions, nextDeck)).rejects.toThrow(
      "injected quizDecks put failure"
    );

    vi.restoreAllMocks();
    expect(await storage.getQuizQuestions()).toEqual([]);
    expect(await storage.getQuizDeck("d1")).toBeUndefined();

    await storage.saveQuizQuestionsAndDeck(questions, nextDeck);

    expect(idsOf(await storage.getQuizQuestions())).toEqual(["q1", "q2", "q3"]);
    expect((await storage.getQuizDeck("d1"))?.questionIds).toEqual(["q1", "q2", "q3"]);
  });

  it("手動追加で Deck get が失敗すると Question も保存しない", async () => {
    await storage.saveQuizQuestion(question("q1"));
    await storage.saveQuizDeck(deck("d1", ["q1"], { title: "既存" }));

    const originalGet = IDBObjectStore.prototype.get;
    vi.spyOn(IDBObjectStore.prototype, "get").mockImplementation(function (this: IDBObjectStore, query) {
      if (this.name === "quizDecks") {
        throw new Error("injected quizDecks get failure");
      }
      return originalGet.call(this, query);
    });

    await expect(storage.saveQuizQuestionAndAppendToDeck(question("q2"), "d1")).rejects.toThrow(
      "injected quizDecks get failure"
    );

    vi.restoreAllMocks();
    expect(idsOf(await storage.getQuizQuestions())).toEqual(["q1"]);
    expect((await storage.getQuizDeck("d1"))?.questionIds).toEqual(["q1"]);
  });

  it("手動追加で Deck put が失敗すると Question も保存しない", async () => {
    await storage.saveQuizQuestion(question("q1"));
    await storage.saveQuizDeck(deck("d1", ["q1"], { title: "既存" }));

    const originalPut = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (this: IDBObjectStore, value, key) {
      if (this.name === "quizDecks") {
        throw new Error("injected quizDecks put failure");
      }
      return originalPut.call(this, value, key);
    });

    await expect(storage.saveQuizQuestionAndAppendToDeck(question("q2"), "d1")).rejects.toThrow(
      "injected quizDecks put failure"
    );

    vi.restoreAllMocks();
    expect(idsOf(await storage.getQuizQuestions())).toEqual(["q1"]);
    expect((await storage.getQuizDeck("d1"))?.questionIds).toEqual(["q1"]);
  });

  it("手動追加の成功時は Question を保存し Deck membership に追加する", async () => {
    await storage.saveQuizQuestion(question("q1"));
    await storage.saveQuizDeck(deck("d1", ["q1"], { title: "既存" }));

    const updated = await storage.saveQuizQuestionAndAppendToDeck(question("q2"), "d1");

    expect(updated.questionIds).toEqual(["q1", "q2"]);
    expect(idsOf(await storage.getQuizQuestions())).toEqual(["q1", "q2"]);
    expect((await storage.getQuizDeck("d1"))?.questionIds).toEqual(["q1", "q2"]);
  });

  it("Deck が見つからない場合は fallback せず Question も保存しない", async () => {
    await expect(storage.saveQuizQuestionAndAppendToDeck(question("q2"), "missing")).rejects.toThrow(
      "QuizDeck missing が見つかりません。"
    );
    expect(await storage.getQuizQuestions()).toEqual([]);
  });
});
