import type { QuizAttemptLog } from "../../types/quiz";
import { resolveConceptIdFromLog } from "../quiz/resolveConceptIdFromLog";
import type { LearningModelPredictionPoint, LearningModelPredictor } from "./types";

type EligibleLog = {
  log: QuizAttemptLog;
  conceptId: string;
  timeMs: number;
};

const parseAnsweredAtMs = (answeredAt: string): number | null => {
  const date = new Date(answeredAt);
  const timeMs = date.getTime();
  if (Number.isNaN(timeMs)) {
    return null;
  }
  return timeMs;
};

/**
 * predictor 出力が評価可能な正答確率であるか。
 * finite かつ 0 <= p <= 1 のみを受理する。
 * 範囲外を silently clamp して正常な予測に見せることはしない。
 */
const toValidPredictedProbability = (value: number | null): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    return null;
  }
  return value;
};

const compareEligibleLogs = (a: EligibleLog, b: EligibleLog): number => {
  if (a.timeMs !== b.timeMs) {
    return a.timeMs - b.timeMs;
  }
  return a.log.id.localeCompare(b.log.id);
};

const groupByTimestamp = (eligible: EligibleLog[]): EligibleLog[][] => {
  const groups: EligibleLog[][] = [];
  for (const item of eligible) {
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup[0].timeMs === item.timeMs) {
      lastGroup.push(item);
    } else {
      groups.push([item]);
    }
  }
  return groups;
};

const appendToConceptHistory = (
  historyByConcept: Map<string, QuizAttemptLog[]>,
  group: EligibleLog[]
): void => {
  for (const item of group) {
    const history = historyByConcept.get(item.conceptId);
    if (history) {
      history.push(item.log);
    } else {
      historyByConcept.set(item.conceptId, [item.log]);
    }
  }
};

/**
 * QuizAttemptLog から one-step-ahead 予測点系列を生成する。
 *
 * 各回答の予測には、その回答自身および未来の回答を含めない。
 * 同一 answeredAt のログは同じ timestamp group とし、group 内では互いを history に入れない。
 * group 内の全予測を生成したあとで、group 全体を history に追加する。
 *
 * 不正な answeredAt は target にも history にも使わない。
 * Concept を解決できないログは対象外とする（resolveConceptIdFromLog を再利用）。
 *
 * predictor が null、または finite かつ 0〜1 でない値を返した場合、
 * その model / attempt の prediction point は生成しない（0 に変換しない）。
 *
 * prediction は derived data であり IndexedDB には保存しない。
 * 入力配列は破壊しない。入力配列順には依存せず、answeredAt と id で決定的に並べる。
 */
export const buildOneStepAheadPredictionSeries = (
  logs: readonly QuizAttemptLog[],
  predictors: readonly LearningModelPredictor[]
): LearningModelPredictionPoint[] => {
  if (predictors.length === 0) {
    return [];
  }

  const eligible: EligibleLog[] = [];
  for (const log of logs) {
    const timeMs = parseAnsweredAtMs(log.answeredAt);
    if (timeMs === null) {
      continue;
    }
    const conceptId = resolveConceptIdFromLog(log);
    if (!conceptId) {
      continue;
    }
    eligible.push({ log, conceptId, timeMs });
  }

  eligible.sort(compareEligibleLogs);
  const groups = groupByTimestamp(eligible);
  const historyByConcept = new Map<string, QuizAttemptLog[]>();
  const points: LearningModelPredictionPoint[] = [];

  for (const group of groups) {
    for (const item of group) {
      const pastHistory = historyByConcept.get(item.conceptId) ?? [];
      for (const predictor of predictors) {
        const historyLogs = [...pastHistory];
        const predicted = toValidPredictedProbability(
          predictor.predictNextCorrectProbability({
            conceptId: item.conceptId,
            historyLogs
          })
        );
        if (predicted === null) {
          continue;
        }
        points.push({
          conceptId: item.conceptId,
          attemptId: item.log.id,
          answeredAt: item.log.answeredAt,
          predictedCorrectProbability: predicted,
          actualCorrect: item.log.correct,
          model: predictor.id,
          historyCount: historyLogs.length
        });
      }
    }
    appendToConceptHistory(historyByConcept, group);
  }

  return points;
};
