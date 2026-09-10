import { normalizeForSearch } from "../../../utils/search";
import { AIError } from "../errors";
import { LLM_CANDIDATE_LIMIT, LLM_NEW_CANDIDATE_LIMIT } from "./constants";

export type ParsedRelatedConceptExisting = {
  id: string;
  reason: string;
};

export type ParsedRelatedConceptNew = {
  title: string;
  reason: string;
};

export type ParsedRelatedConceptAnalysis = {
  existing: ParsedRelatedConceptExisting[];
  new: ParsedRelatedConceptNew[];
};

export type ParseRelatedConceptAnalysisOptions = {
  embeddingCandidateIds: ReadonlySet<string>;
  selfId?: string;
  relatedIds: ReadonlySet<string>;
  existingTitlesNormalized?: ReadonlySet<string>;
  currentTitleNormalized?: string;
  existingLimit?: number;
  newLimit?: number;
};

const stripThinkBlocks = (text: string): string =>
  text.replace(/<think>[\s\S]*?(<\/think>|$)/gi, "").trim();

export const extractJsonObjectText = (text: string): string => {
  const stripped = stripThinkBlocks(text);
  const fenced = stripped.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : stripped).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new AIError("invalid-response", "関連候補の分析結果を解析できませんでした。");
  }
  return candidate.slice(start, end + 1);
};

const parseJsonObject = (text: string): Record<string, unknown> => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonObjectText(text)) as unknown;
  } catch (error) {
    if (error instanceof AIError) {
      throw error;
    }
    throw new AIError("invalid-response", "関連候補の分析結果を解析できませんでした。", { cause: error });
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new AIError("invalid-response", "関連候補の分析結果の形式が不正です。");
  }
  return parsed as Record<string, unknown>;
};

const asNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const parseRelatedConceptAnalysis = (
  text: string,
  options: ParseRelatedConceptAnalysisOptions
): ParsedRelatedConceptAnalysis => {
  const raw = parseJsonObject(text);
  if (raw.existing !== undefined && !Array.isArray(raw.existing)) {
    throw new AIError("invalid-response", "関連候補の分析結果の形式が不正です。");
  }
  if (raw.new !== undefined && !Array.isArray(raw.new)) {
    throw new AIError("invalid-response", "関連候補の分析結果の形式が不正です。");
  }

  const existingLimit = options.existingLimit ?? LLM_CANDIDATE_LIMIT;
  const newLimit = options.newLimit ?? LLM_NEW_CANDIDATE_LIMIT;
  const seenIds = new Set<string>();
  const existing: ParsedRelatedConceptExisting[] = [];

  for (const item of Array.isArray(raw.existing) ? raw.existing : []) {
    if (existing.length >= existingLimit) {
      break;
    }
    if (typeof item !== "object" || item === null) {
      continue;
    }
    const record = item as Record<string, unknown>;
    const id = asNonEmptyString(record.id);
    const reason = asNonEmptyString(record.reason);
    if (!id || !reason) {
      continue;
    }
    if (!options.embeddingCandidateIds.has(id)) {
      continue;
    }
    if (options.selfId && id === options.selfId) {
      continue;
    }
    if (options.relatedIds.has(id)) {
      continue;
    }
    if (seenIds.has(id)) {
      continue;
    }
    seenIds.add(id);
    existing.push({ id, reason });
  }

  const seenTitles = new Set<string>();
  const news: ParsedRelatedConceptNew[] = [];
  for (const item of Array.isArray(raw.new) ? raw.new : []) {
    if (news.length >= newLimit) {
      break;
    }
    if (typeof item !== "object" || item === null) {
      continue;
    }
    const record = item as Record<string, unknown>;
    const title = asNonEmptyString(record.title);
    const reason = asNonEmptyString(record.reason);
    if (!title || !reason) {
      continue;
    }
    const titleKey = normalizeForSearch(title);
    if (seenTitles.has(titleKey)) {
      continue;
    }
    if (options.currentTitleNormalized && titleKey === options.currentTitleNormalized) {
      continue;
    }
    if (options.existingTitlesNormalized?.has(titleKey)) {
      continue;
    }
    seenTitles.add(titleKey);
    news.push({ title, reason });
  }

  return { existing, new: news };
};
