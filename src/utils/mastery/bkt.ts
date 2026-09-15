import type { QuizAttemptLog, QuizQuestionType } from "../../types/quiz";
import {
  logsFromNormalizedSequence,
  normalizeQuizAttemptLogSequence
} from "../learningModel/normalizeQuizAttemptLogs";
import { DEFAULT_BKT_PARAMETERS, DEFAULT_FREE_RESPONSE_BKT_EVIDENCE } from "./constants";
import {
  getBktCorrectObservationLikelihood,
  recognitionObservationLikelihood,
  resolveBktEvidence
} from "./resolveBktEvidence";
import type {
  BktObservationLikelihood,
  BktParameters,
  FreeResponseBktEvidenceParameters
} from "./types";

const clamp01 = (value: number): number => {
  if (Number.isNaN(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
};

const finiteOrZero = (value: number): number => (Number.isFinite(value) ? value : 0);

export type CalculateBktNextCorrectProbabilityOptions = {
  /** 予測対象の問題形式。未指定時は multiple-choice（既存 API 互換）。 */
  targetQuestionType?: QuizQuestionType;
  evidenceParameters?: FreeResponseBktEvidenceParameters;
};

/**
 * likelihood を使う共通 BKT 更新。
 *
 * posterior = prior * P(obs | learned)
 *   / (prior * P(obs | learned) + (1 - prior) * P(obs | not learned))
 * afterLearning = posterior + (1 - posterior) * learnProbability
 *
 * 0 除算・NaN・Infinity を返さず、最終値は [0, 1] に clamp する。
 */
export const calculateBktMasteryAfterEvidence = (
  priorMastery: number,
  likelihood: BktObservationLikelihood,
  learnProbability: number
): number => {
  const prior = clamp01(priorMastery);
  const probabilityIfLearned = finiteOrZero(likelihood.probabilityIfLearned);
  const probabilityIfNotLearned = finiteOrZero(likelihood.probabilityIfNotLearned);
  const learn = clamp01(learnProbability);
  const denom = prior * probabilityIfLearned + (1 - prior) * probabilityIfNotLearned;
  const posterior = denom <= 0 ? prior : (prior * probabilityIfLearned) / denom;
  if (!Number.isFinite(posterior)) {
    return clamp01(prior + (1 - prior) * learn);
  }
  return clamp01(posterior + (1 - posterior) * learn);
};

/**
 * 1回答分の BKT 更新。従来の multiple-choice binary BKT 互換 wrapper。
 * P(correct | learned) = 1 - slip、P(correct | not learned) = guess。
 * 現在値計算と mastery 履歴計算で同一の更新式を使うための公開 API として残す。
 */
export const calculateBktMasteryAfterObservation = (
  priorMastery: number,
  correct: boolean,
  parameters: BktParameters = DEFAULT_BKT_PARAMETERS
): number => {
  const likelihood = recognitionObservationLikelihood(correct ? "correct" : "incorrect", parameters);
  return calculateBktMasteryAfterEvidence(priorMastery, likelihood, parameters.learnProbability);
};

/**
 * QuizAttemptLog 1件から evidence を導出し、likelihood で BKT を更新する。
 * calculateBktMastery と getConceptMasteryHistory が同じ更新式を使うための入口。
 */
export const calculateBktMasteryAfterLog = (
  priorMastery: number,
  log: QuizAttemptLog,
  parameters: BktParameters = DEFAULT_BKT_PARAMETERS,
  evidenceParameters: FreeResponseBktEvidenceParameters = DEFAULT_FREE_RESPONSE_BKT_EVIDENCE
): number => {
  const evidence = resolveBktEvidence(log, { parameters, evidenceParameters });
  return calculateBktMasteryAfterEvidence(priorMastery, evidence.likelihood, parameters.learnProbability);
};

/**
 * Bayesian Knowledge Tracing により習得確率 P(L) を推定する純粋関数。
 * 入力配列は破壊しない。Invalid Date を除外し、実時刻 timeMs ASC → id ASC で観測する。
 *
 * 四択は recognition（guess / slip）、入力式は recall（selfEvaluation の 3 状態）として観測する。
 * masteryProbability は真の理解度ではなく、回答履歴に基づく習得状態の推定値である。
 */
export const calculateBktMastery = (
  logs: QuizAttemptLog[],
  parameters: BktParameters = DEFAULT_BKT_PARAMETERS,
  evidenceParameters: FreeResponseBktEvidenceParameters = DEFAULT_FREE_RESPONSE_BKT_EVIDENCE
): number => {
  let mastery = clamp01(parameters.initialMastery);

  const ordered = logsFromNormalizedSequence(normalizeQuizAttemptLogSequence(logs));

  for (const log of ordered) {
    mastery = calculateBktMasteryAfterLog(mastery, log, parameters, evidenceParameters);
  }

  return mastery;
};

/**
 * BKT observation model により、次回正答確率 P(correct) を算出する純粋関数。
 *
 * multiple-choice（デフォルト）:
 *   P(correct) = P(L) × (1 - slipProbability) + (1 - P(L)) × guessProbability
 *
 * free-response:
 *   P(correct) = P(L) × P(correct | learned) + (1 - P(L)) × P(correct | not learned)
 *   初期 heuristic では 0.80 / 0.10。
 *
 * masteryProbability P(L) と nextCorrectProbability P(correct) は同一ではない。
 * 履歴 0 件では initialMastery を prior として予測する（1回答目も予測可能）。
 * 返値は常に 0 <= p <= 1。入力配列は破壊しない。
 */
export const calculateBktNextCorrectProbability = (
  logs: QuizAttemptLog[],
  parameters: BktParameters = DEFAULT_BKT_PARAMETERS,
  options?: CalculateBktNextCorrectProbabilityOptions
): number => {
  const evidenceParameters = options?.evidenceParameters ?? DEFAULT_FREE_RESPONSE_BKT_EVIDENCE;
  const masteryProbability = calculateBktMastery(logs, parameters, evidenceParameters);
  const likelihood = getBktCorrectObservationLikelihood(
    options?.targetQuestionType,
    parameters,
    evidenceParameters
  );
  const nextCorrectProbability =
    masteryProbability * finiteOrZero(likelihood.probabilityIfLearned) +
    (1 - masteryProbability) * finiteOrZero(likelihood.probabilityIfNotLearned);
  return clamp01(nextCorrectProbability);
};
