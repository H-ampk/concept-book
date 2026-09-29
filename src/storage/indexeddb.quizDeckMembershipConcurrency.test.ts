import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  QUIZ_DECK_SCHEMA_VERSION,
  QUIZ_QUESTION_SCHEMA_VERSION,
  type QuizDeck,
  type QuizQuestion
} from "../types/quiz";
import { IndexedDBStorage } from "./indexeddb";
import { QuizDeckMembershipConflictError } from "./quizDeckQuestionIds";

const iso = "2026-01-01T00:00:00.000Z";

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

const membershipOf = async (storage: IndexedDBStorage, id: string): Promise<string[]> =>
  (await storage.getQuizDeck(id))?.questionIds ?? [];

describe("IndexedDBStorage quiz deck membership concurrency", () => {
  let storage: IndexedDBStorage;

  beforeEach(async () => {
    await deleteDb();
    storage = new IndexedDBStorage();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("並行追加でも B と C の両方が残る", async () => {
    await storage.saveQuizDeck(deck("d", ["A"], { title: "deck" }));

    await Promise.all([
      storage.addQuestionsToDeck("d", ["B"]),
      storage.addQuestionsToDeck("d", ["C"])
    ]);

    const ids = await membershipOf(storage, "d");
    expect(ids[0]).toBe("A");
    expect(new Set(ids)).toEqual(new Set(["A", "B", "C"]));
    expect(ids).toHaveLength(3);
  });

  it("順に追加すると [A, B, C] になる", async () => {
    await storage.saveQuizDeck(deck("d", ["A"], { title: "deck" }));
    await storage.addQuestionsToDeck("d", ["B"]);
    await storage.addQuestionsToDeck("d", ["C"]);
    expect(await membershipOf(storage, "d")).toEqual(["A", "B", "C"]);
  });

  it("同じ Question の並行追加は重複 ID を作らない", async () => {
    await storage.saveQuizDeck(deck("d", ["A"], { title: "deck" }));

    await Promise.all([
      storage.addQuestionsToDeck("d", ["B"]),
      storage.addQuestionsToDeck("d", ["B"])
    ]);

    expect(await membershipOf(storage, "d")).toEqual(["A", "B"]);
  });

  it("add と remove が競合しても並行追加された B は残る", async () => {
    await storage.saveQuizDeck(deck("d", ["A"], { title: "deck" }));

    await Promise.all([
      storage.addQuestionsToDeck("d", ["B"]),
      storage.removeQuestionsFromDeck("d", ["A"])
    ]);

    expect(await membershipOf(storage, "d")).toEqual(["B"]);
  });

  it("先行して保存された membership を、古い snapshot の追加 intent が消さない", async () => {
    await storage.saveQuizDeck(deck("d", ["A"], { title: "deck" }));
    await storage.addQuestionsToDeck("d", ["B"]);
    await storage.addQuestionsToDeck("d", ["C"]);
    expect(await membershipOf(storage, "d")).toEqual(["A", "B", "C"]);
  });

  it("stale な metadata 保存は先行 membership を上書きしない", async () => {
    await storage.saveQuizDeck(
      deck("d", ["A"], {
        title: "old",
        lastSyncedAt: iso,
        generationFilters: { targetDomainTag: "心理学", generationMode: "auto" }
      })
    );
    await storage.addQuestionsToDeck("d", ["B"]);

    const saved = await storage.saveQuizDeckMetadata(
      deck("d", ["A"], { title: "renamed", visibility: "shareable" })
    );

    expect(saved.questionIds).toEqual(["A", "B"]);
    expect(saved.title).toBe("renamed");
    expect(saved.visibility).toBe("shareable");
    expect(saved.lastSyncedAt).toBe(iso);
    expect(saved.generationFilters?.targetDomainTag).toBe("心理学");
    expect(await membershipOf(storage, "d")).toEqual(["A", "B"]);
  });

  it("未保存 id の metadata 保存は Deck を新規作成する", async () => {
    const saved = await storage.saveQuizDeckMetadata(deck("new_d", [], { title: "新規" }));
    expect(saved.title).toBe("新規");
    expect(saved.questionIds).toEqual([]);
    expect(await storage.getQuizDeck("new_d")).toMatchObject({ title: "新規", questionIds: [] });
  });

  it("stale な並び替えは競合になり、先行追加を消さない", async () => {
    await storage.saveQuizDeck(deck("d", ["A"], { title: "deck" }));
    await storage.addQuestionsToDeck("d", ["B"]);

    await expect(storage.reorderQuizDeckQuestions("d", ["A"], ["A"])).rejects.toBeInstanceOf(
      QuizDeckMembershipConflictError
    );
    expect(await membershipOf(storage, "d")).toEqual(["A", "B"]);
  });

  it("expected が一致する並び替えだけを保存する", async () => {
    await storage.saveQuizDeck(deck("d", ["A", "B"], { title: "deck" }));
    const saved = await storage.reorderQuizDeckQuestions("d", ["A", "B"], ["B", "A"]);
    expect(saved.questionIds).toEqual(["B", "A"]);
    expect(await membershipOf(storage, "d")).toEqual(["B", "A"]);
  });

  it("並び替えで membership を増減できない", async () => {
    await storage.saveQuizDeck(deck("d", ["A", "B"], { title: "deck" }));
    await expect(storage.reorderQuizDeckQuestions("d", ["A", "B"], ["A"])).rejects.toThrow(
      "並び替えでは問題の追加・削除はできません。"
    );
    expect(await membershipOf(storage, "d")).toEqual(["A", "B"]);
  });

  it("並び替えと追加が並行しても追加された Question は残る", async () => {
    await storage.saveQuizDeck(deck("d", ["A", "B"], { title: "deck" }));

    await Promise.all([
      storage.reorderQuizDeckQuestions("d", ["A", "B"], ["B", "A"]),
      storage.addQuestionsToDeck("d", ["C"])
    ]);

    const ids = await membershipOf(storage, "d");
    expect(new Set(ids)).toEqual(new Set(["A", "B", "C"]));
    expect(ids).toHaveLength(3);
  });

  it("再同期の append は先行 membership を残し、Question 保存と同じ transaction で失敗する", async () => {
    await storage.saveQuizQuestion(question("A"));
    await storage.saveQuizDeck(deck("d", ["A"], { title: "同期デッキ" }));
    await storage.addQuestionsToDeck("d", ["B"]);

    const originalPut = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (this: IDBObjectStore, value, key) {
      if (this.name === "quizDecks") {
        throw new Error("injected quizDecks put failure");
      }
      return originalPut.call(this, value, key);
    });

    await expect(
      storage.saveQuizQuestionsAndAppendToDeck([question("C")], "d", {
        lastSyncedAt: "2026-02-01T00:00:00.000Z"
      })
    ).rejects.toThrow("injected quizDecks put failure");

    vi.restoreAllMocks();
    expect((await storage.getQuizQuestions()).map((item) => item.id).sort()).toEqual(["A"]);
    expect(await membershipOf(storage, "d")).toEqual(["A", "B"]);
  });

  it("再同期の append は最新 membership へ足し、generatedQuestionCount を実数にする", async () => {
    await storage.saveQuizQuestion(question("A"));
    await storage.saveQuizDeck(
      deck("d", ["A"], {
        title: "同期デッキ",
        generationSummary: {
          targetConceptCount: 1,
          generatedQuestionCount: 1,
          warningCount: 0,
          failedCount: 0
        }
      })
    );
    await storage.addQuestionsToDeck("d", ["B"]);

    const saved = await storage.saveQuizQuestionsAndAppendToDeck([question("C")], "d", {
      lastSyncedAt: "2026-02-01T00:00:00.000Z",
      generationFilters: { targetDomainTag: "心理学", generationMode: "auto" },
      generationSummary: {
        targetConceptCount: 4,
        generatedQuestionCount: 99,
        warningCount: 1,
        failedCount: 2
      }
    });

    expect(saved.questionIds).toEqual(["A", "B", "C"]);
    expect(saved.lastSyncedAt).toBe("2026-02-01T00:00:00.000Z");
    expect(saved.generationFilters?.targetDomainTag).toBe("心理学");
    expect(saved.generationSummary).toEqual({
      targetConceptCount: 4,
      generatedQuestionCount: 3,
      warningCount: 1,
      failedCount: 2
    });
    expect((await storage.getQuizQuestions()).map((item) => item.id).sort()).toEqual(["A", "C"]);
  });

  it("手動追加の同一 Question は membership を重複させない", async () => {
    await storage.saveQuizQuestion(question("A"));
    await storage.saveQuizDeck(deck("d", ["A"], { title: "deck" }));
    await storage.saveQuizQuestionAndAppendToDeck(question("B"), "d");
    const again = await storage.saveQuizQuestionAndAppendToDeck(question("B"), "d");
    expect(again.questionIds).toEqual(["A", "B"]);
    expect(await membershipOf(storage, "d")).toEqual(["A", "B"]);
  });

  it("remove は指定 ID 以外の並びを保つ", async () => {
    await storage.saveQuizDeck(deck("d", ["A", "B", "C"], { title: "deck" }));
    const saved = await storage.removeQuestionsFromDeck("d", ["B"]);
    expect(saved.questionIds).toEqual(["A", "C"]);
  });
});
