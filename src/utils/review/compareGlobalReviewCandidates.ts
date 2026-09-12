import type { ConceptMastery } from "../mastery/types";
import { REVIEW_PRIORITY_RANK } from "./constants";
import type { GlobalReviewCandidate } from "./types";

const hasReliableMasteryScore = (mastery: ConceptMastery): boolean =>
  mastery.state === "learning" || mastery.state === "developing" || mastery.state === "mastered";

/**
 * 1. priority: high → medium → low
 * 2. 信頼できる masteryScore 同士のみ昇順（insufficient-data の点数は苦手度にしない）
 * 3. Concept 元配列の順
 * 4. conceptId
 */
export const compareGlobalReviewCandidates = (
  a: GlobalReviewCandidate,
  b: GlobalReviewCandidate,
  originalIndexById: ReadonlyMap<string, number>
): number => {
  const priorityCmp = REVIEW_PRIORITY_RANK[a.priority] - REVIEW_PRIORITY_RANK[b.priority];
  if (priorityCmp !== 0) {
    return priorityCmp;
  }

  if (hasReliableMasteryScore(a.mastery) && hasReliableMasteryScore(b.mastery)) {
    if (a.mastery.masteryScore !== b.mastery.masteryScore) {
      return a.mastery.masteryScore - b.mastery.masteryScore;
    }
  }

  const indexA = originalIndexById.get(a.conceptId) ?? Number.MAX_SAFE_INTEGER;
  const indexB = originalIndexById.get(b.conceptId) ?? Number.MAX_SAFE_INTEGER;
  if (indexA !== indexB) {
    return indexA - indexB;
  }

  return a.conceptId.localeCompare(b.conceptId);
};
