import { DEFAULT_HLR_PARAMETERS } from "./constants";
import type { HlrParameters } from "./types";

/**
 * IEEE-754 で 2^x が有限かつ正になるよう log2 を制限する。
 * 学習済み係数ではなく、overflow / underflow を避けるための numeric guard。
 */
const MAX_ABS_LOG2 = 1023;

const clampLog2 = (value: number): number => Math.min(MAX_ABS_LOG2, Math.max(-MAX_ABS_LOG2, value));

const finiteOrZero = (value: number): number => (Number.isFinite(value) ? value : 0);

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/**
 * Half-Life Regression により、推定半減期（日）を求める純粋関数。
 * 成功回数・失敗回数と HLR parameters のみを扱う。QuizAttemptLog や IndexedDB には依存しない。
 *
 * 原論文の h = 2^(Θ · x) に対応する。
 * log2(halfLifeDays) = intercept + successWeight × successCount + failureWeight × failureCount
 * halfLifeDays = 2 ^ log2(halfLifeDays)
 *
 * 初期 feature vector は bias / successCount / failureCount のみ。
 */
export const calculateHlrHalfLifeDays = (
  successCount: number,
  failureCount: number,
  parameters: HlrParameters = DEFAULT_HLR_PARAMETERS
): number => {
  const intercept = finiteOrZero(parameters.intercept);
  const successWeight = finiteOrZero(parameters.successWeight);
  const failureWeight = finiteOrZero(parameters.failureWeight);
  const successes = finiteOrZero(successCount);
  const failures = finiteOrZero(failureCount);

  const log2HalfLife = clampLog2(intercept + successWeight * successes + failureWeight * failures);
  const halfLifeDays = 2 ** log2HalfLife;

  if (!Number.isFinite(halfLifeDays) || halfLifeDays <= 0) {
    return 2 ** -MAX_ABS_LOG2;
  }
  return halfLifeDays;
};

/**
 * 経過日数と半減期から記憶保持確率を求める純粋関数。
 * 原論文の p = 2^(-Δ / h) に対応する。
 *
 * elapsedDays = 0 → 1、elapsedDays = halfLifeDays → 0.5。
 * 負の経過時間は 0 へ clamp し、retention が 1 を超えないようにする。
 * 異常な halfLifeDays では NaN / Infinity を返さない。
 */
export const calculateHlrRetentionProbability = (elapsedDays: number, halfLifeDays: number): number => {
  const elapsed = Number.isFinite(elapsedDays) ? Math.max(0, elapsedDays) : 0;

  if (!Number.isFinite(halfLifeDays) || halfLifeDays <= 0) {
    return elapsed === 0 ? 1 : 0;
  }

  const exponent = clampLog2(-elapsed / halfLifeDays);
  const retention = 2 ** exponent;

  if (!Number.isFinite(retention)) {
    return 0;
  }
  return clamp01(retention);
};
