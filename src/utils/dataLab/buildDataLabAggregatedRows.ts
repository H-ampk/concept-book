import type { Concept } from "../../types/concept";
import type { QuizAttemptLog, QuizDeck } from "../../types/quiz";
import type { ConceptMastery } from "../mastery/types";
import type { PfaPrediction } from "../pfa/types";
import { buildConceptHlrEstimateMap } from "../hlr/getConceptHlrEstimate";
import {
  aggregateDataLabLogs,
  type DataLabAggregateRow,
  type DataLabGroupBy
} from "./aggregateDataLabLogs";
import { attachDataLabConceptLearningModelMetrics } from "./attachDataLabConceptLearningModelMetrics";
import { fillDataLabTimeSeries } from "./fillDataLabTimeSeries";

export type BuildDataLabAggregatedRowsInput = {
  logs: QuizAttemptLog[];
  groupBy: DataLabGroupBy;
  conceptById: Map<string, Concept>;
  deckById: Map<string, QuizDeck>;
  masteryByConceptId: Map<string, ConceptMastery>;
  pfaByConceptId: Map<string, PfaPrediction>;
  hlrNow: Date;
  dateFrom?: string;
  dateTo?: string;
  /** HLR はフィルタ前の全履歴で推定する（Data Lab 表示と同じ）。 */
  hlrLogs?: QuizAttemptLog[];
};

/**
 * Data Lab の集計パイプライン。HLR の `now` だけ差し替えて再実行できる。
 * BKT / PFA は wall-clock に依存しないため、呼び出し側の memoized map を再利用する。
 */
export const buildDataLabAggregatedRows = (
  input: BuildDataLabAggregatedRowsInput
): DataLabAggregateRow[] => {
  const hlrByConceptId = buildConceptHlrEstimateMap(input.hlrLogs ?? input.logs, {
    now: input.hlrNow
  });
  const rows = aggregateDataLabLogs({
    logs: input.logs,
    groupBy: input.groupBy,
    conceptById: input.conceptById,
    deckById: input.deckById
  });
  const withModels = attachDataLabConceptLearningModelMetrics(
    rows,
    {
      masteryByConceptId: input.masteryByConceptId,
      pfaByConceptId: input.pfaByConceptId,
      hlrByConceptId
    },
    input.conceptById
  );
  return fillDataLabTimeSeries(withModels, {
    groupBy: input.groupBy,
    dateFrom: input.dateFrom,
    dateTo: input.dateTo
  });
};
