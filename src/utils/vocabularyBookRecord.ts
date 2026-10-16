import { createRandomUuid } from "../sync/ids";
import type { VocabularyBook, VocabularyBookInput, VocabularyBookPatch } from "../types/vocabularyBook";
import { normalizeVocabularyDomainTags } from "./vocabularyBook";

const VOCAB_ID_RE =
  /^vocab_[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

export const VOCABULARY_BOOK_NAME_MAX = 200;

export const createVocabularyBookId = (): string => `vocab_${createRandomUuid()}`;

export const isVocabularyBookId = (id: string): boolean => VOCAB_ID_RE.test(id);

export const isIsoTimestamp = (value: string): boolean =>
  ISO_RE.test(value) && !Number.isNaN(Date.parse(value));

export type VocabularyBookIssue = "id" | "name" | "domainTags" | "includeUnassigned" | "createdAt" | "updatedAt";

export type ParsedVocabularyBook =
  | { ok: true; book: VocabularyBook }
  | { ok: false; issue: VocabularyBookIssue };

const parseName = (name: unknown): string | null => {
  if (typeof name !== "string") {
    return null;
  }
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > VOCABULARY_BOOK_NAME_MAX) {
    return null;
  }
  return trimmed;
};

export const parseVocabularyBook = (raw: unknown): ParsedVocabularyBook => {
  if (raw === null || typeof raw !== "object") {
    return { ok: false, issue: "id" };
  }
  const record = raw as Record<string, unknown>;
  if (typeof record.id !== "string" || !isVocabularyBookId(record.id)) {
    return { ok: false, issue: "id" };
  }
  const name = parseName(record.name);
  if (!name) {
    return { ok: false, issue: "name" };
  }
  if (!Array.isArray(record.domainTags)) {
    return { ok: false, issue: "domainTags" };
  }
  if (typeof record.includeUnassigned !== "boolean") {
    return { ok: false, issue: "includeUnassigned" };
  }
  if (typeof record.createdAt !== "string" || !isIsoTimestamp(record.createdAt)) {
    return { ok: false, issue: "createdAt" };
  }
  if (typeof record.updatedAt !== "string" || !isIsoTimestamp(record.updatedAt)) {
    return { ok: false, issue: "updatedAt" };
  }
  return {
    ok: true,
    book: {
      id: record.id,
      name,
      domainTags: normalizeVocabularyDomainTags(record.domainTags),
      includeUnassigned: record.includeUnassigned,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt
    }
  };
};

export const buildVocabularyBook = (
  input: VocabularyBookInput,
  now: string,
  id: string = createVocabularyBookId()
): VocabularyBook => {
  const name = parseName(input.name);
  if (!name) {
    throw new Error("単語帳名は1〜200文字である必要があります。");
  }
  if (!Array.isArray(input.domainTags)) {
    throw new Error("対象分野タグの形式が不正です。");
  }
  if (typeof input.includeUnassigned !== "boolean") {
    throw new Error("分野未設定の指定が不正です。");
  }
  if (!isVocabularyBookId(id) || !isIsoTimestamp(now)) {
    throw new Error("単語帳IDまたは日時が不正です。");
  }
  return {
    id,
    name,
    domainTags: normalizeVocabularyDomainTags(input.domainTags),
    includeUnassigned: input.includeUnassigned,
    createdAt: now,
    updatedAt: now
  };
};

export const applyVocabularyBookPatch = (
  current: VocabularyBook,
  patch: VocabularyBookPatch,
  now: string
): VocabularyBook => {
  if (!isIsoTimestamp(now)) {
    throw new Error("更新日時が不正です。");
  }
  const next = buildVocabularyBook(
    {
      name: patch.name ?? current.name,
      domainTags: patch.domainTags ?? current.domainTags,
      includeUnassigned: patch.includeUnassigned ?? current.includeUnassigned
    },
    current.createdAt,
    current.id
  );
  return {
    ...next,
    createdAt: current.createdAt,
    updatedAt: now
  };
};

export type VocabularyBookImportNormalization = {
  books: VocabularyBook[];
  skipped: number;
  /** キーが配列として存在し、空配列か1件以上の正当レコードがある。全件不正のときは false。 */
  apply: boolean;
};

/**
 * 旧バックアップはキー無し。全要素が不正な配列は空配列と区別し、置換しない。
 * キーが配列でない場合もバックアップ全体は失敗させない。
 */
export const normalizeVocabularyBooksForBackupImport = (
  payload: unknown
): VocabularyBookImportNormalization => {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    return { books: [], skipped: 0, apply: false };
  }
  if (!Object.prototype.hasOwnProperty.call(payload, "vocabularyBooks")) {
    return { books: [], skipped: 0, apply: false };
  }
  const raw = (payload as { vocabularyBooks: unknown }).vocabularyBooks;
  if (!Array.isArray(raw)) {
    return { books: [], skipped: 1, apply: false };
  }
  const books: VocabularyBook[] = [];
  let skipped = 0;
  for (const item of raw) {
    const parsed = parseVocabularyBook(item);
    if (!parsed.ok) {
      skipped += 1;
      continue;
    }
    books.push(parsed.book);
  }
  return {
    books,
    skipped,
    apply: books.length > 0 || skipped === 0
  };
};
