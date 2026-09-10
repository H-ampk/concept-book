/**
 * Performance Factors Analysis の係数。
 * 差し替え可能な明示的パラメータであり、ConceptBook の実データから推定された係数ではない。
 */
export type PfaParameters = {
  /** logit の切片。初期デフォルト値であり、ConceptBook の実データから推定された係数ではない。 */
  intercept: number;
  /** 成功回数に対する重み。初期デフォルト値。 */
  successWeight: number;
  /** 失敗回数に対する重み。初期デフォルト値。 */
  failureWeight: number;
};

/**
 * QuizAttemptLog から導出する概念ごとの次回正答確率。
 * nextCorrectProbability は理解度・習得度・mastery ではなく、次の回答が正解する確率。
 * IndexedDB には保存しない（ログから再計算する）。
 */
export type PfaPrediction = {
  conceptId: string;
  /** 次の回答が正解する確率（0〜1）。理解度・習得度ではない。 */
  nextCorrectProbability: number;
  successCount: number;
  failureCount: number;
};
