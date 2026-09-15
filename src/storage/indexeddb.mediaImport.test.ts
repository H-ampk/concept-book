import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createEmptyConceptInput, type Concept } from "../types/concept";
import type { ContextCard } from "../types/contextCard";
import type { QuizAttemptLog, QuizDeck, QuizQuestion } from "../types/quiz";
import { IndexedDBStorage } from "./indexeddb";

const iso = "2026-01-01T00:00:00.000Z";

const concept = (id: string, extras: Partial<Concept> = {}): Concept => ({
  ...createEmptyConceptInput(),
  id,
  title: extras.title ?? id,
  createdAt: iso,
  updatedAt: iso,
  ...extras
});

const emptyImportExtras = {
  contextCards: [] as ContextCard[],
  quizQuestions: [] as QuizQuestion[],
  quizDecks: [] as QuizDeck[],
  quizAttemptLogs: [] as QuizAttemptLog[],
  quizQuestionParseSkipped: 0,
  quizDeckParseSkipped: 0,
  quizAttemptLogParseSkipped: 0
};

const pngFile = (name = "pic.png"): File =>
  new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], name, { type: "image/png" });

const deleteDb = (): Promise<void> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase("concept-book-db");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });

describe("JSON / ZIP replace media import (#153)", () => {
  let storage: IndexedDBStorage;

  beforeEach(async () => {
    await deleteDb();
    storage = new IndexedDBStorage();
  });

  afterEach(async () => {
    await deleteDb();
  });

  it("JSON replace で旧 media blob が消える", async () => {
    const created = await storage.createConcept({
      ...createEmptyConceptInput(),
      title: "旧概念"
    });
    const ref = await storage.addMedia({ conceptId: created.id, file: pngFile() });
    expect(await storage.getMediaBlob(ref.id)).toBeDefined();

    await storage.importBackupData(
      {
        ...emptyImportExtras,
        concepts: [concept("imported", { title: "置換後" })]
      },
      "replace"
    );

    expect(await storage.getMediaBlob(ref.id)).toBeUndefined();
    expect(await storage.getConceptById(created.id)).toBeUndefined();
    const imported = await storage.getConceptById("imported");
    expect(imported?.title).toBe("置換後");
  });

  it("JSON replace では JSON 内の media refs を復元しない", async () => {
    await storage.importBackupData(
      {
        ...emptyImportExtras,
        concepts: [
          concept("c_json", {
            title: "JSON概念",
            media: [
              {
                id: "media_missing",
                kind: "image",
                fileName: "missing.png",
                sortOrder: 0
              }
            ]
          })
        ]
      },
      "replace"
    );

    const imported = await storage.getConceptById("c_json");
    expect(imported?.media === undefined || imported?.media.length === 0).toBe(true);
  });

  it("既存 media ID と JSON の参照が一致しても再利用しない", async () => {
    const created = await storage.createConcept({
      ...createEmptyConceptInput(),
      title: "旧概念"
    });
    const ref = await storage.addMedia({ conceptId: created.id, file: pngFile("keep.png") });
    expect(await storage.getMediaBlob(ref.id)).toBeDefined();

    await storage.importBackupData(
      {
        ...emptyImportExtras,
        concepts: [
          concept("c_reuse", {
            title: "再利用しない",
            media: [
              {
                id: ref.id,
                kind: "image",
                fileName: "keep.png",
                sortOrder: 0
              }
            ]
          })
        ]
      },
      "replace"
    );

    const imported = await storage.getConceptById("c_reuse");
    expect(imported?.media === undefined || imported?.media.length === 0).toBe(true);
    expect(await storage.getMediaBlob(ref.id)).toBeUndefined();
  });

  it("ZIP replace では media 本体を復元できる", async () => {
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

    const zipFile = new File([zipBlob], "backup.zip", { type: "application/zip" });
    const result = await storage.importConceptBookPackage(zipFile, "replace");

    expect(result.importedMedia).toBe(1);
    expect(result.missingMedia).toBe(0);

    const restored = await storage.getConceptById(created.id);
    expect(restored?.media?.some((item) => item.id === ref.id)).toBe(true);
    const blob = await storage.getMediaBlob(ref.id);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob && blob.size > 0).toBe(true);
  });

  it("JSON merge では既存 media を一括削除しない", async () => {
    const created = await storage.createConcept({
      ...createEmptyConceptInput(),
      title: "残す"
    });
    const ref = await storage.addMedia({ conceptId: created.id, file: pngFile() });

    await storage.importBackupData(
      {
        ...emptyImportExtras,
        concepts: [concept("other", { title: "追加" })]
      },
      "merge"
    );

    const kept = await storage.getConceptById(created.id);
    expect(kept?.media?.some((item) => item.id === ref.id)).toBe(true);
    expect(await storage.getMediaBlob(ref.id)).toBeDefined();
  });
});
