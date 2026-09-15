import type { QuizAttemptLog, QuizQuestionType } from "../../types/quiz";
import { isValidQuizSelfEvaluation, resolveQuizQuestionType } from "../quiz/quizQuestionType";
import { DEFAULT_BKT_PARAMETERS, DEFAULT_FREE_RESPONSE_BKT_EVIDENCE } from "./constants";
import type {
  BktObservationLikelihood,
  BktParameters,
  BktResolvedEvidence,
  FreeResponseBktEvidenceParameters,
  MasteryObservationOutcome
} from "./types";

export type ResolveBktEvidenceOptions = {
  parameters?: BktParameters;
  evidenceParameters?: FreeResponseBktEvidenceParameters;
};

/**
 * 四択（recognition）の likelihood。guess / slip から生成し、値はハードコードしない。
 *
 * P(correct | learned) = 1 - slip
 * P(correct | not learned) = guess
 * P(incorrect | learned) = slip
 * P(incorrect | not learned) = 1 - guess
 */
export const recognitionObservationLikelihood = (
  outcome: Exclude<MasteryObservationOutcome, "partial">,
  parameters: BktParameters = DEFAULT_BKT_PARAMETERS
): BktObservationLikelihood => {
  if (outcome === "correct") {
    return {
      probabilityIfLearned: 1 - parameters.slipProbability,
      probabilityIfNotLearned: parameters.guessProbability
    };
  }
  return {
    probabilityIfLearned: parameters.slipProbability,
    probabilityIfNotLearned: 1 - parameters.guessProbability
  };
};

/**
 * 次回「正解」予測に使う observation model。
 * 未指定 / 旧ログ相当は multiple-choice（既存 BKT 互換）。
 */
export const getBktCorrectObservationLikelihood = (
  questionType: QuizQuestionType | undefined,
  parameters: BktParameters = DEFAULT_BKT_PARAMETERS,
  evidenceParameters: FreeResponseBktEvidenceParameters = DEFAULT_FREE_RESPONSE_BKT_EVIDENCE
): BktObservationLikelihood => {
  if (resolveQuizQuestionType(questionType) === "free-response") {
    return evidenceParameters.correct;
  }
  return recognitionObservationLikelihood("correct", parameters);
};

const resolveFreeResponseOutcome = (log: QuizAttemptLog): MasteryObservationOutcome => {
  if (isValidQuizSelfEvaluation(log.selfEvaluation)) {
    return log.selfEvaluation;
  }
  return log.correct ? "correct" : "incorrect";
};

/**
 * QuizAttemptLog から BKT 用 evidence を導出する。IndexedDB には保存しない。
 *
 * - multiple-choice: recognition。correct boolean のみを correct / incorrect に写す。
 * - free-response: recall。selfEvaluation を優先し、無い malformed ログだけ correct boolean へ fallback。
 * - questionType 欠落の旧ログは resolveQuizQuestionType により multiple-choice。
 */
export const resolveBktEvidence = (
  log: QuizAttemptLog,
  options?: ResolveBktEvidenceOptions
): BktResolvedEvidence => {
  const parameters = options?.parameters ?? DEFAULT_BKT_PARAMETERS;
  const evidenceParameters = options?.evidenceParameters ?? DEFAULT_FREE_RESPONSE_BKT_EVIDENCE;
  const questionType = resolveQuizQuestionType(log.questionType);

  if (questionType === "free-response") {
    const outcome = resolveFreeResponseOutcome(log);
    const evidence: BktResolvedEvidence = {
      kind: "recall",
      outcome,
      likelihood: evidenceParameters[outcome],
      questionType
    };
    if (isValidQuizSelfEvaluation(log.selfEvaluation)) {
      evidence.selfEvaluation = log.selfEvaluation;
    }
    return evidence;
  }

  const outcome: Exclude<MasteryObservationOutcome, "partial"> = log.correct ? "correct" : "incorrect";
  return {
    kind: "recognition",
    outcome,
    likelihood: recognitionObservationLikelihood(outcome, parameters),
    questionType: "multiple-choice"
  };
};
