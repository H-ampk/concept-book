import type { ConceptMastery, MasteryConfidence, MasteryState } from "../mastery/types";

export type ReviewReason =
  | "low-mastery"
  | "insufficient-data"
  | "stale"
  | "recent-errors"
  | "frequent-confusion"
  | "weak-prerequisite";

/** global review（selected target なし）で生成する理由。weak-prerequisite は selected-context 用に予約。 */
export type GlobalReviewReason = Exclude<ReviewReason, "weak-prerequisite">;

export type ReviewPriority = "high" | "medium" | "low";

export type LowMasteryReason = {
  type: "low-mastery";
  masteryScore: number;
  state: MasteryState;
  confidence: MasteryConfidence;
};

export type InsufficientDataReason = {
  type: "insufficient-data";
  attemptCount: number;
  confidence: MasteryConfidence;
};

export type StaleReason = {
  type: "stale";
  lastAnsweredAt: string;
  daysSinceLastAnswer: number;
};

export type RecentErrorsReason = {
  type: "recent-errors";
  recentAttemptCount: number;
  recentIncorrectCount: number;
};

export type FrequentConfusionReason = {
  type: "frequent-confusion";
  otherConceptId: string;
  confusionCount: number;
};

/**
 * selected-context 用。#118 / #121 接続までは生成しない。
 * 仮の prerequisite schema や独自 satisfaction 判定は置かない。
 */
export type WeakPrerequisiteReason = {
  type: "weak-prerequisite";
  targetConceptId: string;
  prerequisiteId: string;
};

export type ReviewReasonDetail =
  | LowMasteryReason
  | InsufficientDataReason
  | StaleReason
  | RecentErrorsReason
  | FrequentConfusionReason
  | WeakPrerequisiteReason;

export type GlobalReviewReasonDetail = Exclude<ReviewReasonDetail, WeakPrerequisiteReason>;

export type ReviewCandidate = {
  conceptId: string;
  mastery: ConceptMastery;
  priority: ReviewPriority;
  reasons: ReviewReasonDetail[];
  hasQuizQuestion: boolean;
};

export type GlobalReviewCandidate = Omit<ReviewCandidate, "reasons"> & {
  reasons: GlobalReviewReasonDetail[];
};
