import { parseBulkRelatedConceptTitles } from "./bulkRelatedConcepts";
import { normalizeConceptTitle } from "./normalizeConceptTitle";

export type IndexTermMatch = {
  term: string;
  matchedPages: string[];
};

export type IndexExtractionResult = {
  terms: IndexTermMatch[];
  unparsedLines: string[];
};

type PageRef = {
  start: number;
  end: number;
  label: string;
};

const RANGE_SEP = "[-–—〜～~]";
const LIST_SEP = "[,，、]";
const PAGE_ATOM = `\\d+\\s*(?:${RANGE_SEP}\\s*\\d+)?`;
const PAGE_LIST = `(?:${PAGE_ATOM}\\s*${LIST_SEP}\\s*)*${PAGE_ATOM}`;
const LINE_RE = new RegExp(`^(.+?)\\s+(${PAGE_LIST})\\s*$`);

const parsePositiveInt = (value: string): number | null => {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    return null;
  }
  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    return null;
  }
  return parsed;
};

export const validateIndexPageRange = (
  startRaw: string,
  endRaw: string
): { startPage: number; endPage: number } | { error: string } => {
  const startPage = parsePositiveInt(startRaw);
  const endPage = parsePositiveInt(endRaw);
  if (startPage === null || endPage === null) {
    return { error: "開始ページと終了ページは正の整数で入力してください。" };
  }
  if (startPage > endPage) {
    return { error: "開始ページは終了ページ以下にしてください。" };
  }
  return { startPage, endPage };
};

const parsePageRefs = (pagesRaw: string): PageRef[] | null => {
  const parts = pagesRaw
    .split(/[,，、]/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    return null;
  }

  const refs: PageRef[] = [];
  for (const part of parts) {
    const range = part.match(new RegExp(`^(\\d+)\\s*${RANGE_SEP}\\s*(\\d+)$`));
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      if (start < 1 || end < 1 || start > end) {
        return null;
      }
      refs.push({ start, end, label: `${start}-${end}` });
      continue;
    }
    if (!/^\d+$/.test(part)) {
      return null;
    }
    const page = Number(part);
    if (page < 1) {
      return null;
    }
    refs.push({ start: page, end: page, label: String(page) });
  }
  return refs;
};

const looksLikePageList = (value: string): boolean => parsePageRefs(value) !== null;

const hasUnsupportedLeader = (term: string): boolean =>
  /(?:\.{2,}|…+|⋯+|‥+|・{2,}|─{2,}|—{2,}|－{2,})\s*$/u.test(term);

const parseIndexLine = (rawLine: string): { term: string; refs: PageRef[] } | null => {
  const line = rawLine.trim();
  if (!line) {
    return null;
  }
  const normalized = line.normalize("NFKC");
  const match = normalized.match(LINE_RE);
  if (!match) {
    return null;
  }
  const pagesRaw = match[2];
  const refs = parsePageRefs(pagesRaw);
  if (!refs) {
    return null;
  }
  for (const ref of refs) {
    if (!Number.isSafeInteger(ref.start) || !Number.isSafeInteger(ref.end)) {
      return null;
    }
  }
  const term =
    line.length === normalized.length
      ? line.slice(0, line.length - pagesRaw.length).trim()
      : match[1].trim();
  if (!term || !/\p{L}/u.test(term) || looksLikePageList(term) || hasUnsupportedLeader(term)) {
    return null;
  }
  return { term, refs };
};

const overlaps = (ref: PageRef, startPage: number, endPage: number): boolean =>
  ref.start <= endPage && ref.end >= startPage;

/** 索引テキストから、指定ページ範囲と参照が交差する用語を出現順で抽出する。 */
export const extractIndexTerms = (
  indexText: string,
  startPage: number,
  endPage: number
): IndexExtractionResult => {
  const terms: IndexTermMatch[] = [];
  const unparsedLines: string[] = [];
  const seen = new Map<string, IndexTermMatch>();

  for (const rawLine of indexText.split(/\r?\n/)) {
    if (!rawLine.trim()) {
      continue;
    }
    const parsed = parseIndexLine(rawLine);
    if (!parsed) {
      unparsedLines.push(rawLine.trim());
      continue;
    }
    const matchedPages = parsed.refs.filter((ref) => overlaps(ref, startPage, endPage));
    if (matchedPages.length === 0) {
      continue;
    }
    const key = normalizeConceptTitle(parsed.term);
    const existing = seen.get(key);
    if (existing) {
      for (const ref of matchedPages) {
        if (!existing.matchedPages.includes(ref.label)) {
          existing.matchedPages.push(ref.label);
        }
      }
      continue;
    }
    const match: IndexTermMatch = {
      term: parsed.term,
      matchedPages: matchedPages.map((ref) => ref.label)
    };
    seen.set(key, match);
    terms.push(match);
  }

  return { terms, unparsedLines };
};

/** 既存の重要概念文字列の末尾へ、重複を除いて用語を追加する。 */
export const appendKeyConcepts = (existing: string, additions: string[]): string => {
  const seen = new Set(parseBulkRelatedConceptTitles(existing).map((term) => normalizeConceptTitle(term)));
  const toAdd: string[] = [];
  for (const addition of additions) {
    const trimmed = addition.trim();
    const key = normalizeConceptTitle(trimmed);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    toAdd.push(trimmed);
  }
  if (toAdd.length === 0) {
    return existing;
  }
  const suffix = toAdd.join(", ");
  if (!existing.trim()) {
    return suffix;
  }
  const trimmedEnd = existing.replace(/\s+$/, "");
  return /[,、\n]$/.test(trimmedEnd) ? `${trimmedEnd} ${suffix}` : `${trimmedEnd}, ${suffix}`;
};
