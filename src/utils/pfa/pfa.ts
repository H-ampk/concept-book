import { DEFAULT_PFA_PARAMETERS } from "./constants";
import type { PfaParameters } from "./types";

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/** logit を 0〜1 の確率へ写す。極端な logit でも数値的に安定するよう符号で分岐する。 */
const sigmoid = (logit: number): number => {
  if (logit >= 0) {
    return 1 / (1 + Math.exp(-logit));
  }
  const expPos = Math.exp(logit);
  return expPos / (1 + expPos);
};

/**
 * Performance Factors Analysis により、次回正答確率 P(correct) を推定する純粋関数。
 * 成功回数・失敗回数と PFA parameters のみを扱う。QuizAttemptLog や IndexedDB には依存しない。
 *
 * logit(P(correct)) = intercept + successWeight × successCount + failureWeight × failureCount
 * P(correct) = 1 / (1 + exp(-logit))
 *
 * nextCorrectProbability は理解度・習得度ではなく、次の回答が正解する確率である。
 */
export const calculatePfaNextCorrectProbability = (
  successCount: number,
  failureCount: number,
  parameters: PfaParameters = DEFAULT_PFA_PARAMETERS
): number => {
  const logit =
    parameters.intercept +
    parameters.successWeight * successCount +
    parameters.failureWeight * failureCount;
  return clamp01(sigmoid(logit));
};
