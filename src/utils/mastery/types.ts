import type { QuizQuestionType, QuizSelfEvaluation } from "../../types/quiz";

export type MasteryState =
  | "unlearned"
  | "insufficient-data"
  | "learning"
  | "developing"
  | "mastered";

export type MasteryConfidence = "none" | "low" | "medium" | "high";

export type MasteryFreshness = "never" | "fresh" | "aging" | "stale";

export type BktParameters = {
  /** P(L0): 未回答時点で習得済みである事前確率。初期デフォルト値であり実証推定値ではない。 */
  initialMastery: number;
  /** P(T): 1回の学習機会で未習得から習得へ移行する確率。初期デフォルト値。 */
  learnProbability: number;
  /** P(G): 未習得でも正解する確率（四択 / recognition の observation model）。初期デフォルト値。 */
  guessProbability: number;
  /** P(S): 習得済みでも誤答する確率（四択 / recognition の observation model）。初期デフォルト値。 */
  slipProbability: number;
};

/** 四択は再認、入力式は再生の学習証拠として扱う。 */
export type MasteryEvidenceKind = "recognition" | "recall";

/** BKT が観測する回答結果。partial は入力式の自己評価のみ。 */
export type MasteryObservationOutcome = "correct" | "partial" | "incorrect";

/**
 * 1観測が learned / not-learned の各状態で起きる尤度。
 * QuizAttemptLog から導出する derived data であり、IndexedDB には保存しない。
 */
export type BktObservationLikelihood = {
  probabilityIfLearned: number;
  probabilityIfNotLearned: number;
};

/**
 * 入力式（再生 / recall）の 3 状態 observation likelihood。
 * 将来 Data Lab 等で比較できるよう型を切っている。実データ calibration 値ではない。
 */
export type FreeResponseBktEvidenceParameters = {
  correct: BktObservationLikelihood;
  partial: BktObservationLikelihood;
  incorrect: BktObservationLikelihood;
};

/**
 * QuizAttemptLog から毎回導出する BKT 観測。永続化しない。
 * recognition = 四択、recall = 入力式。
 */
export type BktResolvedEvidence = {
  kind: MasteryEvidenceKind;
  outcome: MasteryObservationOutcome;
  likelihood: BktObservationLikelihood;
  questionType: QuizQuestionType;
  selfEvaluation?: QuizSelfEvaluation;
};

/**
 * QuizAttemptLog から導出する概念ごとの学習状態。
 * masteryProbability は「真の理解」ではなく、現在の回答履歴に基づく習得状態の推定値。
 * IndexedDB には保存しない（ログから再計算する）。
 */
export type ConceptMastery = {
  conceptId: string;
  masteryProbability: number;
  masteryScore: number;
  state: MasteryState;
  attemptCount: number;
  correctCount: number;
  incorrectCount: number;
  accuracy: number | null;
  confidence: MasteryConfidence;
  lastAnsweredAt: string | null;
  freshness: MasteryFreshness;
  recentResults: boolean[];
  avgReactionTimeMs: number | null;
};

/**
 * 1回答直後の BKT Concept mastery。QuizAttemptLog から必要なときに再計算する派生点。
 * IndexedDB には保存しない。
 */
export type ConceptMasteryPoint = {
  conceptId: string;
  /** 対象 Concept における 1 始まりの回答回数 */
  attemptIndex: number;
  answeredAt: string;
  correct: boolean;
  masteryProbability: number;
  masteryScore: number;
  previousMasteryProbability: number;
  previousMasteryScore: number;
  /** masteryScore の差分（今回 − 前回）。最初の回答の前回は initialMastery。 */
  masteryDelta: number;
  quizAttemptLogId: string;
  questionId: string;
  questionPromptSnapshot: string;
  timeMs: number;
  sessionId?: string;
  /** 回答形式。旧ログは multiple-choice に正規化した derived 値。 */
  questionType: QuizQuestionType;
  /** 四択は recognition、入力式は recall。 */
  evidenceKind: MasteryEvidenceKind;
  /** BKT が使った観測結果。partial は入力式自己評価由来。 */
  observationOutcome: MasteryObservationOutcome;
  /** 入力式で自己評価がある場合のみ。IndexedDB には別保存しない。 */
  selfEvaluation?: QuizSelfEvaluation;
};
