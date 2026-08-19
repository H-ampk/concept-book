import type { QuizAttemptLog } from "../../types/quiz";
import { DEFAULT_BKT_PARAMETERS } from "./constants";
import type { BktParameters } from "./types";

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/**
 * Bayesian Knowledge Tracing により習得確率 P(L) を推定する純粋関数。
 * 入力配列は破壊しない。answeredAt 昇順で観測を処理する。
 *
 * masteryProbability は真の理解度ではなく、回答履歴に基づく習得状態の推定値である。
 */
export const calculateBktMastery = (
  logs: QuizAttemptLog[],
  parameters: BktParameters = DEFAULT_BKT_PARAMETERS
): number => {
  const { initialMastery, learnProbability, guessProbability, slipProbability } = parameters;
  let mastery = clamp01(initialMastery);

  const ordered = [...logs].sort((a, b) => a.answeredAt.localeCompare(b.answeredAt));

  for (const log of ordered) {
    const prior = mastery;
    const denom = log.correct
      ? prior * (1 - slipProbability) + (1 - prior) * guessProbability
      : prior * slipProbability + (1 - prior) * (1 - guessProbability);

    const posterior =
      denom <= 0
        ? prior
        : log.correct
          ? (prior * (1 - slipProbability)) / denom
          : (prior * slipProbability) / denom;

    mastery = clamp01(posterior + (1 - posterior) * learnProbability);
  }

  return mastery;
};
