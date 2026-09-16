import type { Concept } from "../../types/concept";
import type { QuizAttemptLog } from "../../types/quiz";
import { filterDataLabLogs, type DataLabFilters } from "./filterDataLabLogs";

/**
 * prediction evaluation 用フィルタ。
 * actual outcome（正答 / 誤答）は評価対象の事後選択に使わない。
 * 期間・Concept・分野・Deck など、outcome 以外の条件はそのまま残す。
 */
export const toDataLabPredictionEvaluationFilters = (filters: DataLabFilters): DataLabFilters => ({
  ...filters,
  correctness: "all"
});

export const filterDataLabPredictionEvaluationLogs = (
  logs: QuizAttemptLog[],
  filters: DataLabFilters,
  conceptById: Map<string, Concept>
): QuizAttemptLog[] => filterDataLabLogs(logs, toDataLabPredictionEvaluationFilters(filters), conceptById);
