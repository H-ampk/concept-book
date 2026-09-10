import type { LearningModelPredictionPoint } from "../learningModelEvaluation/types";

export const learningModelPredictionSquaredError = (
  point: Pick<LearningModelPredictionPoint, "predictedCorrectProbability" | "actualCorrect">
): number => {
  const y = point.actualCorrect ? 1 : 0;
  return (point.predictedCorrectProbability - y) ** 2;
};

export type DataLabEvaluationScatterPoint = {
  key: string;
  x: number;
  y: number;
  label: string;
};

export const toPredictedProbabilityVsActualPoints = (
  points: readonly LearningModelPredictionPoint[]
): DataLabEvaluationScatterPoint[] =>
  points.map((point) => ({
    key: `${point.model}:${point.attemptId}`,
    x: point.predictedCorrectProbability,
    y: point.actualCorrect ? 1 : 0,
    label: point.attemptId
  }));

export const toHistoryCountVsSquaredErrorPoints = (
  points: readonly LearningModelPredictionPoint[]
): DataLabEvaluationScatterPoint[] =>
  points.map((point) => ({
    key: `${point.model}:${point.attemptId}`,
    x: point.historyCount,
    y: learningModelPredictionSquaredError(point),
    label: point.attemptId
  }));
