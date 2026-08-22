const normalizeText = (text: string): string =>
  text
    .toLowerCase()
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();

export const normalizeForSearch = normalizeText;

export const includesNormalized = (source: string, query: string): boolean => {
  const normalizedSource = normalizeText(source);
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) {
    return true;
  }
  return normalizedSource.includes(normalizedQuery);
};

type NormalizedMap = {
  normalized: string;
  /** normalized[i] に対応する元テキストの開始インデックス */
  origIndex: number[];
};

const isWhitespaceChar = (ch: string): boolean => /\s/.test(ch);

const codePointLength = (text: string, index: number): number => {
  const codePoint = text.codePointAt(index);
  if (codePoint === undefined) {
    return 0;
  }
  return codePoint > 0xffff ? 2 : 1;
};

const mapNormalized = (source: string): NormalizedMap => {
  const expanded: { ch: string; orig: number }[] = [];
  for (let i = 0; i < source.length; ) {
    const len = codePointLength(source, i);
    const char = source.slice(i, i + len);
    const mapped = char.normalize("NFKC").toLowerCase();
    for (let j = 0; j < mapped.length; ) {
      const mappedLen = codePointLength(mapped, j);
      expanded.push({ ch: mapped.slice(j, j + mappedLen), orig: i });
      j += mappedLen;
    }
    i += len;
  }

  const origIndex: number[] = [];
  let normalized = "";
  let started = false;
  let pendingSpaceOrig: number | null = null;

  for (const part of expanded) {
    if (isWhitespaceChar(part.ch)) {
      if (started) {
        pendingSpaceOrig = part.orig;
      }
      continue;
    }
    if (pendingSpaceOrig !== null) {
      normalized += " ";
      origIndex.push(pendingSpaceOrig);
      pendingSpaceOrig = null;
    }
    started = true;
    normalized += part.ch;
    origIndex.push(part.orig);
  }

  return { normalized, origIndex };
};

export type TextRange = { start: number; end: number };

export const findNormalizedMatchRanges = (source: string, query: string): TextRange[] => {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) {
    return [];
  }
  const { normalized, origIndex } = mapNormalized(source);
  const ranges: TextRange[] = [];
  let from = 0;
  while (from < normalized.length) {
    const hit = normalized.indexOf(normalizedQuery, from);
    if (hit < 0) {
      break;
    }
    const lastNormIndex = hit + normalizedQuery.length - 1;
    const start = origIndex[hit] ?? 0;
    const lastOrig = origIndex[lastNormIndex] ?? start;
    const end = lastOrig + codePointLength(source, lastOrig);
    ranges.push({ start, end });
    from = hit + Math.max(normalizedQuery.length, 1);
  }
  return ranges;
};

export type HighlightSegment = { text: string; mark: boolean };

export const splitHighlightedSegments = (source: string, query: string): HighlightSegment[] => {
  const ranges = findNormalizedMatchRanges(source, query);
  if (ranges.length === 0) {
    return [{ text: source, mark: false }];
  }
  const segments: HighlightSegment[] = [];
  let cursor = 0;
  for (const range of ranges) {
    if (range.start > cursor) {
      segments.push({ text: source.slice(cursor, range.start), mark: false });
    }
    segments.push({ text: source.slice(range.start, range.end), mark: true });
    cursor = range.end;
  }
  if (cursor < source.length) {
    segments.push({ text: source.slice(cursor), mark: false });
  }
  return segments;
};

const SENTENCE_SPLIT = /([。！？\n])/;
const MAX_SNIPPET_CHARS = 72;

const clipAroundQuery = (text: string, query: string): string => {
  if (text.length <= MAX_SNIPPET_CHARS) {
    return text;
  }
  const range = findNormalizedMatchRanges(text, query)[0];
  if (!range) {
    return `${text.slice(0, MAX_SNIPPET_CHARS)}…`;
  }
  const matchLen = Math.max(range.end - range.start, 1);
  const budget = Math.max(MAX_SNIPPET_CHARS - matchLen, 16);
  const leftBudget = Math.floor(budget / 2);
  let start = Math.max(0, range.start - leftBudget);
  let end = Math.min(text.length, start + MAX_SNIPPET_CHARS);
  start = Math.max(0, end - MAX_SNIPPET_CHARS);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < text.length ? "…" : "";
  return `${prefix}${text.slice(start, end)}${suffix}`;
};

export const extractMatchingSentence = (text: string, query: string): string => {
  const parts = text.split(SENTENCE_SPLIT);
  const sentences: string[] = [];
  for (let i = 0; i < parts.length; i += 2) {
    const body = parts[i] ?? "";
    const delim = parts[i + 1] ?? "";
    const sentence = `${body}${delim === "\n" ? "" : delim}`.trim();
    if (sentence) {
      sentences.push(sentence);
    }
  }
  const hit = sentences.find((sentence) => includesNormalized(sentence, query));
  const snippet = (hit ?? text.trim());
  return clipAroundQuery(snippet, query);
};
