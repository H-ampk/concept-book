import type { BktParameters, MasteryConfidence, MasteryFreshness, MasteryState } from "./types";

/**
 * ConceptBook 用 BKT の初期デフォルト値。
 * 実データから学習・検証された値ではない。将来 Data Lab 等で調整可能な構造にしている。
 */
export const DEFAULT_BKT_PARAMETERS: BktParameters = {
  initialMastery: 0.2,
  learnProbability: 0.1,
  guessProbability: 0.2,
  slipProbability: 0.1
};

export const RECENT_RESULTS_LIMIT = 5;

export const MASTERY_STATE_LABELS: Record<MasteryState, string> = {
  unlearned: "未学習",
  "insufficient-data": "データ不足",
  learning: "学習中",
  developing: "理解が進んでいる",
  mastered: "おおむね理解"
};

export const MASTERY_CONFIDENCE_LABELS: Record<MasteryConfidence, string> = {
  none: "未評価",
  low: "データ不足",
  medium: "中",
  high: "高"
};

export const MASTERY_FRESHNESS_LABELS: Record<MasteryFreshness, string> = {
  never: "未学習",
  fresh: "最近確認",
  aging: "しばらく未確認",
  stale: "要再確認"
};
