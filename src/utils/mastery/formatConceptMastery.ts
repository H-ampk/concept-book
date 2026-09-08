import { formatRelativeDate } from "../quiz/formatConceptQuizStats";
import { formatSecondsFromMs } from "../quizStats";
import {
  MASTERY_CONFIDENCE_LABELS,
  MASTERY_FRESHNESS_LABELS,
  MASTERY_STATE_LABELS
} from "./constants";
import type { ConceptMastery } from "./types";

const formatRecentMarks = (recentResults: boolean[]): string =>
  recentResults.map((ok) => (ok ? "○" : "×")).join("");

/** Concept 詳細の `masteryScore` と同じ丸め（0〜1 → 0〜100 の整数）。 */
export const toConceptMasteryScore = (masteryProbability: number): number =>
  Math.round(masteryProbability * 100);

export const formatConceptMasteryProbability = (masteryProbability: number | null): string | null => {
  if (masteryProbability == null) {
    return null;
  }
  return `${toConceptMasteryScore(masteryProbability)}%`;
};

const formatAccuracyPct = (accuracy: number | null): string | null => {
  if (accuracy == null) {
    return null;
  }
  return `${Math.round(accuracy * 100)}%`;
};

export type ConceptMasteryDetailView = {
  stateLabel: string;
  showScore: boolean;
  scoreText: string;
  isReferenceScore: boolean;
  confidenceLabel: string;
  accuracyText: string | null;
  attemptText: string | null;
  lastAnsweredText: string | null;
  freshnessLabel: string;
  recentMarks: string | null;
  avgReactionText: string | null;
};

export const toConceptMasteryDetailView = (
  mastery: ConceptMastery,
  now = new Date()
): ConceptMasteryDetailView => {
  const unlearned = mastery.state === "unlearned";
  return {
    stateLabel: MASTERY_STATE_LABELS[mastery.state],
    showScore: !unlearned,
    scoreText: `理解度 ${toConceptMasteryScore(mastery.masteryProbability)} / 100`,
    isReferenceScore: mastery.state === "insufficient-data",
    confidenceLabel: MASTERY_CONFIDENCE_LABELS[mastery.confidence],
    accuracyText: formatAccuracyPct(mastery.accuracy),
    attemptText: unlearned ? null : `${mastery.attemptCount}回`,
    lastAnsweredText:
      mastery.lastAnsweredAt != null ? formatRelativeDate(mastery.lastAnsweredAt, now) : null,
    freshnessLabel: MASTERY_FRESHNESS_LABELS[mastery.freshness],
    recentMarks: mastery.recentResults.length > 0 ? formatRecentMarks(mastery.recentResults) : null,
    avgReactionText:
      mastery.avgReactionTimeMs != null ? formatSecondsFromMs(mastery.avgReactionTimeMs) : null
  };
};
