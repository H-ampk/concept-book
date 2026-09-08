import type { Concept } from "../../types/concept";
import type { ConceptMastery } from "../mastery/types";
import type { DataLabAggregateRow } from "./aggregateDataLabLogs";

/**
 * フィルタ済み集計行に、全履歴から求めた現在理解度を接続する。
 * BKT は再計算せず `buildConceptMasteryMap` の結果を参照する。
 */
export const attachDataLabConceptMastery = (
  rows: DataLabAggregateRow[],
  masteryByConceptId: Map<string, ConceptMastery>,
  conceptById: Map<string, Concept>
): DataLabAggregateRow[] =>
  rows.map((row) => {
    if (row.groupBy !== "concept") {
      return { ...row, masteryProbability: null };
    }

    const conceptId = row.conceptId?.trim() || null;
    if (!conceptId) {
      return { ...row, masteryProbability: null };
    }

    if (!conceptById.has(conceptId)) {
      return { ...row, masteryProbability: null };
    }

    const mastery = masteryByConceptId.get(conceptId);
    if (!mastery) {
      return { ...row, masteryProbability: null };
    }

    return { ...row, masteryProbability: mastery.masteryProbability };
  });
