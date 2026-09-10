import { describe, expect, it } from "vitest";
import { createEmptyConceptInput, type Concept } from "../../types/concept";
import { QUIZ_ATTEMPT_LOG_SCHEMA_VERSION, type QuizAttemptLog } from "../../types/quiz";
import { filterDataLabLogs } from "./filterDataLabLogs";
import { aggregateDataLabLogs } from "./aggregateDataLabLogs";
import { attachDataLabConceptLearningModelMetrics } from "./attachDataLabConceptLearningModelMetrics";
import { buildConceptMasteryMap, getConceptMastery } from "../mastery/getConceptMastery";
import { buildConceptPfaPredictionMap, getConceptPfaPrediction } from "../pfa/getConceptPfaPrediction";
import { buildConceptHlrEstimateMap, getConceptHlrEstimate } from "../hlr/getConceptHlrEstimate";

const log = (overrides: Partial<QuizAttemptLog> = {}): QuizAttemptLog => ({
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

const concept = (overrides: Partial<Concept> = {}): Concept => ({
  ...createEmptyConceptInput(),
  id: "concept-a",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  title: "人工知能",
  ...overrides
});

const now = new Date("2026-01-10T00:00:00.000Z");

const attach = (
  logs: QuizAttemptLog[],
  groupBy: "concept" | "domain" | "deck" | "day" | "week" | "month",
  conceptById: Map<string, Concept>,
  allLogs = logs
) => {
  const rows = aggregateDataLabLogs({
    logs,
    groupBy,
    conceptById,
    deckById: new Map()
  });
  return attachDataLabConceptLearningModelMetrics(
    rows,
    {
      masteryByConceptId: buildConceptMasteryMap(allLogs),
      pfaByConceptId: buildConceptPfaPredictionMap(allLogs),
      hlrByConceptId: buildConceptHlrEstimateMap(allLogs, { now })
    },
    conceptById
  );
};

describe("attachDataLabConceptLearningModelMetrics", () => {
  it("BKT 値が既存 getConceptMastery と一致する", () => {
    const logs = [
      log({ id: "1", correct: true }),
      log({ id: "2", correct: false, answeredAt: "2026-01-02T00:00:00.000Z" })
    ];
    const conceptById = new Map([["concept-a", concept()]]);
    const attached = attach(logs, "concept", conceptById);
    const expected = getConceptMastery(logs, "concept-a");
    expect(attached[0]?.masteryProbability).toBe(expected.masteryProbability);
  });

  it("PFA nextCorrectProbability / successCount / failureCount が既存 utility と一致する", () => {
    const logs = [
      log({ id: "1", correct: true }),
      log({ id: "2", correct: false, answeredAt: "2026-01-02T00:00:00.000Z" }),
      log({ id: "3", correct: true, answeredAt: "2026-01-03T00:00:00.000Z" })
    ];
    const conceptById = new Map([["concept-a", concept()]]);
    const attached = attach(logs, "concept", conceptById);
    const expected = getConceptPfaPrediction(logs, "concept-a");
    expect(attached[0]?.pfaNextCorrectProbability).toBe(expected.nextCorrectProbability);
    expect(attached[0]?.pfaSuccessCount).toBe(expected.successCount);
    expect(attached[0]?.pfaFailureCount).toBe(expected.failureCount);
    expect(attached[0]?.pfaSuccessCount).toBe(2);
    expect(attached[0]?.pfaFailureCount).toBe(1);
  });

  it("HLR retention / half-life / elapsed が既存 utility と一致する", () => {
    const logs = [
      log({ id: "1", answeredAt: "2026-01-01T00:00:00.000Z" }),
      log({ id: "2", answeredAt: "2026-01-03T00:00:00.000Z" })
    ];
    const conceptById = new Map([["concept-a", concept()]]);
    const attached = attach(logs, "concept", conceptById);
    const expected = getConceptHlrEstimate(logs, "concept-a", { now });
    expect(attached[0]?.hlrRetentionProbability).toBe(expected.retentionProbability);
    expect(attached[0]?.hlrHalfLifeDays).toBe(expected.halfLifeDays);
    expect(attached[0]?.hlrElapsedDays).toBe(expected.elapsedDays);
    expect(attached[0]?.hlrRetentionProbability).not.toBeNull();
    expect(attached[0]?.hlrHalfLifeDays).not.toBeNull();
  });

  it("HLR insufficient-data では retention / half-life を null にし 0 にしない", () => {
    const logs = [log({ id: "1", answeredAt: "2026-01-01T00:00:00.000Z" })];
    const conceptById = new Map([["concept-a", concept()]]);
    const attached = attach(logs, "concept", conceptById);
    const expected = getConceptHlrEstimate(logs, "concept-a", { now });
    expect(expected.status).toBe("insufficient-data");
    expect(attached[0]?.hlrRetentionProbability).toBeNull();
    expect(attached[0]?.hlrHalfLifeDays).toBeNull();
    expect(attached[0]?.hlrElapsedDays).toBe(expected.elapsedDays);
    expect(attached[0]?.hlrElapsedDays).not.toBeNull();
  });

  it("0 と null を区別する", () => {
    const logs = [
      log({ id: "1", correct: false, answeredAt: "2026-01-01T00:00:00.000Z" }),
      log({ id: "2", correct: false, answeredAt: "2026-01-01T01:00:00.000Z" })
    ];
    const conceptById = new Map([["concept-a", concept()]]);
    const attached = attach(logs, "concept", conceptById);
    expect(attached[0]?.pfaSuccessCount).toBe(0);
    expect(attached[0]?.pfaSuccessCount).not.toBeNull();
    expect(attached[0]?.pfaFailureCount).toBe(2);
  });

  it("期間フィルタ後もモデル現在値は全ログ、回答数はフィルタ済みになる", () => {
    const oldLog = log({
      id: "old",
      correct: false,
      answeredAt: "2026-01-01T03:00:00.000Z"
    });
    const recentLog = log({
      id: "recent",
      correct: true,
      answeredAt: "2026-09-05T03:00:00.000Z"
    });
    const allLogs = [oldLog, recentLog];
    const conceptById = new Map([["concept-a", concept()]]);
    const filteredLogs = filterDataLabLogs(
      allLogs,
      {
        dateFrom: "2026-09-01",
        dateTo: "",
        conceptIds: [],
        domainTags: [],
        deckIds: [],
        correctness: "all"
      },
      conceptById
    );
    expect(filteredLogs).toHaveLength(1);
    const attached = attach(filteredLogs, "concept", conceptById, allLogs);
    expect(attached[0]?.attemptCount).toBe(1);
    expect(attached[0]?.masteryProbability).toBe(getConceptMastery(allLogs, "concept-a").masteryProbability);
    expect(attached[0]?.pfaNextCorrectProbability).toBe(
      getConceptPfaPrediction(allLogs, "concept-a").nextCorrectProbability
    );
    expect(attached[0]?.pfaSuccessCount).toBe(1);
    expect(attached[0]?.pfaFailureCount).toBe(1);
    expect(attached[0]?.masteryProbability).not.toBe(
      getConceptMastery(filteredLogs, "concept-a").masteryProbability
    );
    expect(attached[0]?.pfaNextCorrectProbability).not.toBe(
      getConceptPfaPrediction(filteredLogs, "concept-a").nextCorrectProbability
    );
  });

  it("Conceptなし・削除済み Concept はモデル指標を null にし 0 にしない", () => {
    const missing = attach(
      [log({ conceptId: undefined, questionConceptId: undefined })],
      "concept",
      new Map()
    );
    expect(missing[0]?.masteryProbability).toBeNull();
    expect(missing[0]?.pfaNextCorrectProbability).toBeNull();
    expect(missing[0]?.pfaSuccessCount).toBeNull();
    expect(missing[0]?.hlrRetentionProbability).toBeNull();

    const deleted = attach([log({ conceptId: "gone" })], "concept", new Map());
    expect(deleted[0]?.label).toBe("削除済みConcept");
    expect(deleted[0]?.masteryProbability).toBeNull();
    expect(deleted[0]?.pfaNextCorrectProbability).toBeNull();
    expect(deleted[0]?.hlrHalfLifeDays).toBeNull();
  });

  it("Concept 以外の groupBy ではモデル指標を付けない", () => {
    const logs = [
      log({ id: "1", answeredAt: "2026-01-01T00:00:00.000Z" }),
      log({ id: "2", answeredAt: "2026-01-03T00:00:00.000Z" })
    ];
    const conceptById = new Map([["concept-a", concept()]]);
    for (const groupBy of ["domain", "deck", "day", "week", "month"] as const) {
      const attached = attach(logs, groupBy, conceptById);
      expect(
        attached.every(
          (row) =>
            row.masteryProbability === null &&
            row.pfaNextCorrectProbability === null &&
            row.pfaSuccessCount === null &&
            row.pfaFailureCount === null &&
            row.hlrRetentionProbability === null &&
            row.hlrHalfLifeDays === null &&
            row.hlrElapsedDays === null
        )
      ).toBe(true);
    }
  });
});
