import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyConceptInput, type Concept } from "../types/concept";
import { createEmptyContextCardInput } from "../types/contextCard";
import type { VocabularyBook } from "../types/vocabularyBook";
import * as ids from "../sync/ids";
import { ContextCardIndexedDBStorage, IndexedDBStorage } from "./indexeddb";
import { CONCEPT_BOOK_DB_NAME, CONCEPT_BOOK_DB_VERSION } from "./indexeddb";

const iso = "2026-01-01T00:00:00.000Z";
const fixedUuid = "00000000-0000-4000-8000-0000000000aa";

const book = (id: string, name: string, updatedAt = iso): VocabularyBook => ({
  id,
  name,
  domainTags: ["AI"],
  includeUnassigned: false,
  createdAt: iso,
  updatedAt
});

const concept = (id: string): Concept => ({
  ...createEmptyConceptInput(),
  id,
  title: id,
  createdAt: iso,
  updatedAt: iso
});

const deleteDb = (): Promise<void> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(CONCEPT_BOOK_DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });

const minimalBackup = (vocabularyBooks?: VocabularyBook[] | "omit") => ({
  concepts: [concept("c1")],
  contextCards: [],
  quizQuestions: [],
  quizQuestionParseSkipped: 0,
  quizDecks: [],
  quizDeckParseSkipped: 0,
  quizAttemptLogs: [],
  quizAttemptLogParseSkipped: 0,
  researchReports: [] as [],
  researchReportParseSkipped: 0,
  ...(vocabularyBooks === "omit" || vocabularyBooks === undefined
    ? {}
    : {
        vocabularyBooks,
        vocabularyBooksApply: true,
        vocabularyBookParseSkipped: 0
      })
});

describe("vocabularyBooks IndexedDB", () => {
  beforeEach(async () => {
    await deleteDb();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("作成・取得・更新・削除と再オープン後の保持", async () => {
    const storage = new IndexedDBStorage();
    const created = await storage.createVocabularyBook({
      name: "  Web開発 ",
      domainTags: ["web", "web", "  "],
      includeUnassigned: false
    });
    expect(created.id.startsWith("vocab_")).toBe(true);
    expect(created.name).toBe("Web開発");
    expect(created.domainTags).toEqual(["web"]);
    expect(created.createdAt).toBe(created.updatedAt);

    const listed = await storage.getAllVocabularyBooks();
    expect(listed.map((item) => item.id)).toEqual([created.id]);
    expect(await storage.getVocabularyBook("missing")).toBeUndefined();

    const updated = await storage.updateVocabularyBook(created.id, {
      name: "AI入門",
      includeUnassigned: true,
      domainTags: []
    });
    expect(updated.createdAt).toBe(created.createdAt);
    expect(updated.updatedAt >= created.updatedAt).toBe(true);
    expect(updated.domainTags).toEqual([]);
    expect(updated.includeUnassigned).toBe(true);

    const reopened = new IndexedDBStorage();
    expect((await reopened.getVocabularyBook(created.id))?.name).toBe("AI入門");

    await reopened.deleteVocabularyBook(created.id);
    expect(await reopened.getVocabularyBook(created.id)).toBeUndefined();
    await expect(reopened.updateVocabularyBook(created.id, { name: "x" })).rejects.toThrow(/見つかりません/);
    await expect(reopened.deleteVocabularyBook(created.id)).rejects.toThrow(/見つかりません/);
  });

  it("同じIDの作成は衝突として失敗する", async () => {
    vi.spyOn(ids, "createRandomUuid").mockReturnValue(fixedUuid);
    const storage = new IndexedDBStorage();
    await storage.createVocabularyBook({
      name: "一冊目",
      domainTags: [],
      includeUnassigned: false
    });
    await expect(
      storage.createVocabularyBook({
        name: "二冊目",
        domainTags: [],
        includeUnassigned: false
      })
    ).rejects.toThrow(/同じID/);
    expect(await storage.getAllVocabularyBooks()).toHaveLength(1);
  });

  it("削除は Concept と文脈カードを残す", async () => {
    const storage = new IndexedDBStorage();
    const createdConcept = await storage.createConcept({
      ...createEmptyConceptInput(),
      title: "残る概念"
    });
    const cards = new ContextCardIndexedDBStorage();
    const createdCard = await cards.createContextCard({
      ...createEmptyContextCardInput(),
      title: "残るカード"
    });
    const created = await storage.createVocabularyBook({
      name: "冊",
      domainTags: [],
      includeUnassigned: false
    });
    await storage.deleteVocabularyBook(created.id);
    expect(await storage.getConceptById(createdConcept.id)).toBeDefined();
    expect(await cards.getContextCardById(createdCard.id)).toBeDefined();
  });

  it("旧 version から upgrade しても Concept と文脈カードが残る", async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(CONCEPT_BOOK_DB_NAME, CONCEPT_BOOK_DB_VERSION - 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("concepts")) {
          db.createObjectStore("concepts", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("contextCards")) {
          db.createObjectStore("contextCards", { keyPath: "id" });
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction(["concepts", "contextCards"], "readwrite");
        tx.objectStore("concepts").put(concept("kept"));
        tx.objectStore("contextCards").put({
          ...createEmptyContextCardInput(),
          id: "card-kept",
          title: "カード",
          createdAt: iso,
          updatedAt: iso
        });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      request.onerror = () => reject(request.error);
    });

    const storage = new IndexedDBStorage();
    expect((await storage.getAllConcepts()).map((item) => item.id)).toContain("kept");
    const cards = new ContextCardIndexedDBStorage();
    expect(await cards.getContextCardById("card-kept")).toBeDefined();
    expect(await storage.getAllVocabularyBooks()).toEqual([]);

    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(CONCEPT_BOOK_DB_NAME);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    expect(db.version).toBe(CONCEPT_BOOK_DB_VERSION);
    expect(db.objectStoreNames.contains("vocabularyBooks")).toBe(true);
    db.close();
  });

  it("export した単語帳を import でき、旧バックアップはローカル冊を残す", async () => {
    const storage = new IndexedDBStorage();
    const created = await storage.createVocabularyBook({
      name: "ローカル",
      domainTags: ["Python"],
      includeUnassigned: true
    });
    const exported = await storage.exportBackupData();
    expect(exported.vocabularyBooks?.map((item) => item.id)).toEqual([created.id]);
    expect(exported.concepts.every((item) => !("domainTags" in (exported.vocabularyBooks?.[0] ?? {})))).toBe(true);

    await storage.importBackupData(minimalBackup("omit"), "replace");
    expect((await storage.getVocabularyBook(created.id))?.name).toBe("ローカル");

    const incoming = book("vocab_00000000-0000-4000-8000-0000000000bb", "バックアップ");
    await storage.importBackupData(minimalBackup([incoming]), "replace");
    const afterReplace = await storage.getAllVocabularyBooks();
    expect(afterReplace.map((item) => item.id)).toEqual([incoming.id]);
  });

  it("merge は同一IDをバックアップ側にし、ローカルだけの冊を残す", async () => {
    const storage = new IndexedDBStorage();
    const localOnly = book("vocab_00000000-0000-4000-8000-000000000011", "ローカルだけ");
    const sharedLocal = book("vocab_00000000-0000-4000-8000-000000000022", "古い名前", iso);
    await storage.importBackupData(minimalBackup([localOnly, sharedLocal]), "replace");
    const sharedIncoming = book(
      sharedLocal.id,
      "バックアップ名",
      "2020-01-01T00:00:00.000Z"
    );
    const added = book("vocab_00000000-0000-4000-8000-000000000033", "追加");
    const result = await storage.importBackupData(minimalBackup([sharedIncoming, added]), "merge");
    expect(result.importedVocabularyBooks).toBe(2);
    const names = new Map((await storage.getAllVocabularyBooks()).map((item) => [item.id, item.name]));
    expect(names.get(localOnly.id)).toBe("ローカルだけ");
    expect(names.get(sharedLocal.id)).toBe("バックアップ名");
    expect(names.get(added.id)).toBe("追加");
  });

  it("空配列の replace は0件にし、全件不正では既存を消さない", async () => {
    const storage = new IndexedDBStorage();
    const kept = book("vocab_00000000-0000-4000-8000-000000000044", "残す");
    await storage.importBackupData(minimalBackup([kept]), "replace");

    await storage.importBackupData(
      {
        ...minimalBackup([]),
        vocabularyBooks: [{ id: "bad" } as unknown as VocabularyBook],
        vocabularyBooksApply: false,
        vocabularyBookParseSkipped: 1
      },
      "replace"
    );
    expect((await storage.getAllVocabularyBooks()).map((item) => item.id)).toEqual([kept.id]);

    const cleared = await storage.importBackupData(minimalBackup([]), "replace");
    expect(cleared.importedVocabularyBooks).toBe(0);
    expect(await storage.getAllVocabularyBooks()).toEqual([]);
    expect(await storage.getConceptById("c1")).toBeDefined();
  });
});
