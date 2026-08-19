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
  /** P(G): 未習得でも正解する確率。初期デフォルト値。 */
  guessProbability: number;
  /** P(S): 習得済みでも誤答する確率。初期デフォルト値。 */
  slipProbability: number;
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
