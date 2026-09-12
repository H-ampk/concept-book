import type { QuizAttemptLog } from "../../types/quiz";
import { DEFAULT_BKT_PARAMETERS } from "./constants";
import type { BktParameters } from "./types";

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/**
 * 1回答分の BKT 更新。prior mastery に対して observation と learning transition を適用する。
 * 現在値計算と mastery 履歴計算で同一の更新式を使う。
 */
export const calculateBktMasteryAfterObservation = (
  priorMastery: number,
  correct: boolean,
  parameters: BktParameters = DEFAULT_BKT_PARAMETERS
): number => {
  const { learnProbability, guessProbability, slipProbability } = parameters;
  const prior = clamp01(priorMastery);
  const denom = correct
    ? prior * (1 - slipProbability) + (1 - prior) * guessProbability
    : prior * slipProbability + (1 - prior) * (1 - guessProbability);

  const posterior =
    denom <= 0
      ? prior
      : correct
        ? (prior * (1 - slipProbability)) / denom
        : (prior * slipProbability) / denom;

  return clamp01(posterior + (1 - posterior) * learnProbability);
};

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
  let mastery = clamp01(parameters.initialMastery);

  const ordered = [...logs].sort((a, b) => a.answeredAt.localeCompare(b.answeredAt));

  for (const log of ordered) {
    mastery = calculateBktMasteryAfterObservation(mastery, log.correct, parameters);
  }

  return mastery;
};

/**
 * BKT observation model により、次回正答確率 P(correct) を算出する純粋関数。
 *
 * P(correct) = P(L) × (1 - slipProbability) + (1 - P(L)) × guessProbability
 *
 * masteryProbability P(L) と nextCorrectProbability P(correct) は同一ではない。
 * masteryProbability をそのまま「次回正答確率」として使ってはいけない。
 *
 * 履歴 0 件では initialMastery を prior として予測する（1回答目も予測可能）。
 * 返値は常に 0 <= p <= 1。入力配列は破壊しない。
 */
export const calculateBktNextCorrectProbability = (
  logs: QuizAttemptLog[],
  parameters: BktParameters = DEFAULT_BKT_PARAMETERS
): number => {
  const masteryProbability = calculateBktMastery(logs, parameters);
  const { guessProbability, slipProbability } = parameters;
  const nextCorrectProbability =
    masteryProbability * (1 - slipProbability) + (1 - masteryProbability) * guessProbability;
  return clamp01(nextCorrectProbability);
};
