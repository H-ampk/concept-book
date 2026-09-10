import { describe, expect, it } from "vitest";
import type { LearningModelPredictionPoint } from "../learningModelEvaluation/types";
import {
  learningModelPredictionSquaredError,
  toHistoryCountVsSquaredErrorPoints,
  toPredictedProbabilityVsActualPoints
} from "./toDataLabLearningModelEvaluationPoints";

const point = (
  overrides: Partial<LearningModelPredictionPoint> = {}
): LearningModelPredictionPoint => ({
  conceptId: "concept-a",
  attemptId: "attempt-1",
  answeredAt: "2026-01-01T00:00:00.000Z",
  predictedCorrectProbability: 0.7,
  actualCorrect: true,
  model: "bkt",
  historyCount: 2,
  ...overrides
});

describe("learningModelPredictionSquaredError", () => {
  it("correct なら (p-1)^2、incorrect なら (p-0)^2", () => {
    expect(learningModelPredictionSquaredError(point({ predictedCorrectProbability: 0.7, actualCorrect: true }))).toBeCloseTo(
      (0.7 - 1) ** 2
    );
    expect(learningModelPredictionSquaredError(point({ predictedCorrectProbability: 0.7, actualCorrect: false }))).toBeCloseTo(
      0.7 ** 2
    );
  });
});

describe("toPredictedProbabilityVsActualPoints", () => {
  it("X を予測確率、Y を 0/1 の実際の正誤にする", () => {
    const points = toPredictedProbabilityVsActualPoints([
      point({ attemptId: "ok", predictedCorrectProbability: 0.8, actualCorrect: true }),
      point({ attemptId: "ng", predictedCorrectProbability: 0.2, actualCorrect: false })
    ]);
    expect(points[0]).toMatchObject({ x: 0.8, y: 1 });
    expect(points[1]).toMatchObject({ x: 0.2, y: 0 });
  });
});

describe("toHistoryCountVsSquaredErrorPoints", () => {
  it("X を historyCount、Y を二乗誤差にする", () => {
    const points = toHistoryCountVsSquaredErrorPoints([
      point({ historyCount: 2, predictedCorrectProbability: 0.5, actualCorrect: true })
    ]);
    expect(points[0]?.x).toBe(2);
    expect(points[0]?.y).toBeCloseTo(0.25);
  });
});
