import type { PrerequisiteSatisfactionReason } from "../learningSequence/isSatisfiedPrerequisite";
import type { ConceptMastery, MasteryConfidence, MasteryState } from "../mastery/types";

export type ReviewReason =
  | "low-mastery"
  | "insufficient-data"
  | "stale"
  | "recent-errors"
  | "frequent-confusion"
  | "weak-prerequisite";

/** global review（selected target なし）で生成する理由。weak-prerequisite は selected-context 専用。 */
export type GlobalReviewReason = Exclude<ReviewReason, "weak-prerequisite">;

/** candidate になり得る satisfaction。satisfied-prerequisite は weak reason に入れない。 */
export type WeakPrerequisiteSatisfactionReason = Exclude<
  PrerequisiteSatisfactionReason,
  "satisfied-prerequisite"
>;

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
 * selected-context 用。#121 の active prerequisite closure を復習候補へ変換した理由。
 * satisfaction 判定は `isSatisfiedPrerequisite` / `getPrerequisiteSatisfactionReason` を再利用する。
 */
export type WeakPrerequisiteReason = {
  type: "weak-prerequisite";
  targetConceptId: string;
  prerequisiteId: string;
  prerequisiteDepth: number;
  satisfactionReason: WeakPrerequisiteSatisfactionReason;
  state?: MasteryState;
  confidence?: MasteryConfidence;
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

/**
 * いま選択している target を学ぶための前提補強候補。
 * global review の ReviewPriority は持たない。
 */
export type SelectedContextReviewCandidate = {
  conceptId: string;
  targetConceptId: string;
  mastery?: ConceptMastery;
  reason: WeakPrerequisiteReason;
  hasQuizQuestion: boolean;
};

export type SelectedContextReviewOk = {
  status: "ok";
  targetConceptId: string;
  candidates: SelectedContextReviewCandidate[];
  targetAlreadyMastered: boolean;
};

export type SelectedContextReviewUnavailable = {
  status: "target-not-found" | "cycle-detected";
  targetConceptId: string;
  candidates: [];
};

export type SelectedContextReviewResult =
  | SelectedContextReviewOk
  | SelectedContextReviewUnavailable;
