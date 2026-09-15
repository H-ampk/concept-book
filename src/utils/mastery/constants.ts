import type {
  BktParameters,
  FreeResponseBktEvidenceParameters,
  MasteryConfidence,
  MasteryFreshness,
  MasteryState
} from "./types";

/**
 * ConceptBook 用 BKT の初期デフォルト値。
 * 実データから学習・検証された値ではない。将来 Data Lab 等で調整可能な構造にしている。
 * guess / slip は四択（recognition）の binary observation model に使う。
 */
export const DEFAULT_BKT_PARAMETERS: BktParameters = {
  initialMastery: 0.2,
  learnProbability: 0.1,
  guessProbability: 0.2,
  slipProbability: 0.1
};

/**
 * 入力式（再生 / recall）の observation likelihood。
 * 実データから calibration された値ではなく、初期 heuristic parameter である。
 *
 * - correct: 再認より偶然正解しにくい再生 evidence。四択正解より強い。
 * - partial: P(obs | learned) = P(obs | not learned) のため posterior は動かず、
 *   learnProbability による学習遷移だけが主に作用する。
 * - incorrect: 選択肢なしでは再生できなかった evidence。
 *
 * 各状態の 3 outcome 合計は 1.0。固定点加算ではない。
 */
export const DEFAULT_FREE_RESPONSE_BKT_EVIDENCE: FreeResponseBktEvidenceParameters = {
  correct: {
    probabilityIfLearned: 0.8,
    probabilityIfNotLearned: 0.1
  },
  partial: {
    probabilityIfLearned: 0.15,
    probabilityIfNotLearned: 0.15
  },
  incorrect: {
    probabilityIfLearned: 0.05,
    probabilityIfNotLearned: 0.75
  }
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
