import type { QuizAttemptLog } from "../../types/quiz";
import { resolveConceptIdFromLog } from "../quiz/resolveConceptIdFromLog";
import { DEFAULT_PFA_PARAMETERS } from "./constants";
import { calculatePfaNextCorrectProbability } from "./pfa";
import type { PfaParameters, PfaPrediction } from "./types";

export type GetConceptPfaPredictionOptions = {
  parameters?: PfaParameters;
};

const countSuccessAndFailure = (conceptLogs: QuizAttemptLog[]): { successCount: number; failureCount: number } => {
  let successCount = 0;
  let failureCount = 0;
  for (const log of conceptLogs) {
    if (log.correct) {
      successCount += 1;
    } else {
      failureCount += 1;
    }
  }
  return { successCount, failureCount };
};

const buildPredictionFromLogs = (
  conceptId: string,
  conceptLogs: QuizAttemptLog[],
  options?: GetConceptPfaPredictionOptions
): PfaPrediction => {
  const parameters = options?.parameters ?? DEFAULT_PFA_PARAMETERS;
  const { successCount, failureCount } = countSuccessAndFailure(conceptLogs);
  return {
    conceptId,
    nextCorrectProbability: calculatePfaNextCorrectProbability(successCount, failureCount, parameters),
    successCount,
    failureCount
  };
};

/**
 * 指定 Concept の次回正答確率を QuizAttemptLog から導出する。
 * resolveConceptIdFromLog() で帰属する。入力配列は破壊しない。回答順には依存しない。
 * 対象ログが 0 件でも successCount=0 / failureCount=0 として sigmoid(intercept) を返す。
 */
export const getConceptPfaPrediction = (
  logs: QuizAttemptLog[],
  conceptId: string,
  options?: GetConceptPfaPredictionOptions
): PfaPrediction => {
  const conceptLogs = logs.filter((log) => resolveConceptIdFromLog(log) === conceptId);
  return buildPredictionFromLogs(conceptId, conceptLogs, options);
};

/**
 * ログに現れる Concept ごとの次回正答確率を一括生成する。
 * 存在しない Concept は生成しない。入力配列は破壊しない。
 */
export const buildConceptPfaPredictionMap = (
  logs: QuizAttemptLog[],
  options?: GetConceptPfaPredictionOptions
): Map<string, PfaPrediction> => {
  const grouped = new Map<string, QuizAttemptLog[]>();
  for (const log of logs) {
    const conceptId = resolveConceptIdFromLog(log);
    if (!conceptId) {
      continue;
    }
    const bucket = grouped.get(conceptId);
    if (bucket) {
      bucket.push(log);
    } else {
      grouped.set(conceptId, [log]);
    }
  }

  const map = new Map<string, PfaPrediction>();
  for (const [conceptId, conceptLogs] of grouped) {
    map.set(conceptId, buildPredictionFromLogs(conceptId, conceptLogs, options));
  }
  return map;
};
