import type { QuizAttemptLog } from "../../types/quiz";
import {
  groupNormalizedEventsByConceptId,
  normalizeLearningModelEvents,
  type NormalizedLearningModelEvent
} from "../learningModel/normalizeQuizAttemptLogs";
import { DEFAULT_PFA_PARAMETERS } from "./constants";
import { calculatePfaNextCorrectProbability } from "./pfa";
import type { PfaParameters, PfaPrediction } from "./types";

export type GetConceptPfaPredictionOptions = {
  parameters?: PfaParameters;
};

const countSuccessAndFailure = (
  events: NormalizedLearningModelEvent[]
): { successCount: number; failureCount: number } => {
  let successCount = 0;
  let failureCount = 0;
  for (const event of events) {
    if (event.log.correct) {
      successCount += 1;
    } else {
      failureCount += 1;
    }
  }
  return { successCount, failureCount };
};

const buildPredictionFromEvents = (
  conceptId: string,
  events: NormalizedLearningModelEvent[],
  options?: GetConceptPfaPredictionOptions
): PfaPrediction => {
  const parameters = options?.parameters ?? DEFAULT_PFA_PARAMETERS;
  const { successCount, failureCount } = countSuccessAndFailure(events);
  return {
    conceptId,
    nextCorrectProbability: calculatePfaNextCorrectProbability(successCount, failureCount, parameters),
    successCount,
    failureCount
  };
};

/**
 * 指定 Concept の次回正答確率を QuizAttemptLog から導出する。
 * 共通 eligible events で帰属する。入力配列は破壊しない。回答順には依存しない。
 * 対象ログが 0 件でも successCount=0 / failureCount=0 として sigmoid(intercept) を返す。
 */
export const getConceptPfaPrediction = (
  logs: QuizAttemptLog[],
  conceptId: string,
  options?: GetConceptPfaPredictionOptions
): PfaPrediction => {
  const events = normalizeLearningModelEvents(logs).filter((event) => event.conceptId === conceptId);
  return buildPredictionFromEvents(conceptId, events, options);
};

/**
 * ログに現れる Concept ごとの次回正答確率を一括生成する。
 * 存在しない Concept は生成しない。入力配列は破壊しない。
 */
export const buildConceptPfaPredictionMap = (
  logs: QuizAttemptLog[],
  options?: GetConceptPfaPredictionOptions
): Map<string, PfaPrediction> => {
  const grouped = groupNormalizedEventsByConceptId(normalizeLearningModelEvents(logs));

  const map = new Map<string, PfaPrediction>();
  for (const [conceptId, events] of grouped) {
    map.set(conceptId, buildPredictionFromEvents(conceptId, events, options));
  }
  return map;
};
