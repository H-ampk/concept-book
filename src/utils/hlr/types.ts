/**
 * Half-Life Regression の係数。
 * 差し替え可能な明示的パラメータであり、ConceptBook の実データから推定された係数ではない。
 */
export type HlrParameters = {
  /** log2(half-life) の切片。初期デフォルト値であり、ConceptBook の実データから推定された係数ではない。 */
  intercept: number;
  /** 成功回数に対する重み。初期デフォルト値。 */
  successWeight: number;
  /** 失敗回数に対する重み。初期デフォルト値。 */
  failureWeight: number;
};

/**
 * HLR 推定の可否。
 * mastery confidence とは独立であり、流用しない。
 * 推定不能を 0 や仮の確率で表現しない。
 */
export type HlrEstimateStatus = "insufficient-data" | "estimated";

/**
 * QuizAttemptLog から導出する Concept 単位の HLR 用履歴。
 * IndexedDB には保存しない（ログから再計算する derived data）。
 */
export type HlrHistorySummary = {
  attemptCount: number;
  successCount: number;
  failureCount: number;
  distinctStudyDayCount: number;
  meanSpacingDays: number | null;
  lastAnsweredAt: string | null;
};

/**
 * QuizAttemptLog から導出する概念ごとの記憶保持推定。
 *
 * - BKT mastery: 過去の回答履歴から推定する理解状態
 * - freshness: 最終回答からの単純な経過時間ラベル
 * - HLR retention: 現在その記憶を保持している確率の推定
 * - HLR half-life: 記憶保持確率が 0.5 になるまでの推定時間
 *
 * halfLifeDays / retentionProbability は理解度・masteryScore ではない。
 * IndexedDB には保存しない（ログと parameters から再計算する derived data）。
 * status が insufficient-data のとき、推定不能を 0 や仮の確率で表現しない。
 */
export type MemoryRetentionEstimate = {
  conceptId: string;
  status: HlrEstimateStatus;

  halfLifeDays: number | null;
  elapsedDays: number | null;
  retentionProbability: number | null;

  attemptCount: number;
  successCount: number;
  failureCount: number;
  distinctStudyDayCount: number;
  meanSpacingDays: number | null;
  lastAnsweredAt: string | null;
};
