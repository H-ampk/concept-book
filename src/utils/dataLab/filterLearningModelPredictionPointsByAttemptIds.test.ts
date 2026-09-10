import { describe, expect, it } from "vitest";
import { QUIZ_ATTEMPT_LOG_SCHEMA_VERSION, type QuizAttemptLog } from "../../types/quiz";
import { buildOneStepAheadPredictionSeries } from "../learningModelEvaluation/oneStepAhead";
import {
  BKT_LEARNING_MODEL_ID,
  PFA_LEARNING_MODEL_ID,
  createBktLearningModelPredictor,
  createPfaLearningModelPredictor
} from "../learningModelEvaluation/predictors";
import { filterLearningModelPredictionPointsByAttemptIds } from "./filterLearningModelPredictionPointsByAttemptIds";

const log = (overrides: Partial<QuizAttemptLog>): QuizAttemptLog => ({
  id: "log-1",
  questionId: "q1",
  questionPromptSnapshot: "問い",
  selectedChoiceId: "c1",
  selectedChoiceTextSnapshot: "選択",
  correctChoiceId: "c1",
  correctChoiceTextSnapshot: "正解",
  correct: true,
  startedAt: "2026-01-01T00:00:00.000Z",
  answeredAt: "2026-01-01T00:00:01.000Z",
  timeMs: 1000,
  schemaVersion: QUIZ_ATTEMPT_LOG_SCHEMA_VERSION,
  conceptId: "concept-a",
  ...overrides
});

const predictors = [createBktLearningModelPredictor(), createPfaLearningModelPredictor()];

describe("filterLearningModelPredictionPointsByAttemptIds", () => {
  it("全履歴から prediction を生成したあと対象 attempt だけ残し、historyCount を切らない", () => {
    const logs = [
      log({ id: "A", answeredAt: "2026-01-01T00:00:00.000Z" }),
      log({ id: "B", answeredAt: "2026-01-02T00:00:00.000Z" }),
      log({ id: "C", answeredAt: "2026-01-03T00:00:00.000Z" })
    ];
    const allPoints = buildOneStepAheadPredictionSeries(logs, predictors);
    const filteredLogs = logs.filter((item) => item.id === "C");
    const targetAttemptIds = new Set(filteredLogs.map((item) => item.id));
    const filtered = filterLearningModelPredictionPointsByAttemptIds(allPoints, targetAttemptIds);

    const bkt = filtered.filter((point) => point.model === BKT_LEARNING_MODEL_ID);
    const pfa = filtered.filter((point) => point.model === PFA_LEARNING_MODEL_ID);
    expect(bkt).toHaveLength(1);
    expect(pfa).toHaveLength(1);
    expect(bkt[0]?.attemptId).toBe("C");
    expect(bkt[0]?.historyCount).toBe(2);
    expect(pfa[0]?.historyCount).toBe(2);
    expect(filtered.every((point) => point.attemptId === "C")).toBe(true);
  });

  it("filteredLogs だけを predictor に渡すと historyCount が 0 になり、それは採用しない", () => {
    const logs = [
      log({ id: "A", answeredAt: "2026-01-01T00:00:00.000Z" }),
      log({ id: "B", answeredAt: "2026-01-02T00:00:00.000Z" }),
      log({ id: "C", answeredAt: "2026-01-03T00:00:00.000Z" })
    ];
    const truncated = buildOneStepAheadPredictionSeries(
      logs.filter((item) => item.id === "C"),
      predictors
    );
    expect(truncated.find((point) => point.model === BKT_LEARNING_MODEL_ID)?.historyCount).toBe(0);

    const allPoints = buildOneStepAheadPredictionSeries(logs, predictors);
    const filtered = filterLearningModelPredictionPointsByAttemptIds(allPoints, new Set(["C"]));
    expect(filtered.find((point) => point.model === BKT_LEARNING_MODEL_ID)?.historyCount).toBe(2);
  });

  it("評価対象 0 件なら空配列を返す", () => {
    const logs = [log({ id: "A", answeredAt: "2026-01-01T00:00:00.000Z" })];
    const allPoints = buildOneStepAheadPredictionSeries(logs, predictors);
    expect(filterLearningModelPredictionPointsByAttemptIds(allPoints, new Set())).toEqual([]);
  });

  it("future leakage がない（対象 C の予測に C 自身を含めない）", () => {
    const logs = [
      log({ id: "A", answeredAt: "2026-01-01T00:00:00.000Z", correct: true }),
      log({ id: "B", answeredAt: "2026-01-02T00:00:00.000Z", correct: false }),
      log({ id: "C", answeredAt: "2026-01-03T00:00:00.000Z", correct: true })
    ];
    const allPoints = buildOneStepAheadPredictionSeries(logs, predictors);
    const filtered = filterLearningModelPredictionPointsByAttemptIds(allPoints, new Set(["C"]));
    const bktC = filtered.find((point) => point.model === BKT_LEARNING_MODEL_ID);
    const bktFromHistoryOnly = buildOneStepAheadPredictionSeries(logs, predictors).find(
      (point) => point.model === BKT_LEARNING_MODEL_ID && point.attemptId === "C"
    );
    expect(bktC?.predictedCorrectProbability).toBe(bktFromHistoryOnly?.predictedCorrectProbability);
    expect(bktC?.historyCount).toBe(2);
    expect(filtered.some((point) => point.attemptId === "A" || point.attemptId === "B")).toBe(false);
  });

  it("HLR の prediction point は生成しない", () => {
    const logs = [log({ id: "A" })];
    const points = buildOneStepAheadPredictionSeries(logs, predictors);
    expect(points.every((point) => point.model === BKT_LEARNING_MODEL_ID || point.model === PFA_LEARNING_MODEL_ID)).toBe(
      true
    );
    expect(points.some((point) => point.model === "hlr")).toBe(false);
  });
});
