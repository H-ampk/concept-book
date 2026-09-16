import { describe, expect, it } from "vitest";
import { createEmptyConceptInput, type Concept } from "../../types/concept";
import { QUIZ_ATTEMPT_LOG_SCHEMA_VERSION, type QuizAttemptLog } from "../../types/quiz";
import {
  calculateBrierScore,
  calculateLogLoss,
  summarizeLearningModelPredictionMetrics
} from "../learningModelEvaluation/metrics";
import type { LearningModelPredictionPoint } from "../learningModelEvaluation/types";
import { DEFAULT_DATA_LAB_FILTERS, filterDataLabLogs } from "./filterDataLabLogs";
import { filterLearningModelPredictionPointsByAttemptIds } from "./filterLearningModelPredictionPointsByAttemptIds";
import {
  filterDataLabPredictionEvaluationLogs,
  toDataLabPredictionEvaluationFilters
} from "./toDataLabPredictionEvaluationFilters";

const atLocal = (ymd: string): string => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y!, m! - 1, d!, 12, 0, 0, 0).toISOString();
};

const log = (overrides: Partial<QuizAttemptLog> = {}): QuizAttemptLog => ({
  id: "log-1",
  questionId: "q1",
  questionType: "multiple-choice",
  questionPromptSnapshot: "問い",
  selectedChoiceId: "c1",
  selectedChoiceTextSnapshot: "選択",
  correctChoiceId: "c2",
  correctChoiceTextSnapshot: "正解",
  correct: true,
  startedAt: atLocal("2026-08-15"),
  answeredAt: atLocal("2026-08-15"),
  timeMs: 10,
  schemaVersion: QUIZ_ATTEMPT_LOG_SCHEMA_VERSION,
  conceptId: "concept-a",
  ...overrides
});

const concept = (overrides: Partial<Concept> = {}): Concept => ({
  ...createEmptyConceptInput(),
  id: "concept-a",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  title: "人工知能",
  domainTags: ["情報科学"],
  ...overrides
});

const point = (
  overrides: Partial<LearningModelPredictionPoint> &
    Pick<LearningModelPredictionPoint, "attemptId" | "predictedCorrectProbability" | "actualCorrect">
): LearningModelPredictionPoint => ({
  conceptId: "concept-a",
  answeredAt: "2026-08-15T00:00:00.000Z",
  model: "bkt",
  historyCount: 0,
  ...overrides
});

const issue181Logs: QuizAttemptLog[] = [
  log({ id: "A", correct: true, answeredAt: atLocal("2026-08-01"), conceptId: "concept-a", deckId: "deck-1" }),
  log({ id: "B", correct: false, answeredAt: atLocal("2026-08-10"), conceptId: "concept-a", deckId: "deck-1" }),
  log({ id: "C", correct: true, answeredAt: atLocal("2026-08-20"), conceptId: "concept-b", deckId: "deck-2" }),
  log({ id: "D", correct: false, answeredAt: atLocal("2026-08-30"), conceptId: "concept-b", deckId: "deck-2" })
];

const issue181Points: LearningModelPredictionPoint[] = [
  point({ attemptId: "A", predictedCorrectProbability: 0.9, actualCorrect: true }),
  point({ attemptId: "B", predictedCorrectProbability: 0.8, actualCorrect: false }),
  point({ attemptId: "C", predictedCorrectProbability: 0.6, actualCorrect: true }),
  point({ attemptId: "D", predictedCorrectProbability: 0.2, actualCorrect: false })
];

const conceptById = new Map<string, Concept>([
  ["concept-a", concept({ id: "concept-a" })],
  ["concept-b", concept({ id: "concept-b", title: "哲学", domainTags: ["哲学"] })]
]);

const targetIds = (logs: QuizAttemptLog[]): string[] => [...logs.map((row) => row.id)].sort();

describe("toDataLabPredictionEvaluationFilters", () => {
  it("correctness だけ all にし、他のフィルタは残す", () => {
    const filters = {
      ...DEFAULT_DATA_LAB_FILTERS,
      dateFrom: "2026-08-01",
      dateTo: "2026-08-31",
      conceptIds: ["concept-a"],
      domainTags: ["情報科学"],
      deckIds: ["deck-1"],
      correctness: "incorrect" as const
    };
    expect(toDataLabPredictionEvaluationFilters(filters)).toEqual({
      ...filters,
      correctness: "all"
    });
  });
});

describe("filterDataLabPredictionEvaluationLogs (#181)", () => {
  it("通常集計の correctness filter は維持する", () => {
    expect(
      targetIds(filterDataLabLogs(issue181Logs, { ...DEFAULT_DATA_LAB_FILTERS, correctness: "correct" }, conceptById))
    ).toEqual(["A", "C"]);
    expect(
      targetIds(
        filterDataLabLogs(issue181Logs, { ...DEFAULT_DATA_LAB_FILTERS, correctness: "incorrect" }, conceptById)
      )
    ).toEqual(["B", "D"]);
  });

  it("prediction evaluation は correctness=all / correct / incorrect で同じ Attempt を残す", () => {
    const all = targetIds(
      filterDataLabPredictionEvaluationLogs(
        issue181Logs,
        { ...DEFAULT_DATA_LAB_FILTERS, correctness: "all" },
        conceptById
      )
    );
    const correctOnly = targetIds(
      filterDataLabPredictionEvaluationLogs(
        issue181Logs,
        { ...DEFAULT_DATA_LAB_FILTERS, correctness: "correct" },
        conceptById
      )
    );
    const incorrectOnly = targetIds(
      filterDataLabPredictionEvaluationLogs(
        issue181Logs,
        { ...DEFAULT_DATA_LAB_FILTERS, correctness: "incorrect" },
        conceptById
      )
    );
    expect(all).toEqual(["A", "B", "C", "D"]);
    expect(correctOnly).toEqual(all);
    expect(incorrectOnly).toEqual(all);
  });

  it("Issue 本文の 4 点 fixture では correctness を変えても Brier=0.2125 のままである", () => {
    const correctOnlyWrongPath = issue181Points.filter((item) => item.actualCorrect);
    expect(correctOnlyWrongPath).toHaveLength(2);
    expect(calculateBrierScore(correctOnlyWrongPath)).toBeCloseTo(0.085);
    expect(calculateBrierScore(issue181Points.filter((item) => !item.actualCorrect))).toBeCloseTo(0.34);

    for (const correctness of ["all", "correct", "incorrect"] as const) {
      const evaluationLogs = filterDataLabPredictionEvaluationLogs(
        issue181Logs,
        { ...DEFAULT_DATA_LAB_FILTERS, correctness },
        conceptById
      );
      const points = filterLearningModelPredictionPointsByAttemptIds(
        issue181Points,
        new Set(evaluationLogs.map((row) => row.id))
      );
      const metrics = summarizeLearningModelPredictionMetrics(points);
      expect(points.map((item) => item.attemptId).sort()).toEqual(["A", "B", "C", "D"]);
      expect(metrics.count).toBe(4);
      expect(metrics.brierScore).toBeCloseTo(0.2125);
      expect(metrics.logLoss).toBeCloseTo(0.6122, 3);
      expect(calculateLogLoss(points)).toBeCloseTo(0.6122, 3);
    }
  });

  it("期間フィルタは prediction evaluation の対象 Attempt に効く", () => {
    const evaluationLogs = filterDataLabPredictionEvaluationLogs(
      issue181Logs,
      { ...DEFAULT_DATA_LAB_FILTERS, dateFrom: "2026-08-15", dateTo: "2026-08-31", correctness: "incorrect" },
      conceptById
    );
    expect(targetIds(evaluationLogs)).toEqual(["C", "D"]);
  });

  it("Concept / Deck フィルタは prediction evaluation の対象 Attempt に効く", () => {
    expect(
      targetIds(
        filterDataLabPredictionEvaluationLogs(
          issue181Logs,
          { ...DEFAULT_DATA_LAB_FILTERS, conceptIds: ["concept-a"], correctness: "incorrect" },
          conceptById
        )
      )
    ).toEqual(["A", "B"]);
    expect(
      targetIds(
        filterDataLabPredictionEvaluationLogs(
          issue181Logs,
          { ...DEFAULT_DATA_LAB_FILTERS, deckIds: ["deck-2"], correctness: "correct" },
          conceptById
        )
      )
    ).toEqual(["C", "D"]);
  });
});
