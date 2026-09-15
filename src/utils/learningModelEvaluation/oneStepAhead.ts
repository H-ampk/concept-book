import type { QuizAttemptLog } from "../../types/quiz";
import {
  groupNormalizedEventsByTimeMs,
  normalizeLearningModelEvents,
  type NormalizedLearningModelEvent
} from "../learningModel/normalizeQuizAttemptLogs";
import type { LearningModelPredictionPoint, LearningModelPredictor } from "./types";

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

const appendToConceptHistory = (
  historyByConcept: Map<string, QuizAttemptLog[]>,
  group: NormalizedLearningModelEvent[]
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
 * 同一 timeMs のログは同じ timestamp group とし、group 内では互いを history に入れない。
 * group 内の全予測を生成したあとで、group 全体を history に追加する。
 *
 * 不正な answeredAt は target にも history にも使わない。
 * Concept を解決できないログは対象外とする（共通 learning-model event 正規化）。
 *
 * predictor が null、または finite かつ 0〜1 でない値を返した場合、
 * その model / attempt の prediction point は生成しない（0 に変換しない）。
 *
 * prediction は derived data であり IndexedDB には保存しない。
 * 入力配列は破壊しない。入力配列順には依存せず、timeMs と id で決定的に並べる。
 */
export const buildOneStepAheadPredictionSeries = (
  logs: readonly QuizAttemptLog[],
  predictors: readonly LearningModelPredictor[]
): LearningModelPredictionPoint[] => {
  if (predictors.length === 0) {
    return [];
  }

  const events = normalizeLearningModelEvents(logs);
  const groups = groupNormalizedEventsByTimeMs(events);
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
            historyLogs,
            targetLog: item.log
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
