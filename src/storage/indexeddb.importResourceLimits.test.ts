import "fake-indexeddb/auto";
import { strToU8, zipSync } from "fflate";
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
import { validateBackupImportPayload } from "../utils/conceptImportValidation";
import {
  JSON_IMPORT_TOO_LARGE_MESSAGE,
  readJsonBackupPayload,
  ZIP_CONCEPTS_JSON_TOO_LARGE_MESSAGE,
  ZIP_ENTRY_COUNT_MESSAGE,
  ZIP_IMPORT_TOO_LARGE_MESSAGE,
  ZIP_INVALID_MESSAGE,
  ZIP_UNCOMPRESSED_TOO_LARGE_MESSAGE
} from "../utils/importResourceLimits";
import { ContextCardIndexedDBStorage, IndexedDBStorage } from "./indexeddb";

const iso = "2026-01-01T00:00:00.000Z";
const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 1, 2, 3]);

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

const question = (id: string): QuizQuestion => ({
  id,
  questionType: "multiple-choice",
  prompt: "旧問い",
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

const deck = (id: string): QuizDeck => ({
  id,
  title: "旧デッキ",
  questionIds: ["old_q"],
  visibility: "private",
  schemaVersion: QUIZ_DECK_SCHEMA_VERSION,
  createdAt: iso,
  updatedAt: iso
});

const log = (id: string): QuizAttemptLog => ({
  id,
  questionId: "old_q",
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

const zipFile = (bytes: Uint8Array, name = "backup.zip"): File =>
  new File([bytes], name, { type: "application/zip" });

const readU16 = (data: Uint8Array, offset: number): number => data[offset]! | (data[offset + 1]! << 8);
const readU32 = (data: Uint8Array, offset: number): number =>
  (data[offset]! | (data[offset + 1]! << 8) | (data[offset + 2]! << 16) | (data[offset + 3]! << 24)) >>> 0;
const writeU32 = (data: Uint8Array, offset: number, value: number): void => {
  data[offset] = value & 0xff;
  data[offset + 1] = (value >>> 8) & 0xff;
  data[offset + 2] = (value >>> 16) & 0xff;
  data[offset + 3] = (value >>> 24) & 0xff;
};

const patchDeclaredUncompressedSize = (zip: Uint8Array, name: string, size: number): Uint8Array => {
  const out = new Uint8Array(zip);
  let eocd = -1;
  for (let offset = out.length - 22; offset >= 0; offset -= 1) {
    if (readU32(out, offset) === 0x06054b50 && offset + 22 + readU16(out, offset + 20) === out.length) {
      eocd = offset;
      break;
    }
  }
  if (eocd < 0) {
    throw new Error("EOCD not found");
  }
  let cursor = readU32(out, eocd + 16);
  for (let index = 0; index < readU16(out, eocd + 10); index += 1) {
    const nameLength = readU16(out, cursor + 28);
    const extraLength = readU16(out, cursor + 30);
    const commentLength = readU16(out, cursor + 32);
    const entryName = new TextDecoder().decode(out.subarray(cursor + 46, cursor + 46 + nameLength));
    if (entryName === name) {
      writeU32(out, cursor + 24, size);
      return out;
    }
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  throw new Error(`entry not found: ${name}`);
};

describe("import resource limits keep existing IndexedDB data", () => {
  let storage: IndexedDBStorage;
  let mediaId = "";
  let materialId = "";

  beforeEach(async () => {
    await deleteDb();
    storage = new IndexedDBStorage();
    await storage.importBackupData(
      {
        concepts: [concept("old_c", { title: "旧概念" })],
        contextCards: [contextCard("old_ctx", { title: "旧文脈" })],
        quizQuestions: [question("old_q")],
        quizDecks: [deck("old_d")],
        quizAttemptLogs: [log("old_log")],
        ...parseSkipped
      },
      "replace"
    );
    const ref = await storage.addMedia({
      conceptId: "old_c",
      file: new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], "old.png", { type: "image/png" })
    });
    mediaId = ref.id;
    const material = await storage.addLearningMaterialPdf({
      contextCardId: "old_ctx",
      file: new File([pdfBytes], "old.pdf", { type: "application/pdf" })
    });
    materialId = material.id;
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await deleteDb();
  });

  const expectOldIntact = async () => {
    expect((await storage.getConceptById("old_c"))?.title).toBe("旧概念");
    expect((await new ContextCardIndexedDBStorage().getContextCardById("old_ctx"))?.title).toBe("旧文脈");
    expect((await storage.getQuizQuestions()).map((row) => row.id)).toEqual(["old_q"]);
    expect((await storage.getQuizDecks()).map((row) => row.id)).toEqual(["old_d"]);
    expect((await storage.getQuizAttemptLogs()).map((row) => row.id)).toEqual(["old_log"]);
    expect(await storage.getMediaBlob(mediaId)).toBeDefined();
    expect((await storage.getLearningMaterial(materialId))?.fileName).toBe("old.pdf");
    expect((await storage.getLearningMaterialBlob(materialId))?.size).toBe(pdfBytes.length);
  };

  const expectNoWrites = async (run: () => Promise<unknown>) => {
    const put = vi.spyOn(IDBObjectStore.prototype, "put");
    const remove = vi.spyOn(IDBObjectStore.prototype, "delete");
    const clear = vi.spyOn(IDBObjectStore.prototype, "clear");
    put.mockClear();
    remove.mockClear();
    clear.mockClear();
    await expect(run()).rejects.toThrow();
    expect(put).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    expect(clear).not.toHaveBeenCalled();
    await expectOldIntact();
  };

  it("正常なZIPは replace で復元できる", async () => {
    const zipped = buildConceptBookZip(
      JSON.stringify({
        concepts: [concept("new_c", { title: "復元概念" })],
        contextCards: [],
        quizQuestions: [],
        quizDecks: [],
        quizAttemptLogs: []
      }),
      []
    );
    const result = await storage.importConceptBookPackage(zipFile(zipped), "replace");
    expect(result.importedConcepts).toBe(1);
    expect((await storage.getConceptById("new_c"))?.title).toBe("復元概念");
  });

  it.each(["replace", "merge"] as const)(
    "%s では容量超過・不正ZIPのあと既存データを書き換えない",
    async (mode) => {
      const tiny = buildConceptBookZip('{"concepts":[]}', []);
      await expectNoWrites(() =>
        storage.importConceptBookPackage(zipFile(tiny), mode, { maxZipCompressedBytes: tiny.byteLength - 1 })
      );

      const many: Record<string, Uint8Array> = { "concepts.json": strToU8('{"concepts":[]}') };
      for (let index = 0; index < 4; index += 1) {
        many[`media/m${index}`] = strToU8("x");
      }
      await expectNoWrites(async () => {
        try {
          await storage.importConceptBookPackage(zipFile(zipSync(many)), mode, { maxZipEntryCount: 2 });
        } catch (error) {
          expect(error).toMatchObject({ message: ZIP_ENTRY_COUNT_MESSAGE });
          throw error;
        }
      });

      const bigEntry = zipSync({
        "concepts.json": strToU8('{"concepts":[]}'),
        "media/big": new Uint8Array(4000)
      });
      await expectNoWrites(async () => {
        try {
          await storage.importConceptBookPackage(zipFile(bigEntry), mode, {
            maxZipEntryUncompressedBytes: 1000,
            maxZipUncompressedBytes: 100_000
          });
        } catch (error) {
          expect(error).toMatchObject({ message: ZIP_UNCOMPRESSED_TOO_LARGE_MESSAGE });
          throw error;
        }
      });

      const concepts = zipSync({ "concepts.json": strToU8(`{"concepts":[],"note":"${"x".repeat(40)}"}`) });
      await expectNoWrites(async () => {
        try {
          await storage.importConceptBookPackage(zipFile(concepts), mode, { maxConceptsJsonBytes: 20 });
        } catch (error) {
          expect(error).toMatchObject({ message: ZIP_CONCEPTS_JSON_TOO_LARGE_MESSAGE });
          throw error;
        }
      });

      const bomb = patchDeclaredUncompressedSize(
        zipSync({
          "concepts.json": strToU8('{"concepts":[]}'),
          "media/bomb": new Uint8Array(12_000)
        }),
        "media/bomb",
        32
      );
      await expectNoWrites(async () => {
        try {
          await storage.importConceptBookPackage(zipFile(bomb), mode, {
            maxZipUncompressedBytes: 1_000_000,
            maxZipEntryUncompressedBytes: 1_000_000,
            maxConceptsJsonBytes: 1_000_000
          });
        } catch (error) {
          expect(error).toMatchObject({ message: ZIP_INVALID_MESSAGE });
          throw error;
        }
      });

      await expectNoWrites(async () => {
        try {
          await storage.importConceptBookPackage(zipFile(new Uint8Array(40)), mode);
        } catch (error) {
          expect(error).toMatchObject({ message: ZIP_INVALID_MESSAGE });
          throw error;
        }
      });
    }
  );

  it("圧縮後サイズの超過では arrayBuffer を呼ばない", async () => {
    const zipped = buildConceptBookZip('{"concepts":[]}', []);
    const file = zipFile(zipped);
    const read = vi.spyOn(file, "arrayBuffer");
    await expect(
      storage.importConceptBookPackage(file, "replace", { maxZipCompressedBytes: zipped.byteLength - 1 })
    ).rejects.toThrow(ZIP_IMPORT_TOO_LARGE_MESSAGE);
    expect(read).not.toHaveBeenCalled();
    await expectOldIntact();
  });

  it.each(["replace", "merge"] as const)("%s では不正JSONを保存しない", async (mode) => {
    const put = vi.spyOn(IDBObjectStore.prototype, "put");
    put.mockClear();
    const syntax = new File(["{"], "bad.json", { type: "application/json" });
    await expect(readJsonBackupPayload(syntax)).rejects.toBeInstanceOf(SyntaxError);

    const oversized = new File(["{}"], "big.json", { type: "application/json" });
    Object.defineProperty(oversized, "size", { value: 64 });
    const text = vi.spyOn(oversized, "text");
    await expect(readJsonBackupPayload(oversized, { maxJsonBytes: 8 })).rejects.toThrow(
      JSON_IMPORT_TOO_LARGE_MESSAGE
    );
    expect(text).not.toHaveBeenCalled();

    const parsed = await readJsonBackupPayload(new File(['{"concepts":"nope"}'], "schema.json"));
    const validation = validateBackupImportPayload(parsed);
    expect(validation.success).toBe(false);
    expect(put, mode).not.toHaveBeenCalled();
    await expectOldIntact();
  });
});
