import { calculateBktNextCorrectProbability } from "../mastery/bkt";
import { DEFAULT_BKT_PARAMETERS } from "../mastery/constants";
import type { BktParameters } from "../mastery/types";
import { DEFAULT_PFA_PARAMETERS } from "../pfa/constants";
import { getConceptPfaPrediction } from "../pfa/getConceptPfaPrediction";
import type { PfaParameters } from "../pfa/types";
import type { LearningModelPredictor } from "./types";

export const BKT_LEARNING_MODEL_ID = "bkt";
export const PFA_LEARNING_MODEL_ID = "pfa";

/**
 * BKT の one-step-ahead predictor。
 *
 * masteryProbability P(L) ではなく、observation model による
 * nextCorrectProbability P(correct) を返す。
 * 履歴 0 件でも initialMastery を prior として予測する。
 */
export const createBktLearningModelPredictor = (
  parameters: BktParameters = DEFAULT_BKT_PARAMETERS
): LearningModelPredictor => ({
  id: BKT_LEARNING_MODEL_ID,
  predictNextCorrectProbability({ historyLogs }) {
    return calculateBktNextCorrectProbability(historyLogs, parameters);
  }
});

/**
 * PFA の one-step-ahead predictor。
 *
 * 既存の getConceptPfaPrediction を再利用する。PFA 計算は再実装しない。
 * nextCorrectProbability は理解度・mastery ではなく、次の回答が正解する確率である。
 * 履歴 0 件でも successCount=0 / failureCount=0 から intercept の sigmoid を prior とする。
 */
export const createPfaLearningModelPredictor = (
  parameters: PfaParameters = DEFAULT_PFA_PARAMETERS
): LearningModelPredictor => ({
  id: PFA_LEARNING_MODEL_ID,
  predictNextCorrectProbability({ conceptId, historyLogs }) {
    return getConceptPfaPrediction(historyLogs, conceptId, { parameters }).nextCorrectProbability;
  }
});
