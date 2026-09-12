import type { ConceptMastery } from "../mastery/types";
import { RECENT_ERROR_MIN_INCORRECT, RECENT_ERROR_WINDOW } from "./constants";
import { daysSinceLastAnswer } from "./daysSinceLastAnswer";
import type { FrequentConfusionReason, GlobalReviewReasonDetail } from "./types";

export type CollectGlobalReviewReasonsOptions = {
  now: Date;
  frequentConfusion?: readonly FrequentConfusionReason[];
};

const isLowMastery = (mastery: ConceptMastery): boolean =>
  mastery.state === "learning" && (mastery.confidence === "medium" || mastery.confidence === "high");

const collectRecentErrors = (mastery: ConceptMastery): GlobalReviewReasonDetail | null => {
  const window = mastery.recentResults.slice(-RECENT_ERROR_WINDOW);
  if (window.length < RECENT_ERROR_WINDOW) {
    return null;
  }
  const recentIncorrectCount = window.filter((correct) => !correct).length;
  if (recentIncorrectCount < RECENT_ERROR_MIN_INCORRECT) {
    return null;
  }
  return {
    type: "recent-errors",
    recentAttemptCount: window.length,
    recentIncorrectCount
  };
};

const collectStale = (mastery: ConceptMastery, now: Date): GlobalReviewReasonDetail | null => {
  if (mastery.state === "unlearned" || mastery.freshness === "never") {
    return null;
  }
  if (mastery.freshness !== "stale" || mastery.lastAnsweredAt == null) {
    return null;
  }
  const days = daysSinceLastAnswer(mastery.lastAnsweredAt, now);
  if (days == null) {
    return null;
  }
  return {
    type: "stale",
    lastAnsweredAt: mastery.lastAnsweredAt,
    daysSinceLastAnswer: days
  };
};

/**
 * 1 Concept の global review reasons を組み立てる。
 * mastery は再計算せず、渡された ConceptMastery を source of truth にする。
 * weak-prerequisite は生成しない。
 */
export const collectGlobalReviewReasons = (
  mastery: ConceptMastery,
  options: CollectGlobalReviewReasonsOptions
): GlobalReviewReasonDetail[] => {
  const reasons: GlobalReviewReasonDetail[] = [];

  if (isLowMastery(mastery)) {
    reasons.push({
      type: "low-mastery",
      masteryScore: mastery.masteryScore,
      state: mastery.state,
      confidence: mastery.confidence
    });
  }

  if (mastery.state === "insufficient-data") {
    reasons.push({
      type: "insufficient-data",
      attemptCount: mastery.attemptCount,
      confidence: mastery.confidence
    });
  }

  const stale = collectStale(mastery, options.now);
  if (stale) {
    reasons.push(stale);
  }

  const recentErrors = collectRecentErrors(mastery);
  if (recentErrors) {
    reasons.push(recentErrors);
  }

  if (options.frequentConfusion && options.frequentConfusion.length > 0) {
    reasons.push(...options.frequentConfusion);
  }

  return reasons;
};
