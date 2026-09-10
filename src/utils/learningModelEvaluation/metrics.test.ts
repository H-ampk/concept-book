import { describe, expect, it } from "vitest";
import {
  calculateBrierScore,
  calculateLogLoss,
  filterLearningModelPredictionPoints,
  groupLearningModelPredictionMetricsByConcept,
  groupLearningModelPredictionMetricsByModel,
  groupLearningModelPredictionMetricsByModelAndConcept,
  summarizeLearningModelPredictionMetrics
} from "./metrics";
import type { LearningModelPredictionPoint } from "./types";

const point = (
  overrides: Partial<LearningModelPredictionPoint> &
    Pick<LearningModelPredictionPoint, "predictedCorrectProbability" | "actualCorrect">
): LearningModelPredictionPoint => ({
  conceptId: "concept-a",
  attemptId: "attempt-1",
  answeredAt: "2026-01-01T00:00:00.000Z",
  model: "bkt",
  historyCount: 0,
  ...overrides
});

describe("calculateBrierScore", () => {
  it("1 prediction は (p - y)^2", () => {
    expect(calculateBrierScore([point({ predictedCorrectProbability: 0.7, actualCorrect: true })])).toBeCloseTo(
      (0.7 - 1) ** 2
    );
    expect(calculateBrierScore([point({ predictedCorrectProbability: 0.7, actualCorrect: false })])).toBeCloseTo(
      (0.7 - 0) ** 2
    );
  });

  it("複数 prediction は平均", () => {
    const points = [
      point({ predictedCorrectProbability: 0.2, actualCorrect: false }),
      point({ predictedCorrectProbability: 0.8, actualCorrect: true })
    ];
    expect(calculateBrierScore(points)).toBeCloseTo(((0.2 - 0) ** 2 + (0.8 - 1) ** 2) / 2);
  });

  it("評価対象0件では null であり 0 を返さない", () => {
    expect(calculateBrierScore([])).toBeNull();
  });
});

describe("calculateLogLoss", () => {
  it("標準的な予測の平均 Log loss を返す", () => {
    const p = 0.8;
    const expected = -Math.log(p);
    expect(calculateLogLoss([point({ predictedCorrectProbability: p, actualCorrect: true })])).toBeCloseTo(expected);
  });

  it("複数 prediction は平均", () => {
    const points = [
      point({ predictedCorrectProbability: 0.8, actualCorrect: true }),
      point({ predictedCorrectProbability: 0.2, actualCorrect: false })
    ];
    const expected = (-Math.log(0.8) + -Math.log(0.8)) / 2;
    expect(calculateLogLoss(points)).toBeCloseTo(expected);
  });

  it("p=0 / p=1 でも Infinity にならず、prediction point の確率は変更しない", () => {
    const zeroCorrect = point({
      attemptId: "z",
      predictedCorrectProbability: 0,
      actualCorrect: true
    });
    const oneIncorrect = point({
      attemptId: "o",
      predictedCorrectProbability: 1,
      actualCorrect: false
    });
    const zeroLoss = calculateLogLoss([zeroCorrect]);
    const oneLoss = calculateLogLoss([oneIncorrect]);
    expect(zeroLoss).not.toBeNull();
    expect(oneLoss).not.toBeNull();
    expect(Number.isFinite(zeroLoss)).toBe(true);
    expect(Number.isFinite(oneLoss)).toBe(true);
    expect(zeroLoss).toBeCloseTo(-Math.log(1e-15));
    expect(oneLoss).toBeCloseTo(-Math.log(1e-15));
    expect(zeroCorrect.predictedCorrectProbability).toBe(0);
    expect(oneIncorrect.predictedCorrectProbability).toBe(1);
  });

  it("評価対象0件では null であり 0 を返さない", () => {
    expect(calculateLogLoss([])).toBeNull();
  });
});

describe("summarizeLearningModelPredictionMetrics", () => {
  it("全体の count / Brier / Log loss を返す", () => {
    const points = [
      point({
        attemptId: "1",
        model: "bkt",
        conceptId: "concept-a",
        predictedCorrectProbability: 0.5,
        actualCorrect: true
      }),
      point({
        attemptId: "2",
        model: "pfa",
        conceptId: "concept-b",
        predictedCorrectProbability: 0.25,
        actualCorrect: false
      })
    ];
    const metrics = summarizeLearningModelPredictionMetrics(points);
    expect(metrics.count).toBe(2);
    expect(metrics.brierScore).toBe(calculateBrierScore(points));
    expect(metrics.logLoss).toBe(calculateLogLoss(points));
  });

  it("prediction 0件時 metrics が null", () => {
    expect(summarizeLearningModelPredictionMetrics([])).toEqual({
      count: 0,
      brierScore: null,
      logLoss: null
    });
  });

  it("model と Concept で絞り込める", () => {
    const points = [
      point({
        attemptId: "1",
        model: "bkt",
        conceptId: "concept-a",
        predictedCorrectProbability: 0.9,
        actualCorrect: true
      }),
      point({
        attemptId: "2",
        model: "bkt",
        conceptId: "concept-b",
        predictedCorrectProbability: 0.1,
        actualCorrect: true
      }),
      point({
        attemptId: "3",
        model: "pfa",
        conceptId: "concept-a",
        predictedCorrectProbability: 0.2,
        actualCorrect: false
      })
    ];
    const byModel = summarizeLearningModelPredictionMetrics(points, { model: "bkt" });
    expect(byModel.count).toBe(2);
    expect(byModel.brierScore).toBe(
      calculateBrierScore(filterLearningModelPredictionPoints(points, { model: "bkt" }))
    );

    const byConcept = summarizeLearningModelPredictionMetrics(points, { conceptId: "concept-a" });
    expect(byConcept.count).toBe(2);

    const byModelAndConcept = summarizeLearningModelPredictionMetrics(points, {
      model: "bkt",
      conceptId: "concept-a"
    });
    expect(byModelAndConcept.count).toBe(1);
    expect(byModelAndConcept.brierScore).toBeCloseTo((0.9 - 1) ** 2);
  });

  it("null predictor 由来の欠測を 0 として評価しない", () => {
    const onlyValid = [
      point({
        attemptId: "kept",
        predictedCorrectProbability: 0.4,
        actualCorrect: true
      })
    ];
    const metrics = summarizeLearningModelPredictionMetrics(onlyValid);
    expect(metrics.count).toBe(1);
    expect(metrics.brierScore).toBeCloseTo((0.4 - 1) ** 2);
    expect(metrics.brierScore).not.toBe(0);
  });
});

describe("groupLearningModelPredictionMetrics", () => {
  const points = [
    point({
      attemptId: "1",
      model: "bkt",
      conceptId: "concept-a",
      predictedCorrectProbability: 0.9,
      actualCorrect: true
    }),
    point({
      attemptId: "2",
      model: "bkt",
      conceptId: "concept-b",
      predictedCorrectProbability: 0.2,
      actualCorrect: false
    }),
    point({
      attemptId: "3",
      model: "pfa",
      conceptId: "concept-a",
      predictedCorrectProbability: 0.6,
      actualCorrect: false
    })
  ];

  it("model 単位で集計できる", () => {
    const byModel = groupLearningModelPredictionMetricsByModel(points);
    expect(byModel.get("bkt")?.count).toBe(2);
    expect(byModel.get("pfa")?.count).toBe(1);
    expect(byModel.get("bkt")?.brierScore).toBe(
      calculateBrierScore(filterLearningModelPredictionPoints(points, { model: "bkt" }))
    );
  });

  it("Concept 単位で集計できる", () => {
    const byConcept = groupLearningModelPredictionMetricsByConcept(points);
    expect(byConcept.get("concept-a")?.count).toBe(2);
    expect(byConcept.get("concept-b")?.count).toBe(1);
  });

  it("model を指定したうえで Concept ごとの予測誤差を集計できる", () => {
    const nested = groupLearningModelPredictionMetricsByModelAndConcept(points);
    expect(nested.get("bkt")?.get("concept-a")?.count).toBe(1);
    expect(nested.get("bkt")?.get("concept-b")?.count).toBe(1);
    expect(nested.get("pfa")?.get("concept-a")?.count).toBe(1);
    expect(nested.get("pfa")?.has("concept-b")).toBe(false);
    expect(nested.get("bkt")?.get("concept-a")?.brierScore).toBeCloseTo((0.9 - 1) ** 2);
  });
});
