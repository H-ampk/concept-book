import type { Concept } from "../../types/concept";
import type { ConceptMastery } from "../mastery/types";
import type { PfaPrediction } from "../pfa/types";
import type { MemoryRetentionEstimate } from "../hlr/types";
import {
  DATA_LAB_EMPTY_LEARNING_MODEL_METRICS,
  type DataLabAggregateRow,
  type DataLabLearningModelMetrics
} from "./aggregateDataLabLogs";

export type DataLabConceptLearningModelMaps = {
  masteryByConceptId: Map<string, ConceptMastery>;
  pfaByConceptId: Map<string, PfaPrediction>;
  hlrByConceptId: Map<string, MemoryRetentionEstimate>;
};

const emptyMetrics = (): DataLabLearningModelMetrics => ({
  ...DATA_LAB_EMPTY_LEARNING_MODEL_METRICS
});

const metricsForConcept = (
  conceptId: string,
  maps: DataLabConceptLearningModelMaps
): DataLabLearningModelMetrics => {
  const mastery = maps.masteryByConceptId.get(conceptId);
  const pfa = maps.pfaByConceptId.get(conceptId);
  const hlr = maps.hlrByConceptId.get(conceptId);

  return {
    masteryProbability: mastery?.masteryProbability ?? null,
    pfaNextCorrectProbability: pfa?.nextCorrectProbability ?? null,
    pfaSuccessCount: pfa?.successCount ?? null,
    pfaFailureCount: pfa?.failureCount ?? null,
    hlrRetentionProbability: hlr?.retentionProbability ?? null,
    hlrHalfLifeDays: hlr?.halfLifeDays ?? null,
    hlrElapsedDays: hlr?.elapsedDays ?? null
  };
};

/**
 * フィルタ済み集計行に、全履歴から求めた学習モデル現在値を接続する。
 * BKT / PFA / HLR は再計算せず、各 build*Map の結果を参照する。
 * Concept 以外・Concept なし・削除済み Concept は欠損（null）であり 0 ではない。
 */
export const attachDataLabConceptLearningModelMetrics = (
  rows: DataLabAggregateRow[],
  maps: DataLabConceptLearningModelMaps,
  conceptById: Map<string, Concept>
): DataLabAggregateRow[] =>
  rows.map((row) => {
    if (row.groupBy !== "concept") {
      return { ...row, ...emptyMetrics() };
    }

    const conceptId = row.conceptId?.trim() || null;
    if (!conceptId || !conceptById.has(conceptId)) {
      return { ...row, ...emptyMetrics() };
    }

    return { ...row, ...metricsForConcept(conceptId, maps) };
  });
