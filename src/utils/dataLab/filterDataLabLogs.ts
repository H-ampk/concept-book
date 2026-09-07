import type { Concept } from "../../types/concept";
import type { QuizAttemptLog } from "../../types/quiz";
import { filterLogsByAnsweredDateRange } from "../quizAttemptDateFilter";

export type DataLabCorrectness = "all" | "correct" | "incorrect";

export type DataLabFilters = {
  dateFrom: string;
  dateTo: string;
  conceptIds: string[];
  domainTags: string[];
  deckIds: string[];
  correctness: DataLabCorrectness;
};

export const DEFAULT_DATA_LAB_FILTERS: DataLabFilters = {
  dateFrom: "",
  dateTo: "",
  conceptIds: [],
  domainTags: [],
  deckIds: [],
  correctness: "all"
};

/** Data Lab の分析対象 Concept。`conceptId` 優先、無い旧ログは `questionConceptId`。 */
export const getDataLabLogConceptId = (log: QuizAttemptLog): string | null => {
  const conceptId = log.conceptId?.trim();
  if (conceptId) {
    return conceptId;
  }
  const questionConceptId = log.questionConceptId?.trim();
  if (questionConceptId) {
    return questionConceptId;
  }
  return null;
};

export const isDataLabFiltersDefault = (filters: DataLabFilters): boolean =>
  filters.dateFrom.trim() === "" &&
  filters.dateTo.trim() === "" &&
  filters.conceptIds.length === 0 &&
  filters.domainTags.length === 0 &&
  filters.deckIds.length === 0 &&
  filters.correctness === "all";

const matchesSelectedIds = (selected: string[], value: string | null | undefined): boolean => {
  if (selected.length === 0) {
    return true;
  }
  if (!value) {
    return false;
  }
  return selected.includes(value);
};

const matchesDomainTags = (
  selected: string[],
  conceptId: string | null,
  conceptById: Map<string, Concept>
): boolean => {
  if (selected.length === 0) {
    return true;
  }
  if (!conceptId) {
    return false;
  }
  const concept = conceptById.get(conceptId);
  if (!concept) {
    return false;
  }
  const tags = concept.domainTags ?? [];
  return selected.some((tag) => tags.includes(tag));
};

const matchesCorrectness = (correctness: DataLabCorrectness, correct: boolean): boolean => {
  if (correctness === "all") {
    return true;
  }
  if (correctness === "correct") {
    return correct === true;
  }
  return correct === false;
};

/**
 * Data Lab 共通フィルタ。種類同士は AND、同一種類の複数値は OR。
 * 期間判定は `filterLogsByAnsweredDateRange` を再利用する。
 */
export const filterDataLabLogs = (
  logs: QuizAttemptLog[],
  filters: DataLabFilters,
  conceptById: Map<string, Concept>
): QuizAttemptLog[] => {
  const inPeriod = filterLogsByAnsweredDateRange(logs, filters.dateFrom, filters.dateTo);
  return inPeriod.filter((log) => {
    const conceptId = getDataLabLogConceptId(log);
    return (
      matchesSelectedIds(filters.conceptIds, conceptId) &&
      matchesDomainTags(filters.domainTags, conceptId, conceptById) &&
      matchesSelectedIds(filters.deckIds, log.deckId) &&
      matchesCorrectness(filters.correctness, log.correct)
    );
  });
};
