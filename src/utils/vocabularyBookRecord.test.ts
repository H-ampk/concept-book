import { describe, expect, it } from "vitest";
import { createEmptyConceptInput } from "../types/concept";
import { validateBackupImportPayload } from "./conceptImportValidation";
import {
  applyVocabularyBookPatch,
  buildVocabularyBook,
  isVocabularyBookId,
  normalizeVocabularyBooksForBackupImport,
  parseVocabularyBook
} from "./vocabularyBookRecord";

const id = "vocab_00000000-0000-4000-8000-000000000001";
const iso = "2026-01-01T00:00:00.000Z";

const book = (overrides: Record<string, unknown> = {}) => ({
  id,
  name: "Web開発",
  domainTags: ["AI"],
  includeUnassigned: false,
  createdAt: iso,
  updatedAt: iso,
  ...overrides
});

const backup = (vocabularyBooks?: unknown) =>
  validateBackupImportPayload({
    concepts: [
      {
        ...createEmptyConceptInput(),
        id: "c1",
        title: "概念",
        createdAt: iso,
        updatedAt: iso
      }
    ],
    ...(vocabularyBooks === undefined ? {} : { vocabularyBooks })
  });

describe("parseVocabularyBook", () => {
  it("正常データを正規化して受け入れる", () => {
    const parsed = parseVocabularyBook(
      book({ name: "  Web開発  ", domainTags: [" AI ", "AI", "", "  ", 1] })
    );
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.book.name).toBe("Web開発");
      expect(parsed.book.domainTags).toEqual(["AI"]);
    }
  });

  it("タグ0件を保存できる", () => {
    const parsed = parseVocabularyBook(book({ domainTags: [] }));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.book.domainTags).toEqual([]);
    }
  });

  it("空の名前を拒否する", () => {
    expect(parseVocabularyBook(book({ name: "   " })).ok).toBe(false);
  });

  it("201文字の名前を拒否する", () => {
    expect(parseVocabularyBook(book({ name: "あ".repeat(201) })).ok).toBe(false);
  });

  it("不正なIDを拒否する", () => {
    expect(isVocabularyBookId("concept_1")).toBe(false);
    expect(parseVocabularyBook(book({ id: "vocab_not-a-uuid" })).ok).toBe(false);
  });

  it("不正な日時を拒否する", () => {
    expect(parseVocabularyBook(book({ createdAt: "2026-01-01" })).ok).toBe(false);
    expect(parseVocabularyBook(book({ updatedAt: "yesterday" })).ok).toBe(false);
  });

  it("domainTags が配列でないとき拒否する", () => {
    expect(parseVocabularyBook(book({ domainTags: "AI" })).ok).toBe(false);
  });

  it("includeUnassigned が boolean でないとき拒否する", () => {
    expect(parseVocabularyBook(book({ includeUnassigned: "true" })).ok).toBe(false);
  });

  it("更新は createdAt を維持し updatedAt だけ変える", () => {
    const parsed = parseVocabularyBook(book());
    if (!parsed.ok) {
      throw new Error("fixture");
    }
    const next = applyVocabularyBookPatch(parsed.book, { name: "AI入門" }, "2026-02-01T00:00:00.000Z");
    expect(next.createdAt).toBe(iso);
    expect(next.updatedAt).toBe("2026-02-01T00:00:00.000Z");
    expect(next.name).toBe("AI入門");
  });

  it("build は vocab_uuid を付ける", () => {
    const created = buildVocabularyBook(
      { name: "英単語", domainTags: [], includeUnassigned: false },
      iso
    );
    expect(isVocabularyBookId(created.id)).toBe(true);
    expect(created.createdAt).toBe(iso);
  });
});

describe("normalizeVocabularyBooksForBackupImport", () => {
  it("キーが無い旧バックアップは適用しない", () => {
    const result = backup(undefined);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.vocabularyBooksApply).toBe(false);
      expect(result.vocabularyBookParseSkipped).toBe(0);
    }
  });

  it("空配列は置換対象にする", () => {
    const normalized = normalizeVocabularyBooksForBackupImport({ vocabularyBooks: [] });
    expect(normalized.apply).toBe(true);
    expect(normalized.books).toEqual([]);
  });

  it("不正要素だけをスキップし、全件不正なら置換しない", () => {
    const normalized = normalizeVocabularyBooksForBackupImport({
      vocabularyBooks: [{ id: "bad" }, book()]
    });
    expect(normalized.skipped).toBe(1);
    expect(normalized.books).toHaveLength(1);
    expect(normalized.apply).toBe(true);

    const allBad = normalizeVocabularyBooksForBackupImport({
      vocabularyBooks: [{ name: "" }]
    });
    expect(allBad.apply).toBe(false);
    expect(allBad.books).toEqual([]);
    expect(allBad.skipped).toBe(1);
  });

  it("配列でないキーでもバックアップ全体は成功する", () => {
    const result = backup("nope");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.vocabularyBooksApply).toBe(false);
      expect(result.vocabularyBookParseSkipped).toBe(1);
      expect(result.concepts).toHaveLength(1);
    }
  });
});
