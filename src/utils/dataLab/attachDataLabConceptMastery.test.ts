import { describe, expect, it } from "vitest";
import { createEmptyConceptInput, type Concept } from "../../types/concept";
import { QUIZ_ATTEMPT_LOG_SCHEMA_VERSION, type QuizAttemptLog } from "../../types/quiz";
import { filterDataLabLogs } from "./filterDataLabLogs";
import { aggregateDataLabLogs } from "./aggregateDataLabLogs";
import { attachDataLabConceptMastery } from "./attachDataLabConceptMastery";
import { buildConceptMasteryMap, getConceptMastery } from "../mastery/getConceptMastery";

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

describe("attachDataLabConceptMastery", () => {
  it("全ログから buildConceptMasteryMap を作り、Concept 行に同じ BKT 理解度を付ける", () => {
    const logs = [
      log({ id: "1", correct: true }),
      log({ id: "2", correct: false, answeredAt: "2026-01-02T00:00:00.000Z" })
    ];
    const conceptById = new Map([["concept-a", concept()]]);
    const rows = aggregateDataLabLogs({
      logs,
      groupBy: "concept",
      conceptById,
      deckById: new Map()
    });
    const masteryByConceptId = buildConceptMasteryMap(logs);
    const attached = attachDataLabConceptMastery(rows, masteryByConceptId, conceptById);
    const expected = getConceptMastery(logs, "concept-a");

    expect(attached[0]?.masteryProbability).toBe(expected.masteryProbability);
    expect(attached[0]?.masteryProbability).toBe(masteryByConceptId.get("concept-a")?.masteryProbability);
    expect(attached[0]?.attemptCount).toBe(2);
  });

  it("期間フィルタ後も理解度は全ログ、回答数はフィルタ済みになる", () => {
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

    const filteredRows = aggregateDataLabLogs({
      logs: filteredLogs,
      groupBy: "concept",
      conceptById,
      deckById: new Map()
    });
    const masteryFromAll = buildConceptMasteryMap(allLogs);
    const masteryFromFiltered = buildConceptMasteryMap(filteredLogs);
    const attached = attachDataLabConceptMastery(filteredRows, masteryFromAll, conceptById);

    expect(attached[0]?.attemptCount).toBe(1);
    expect(attached[0]?.accuracy).toBe(1);
    expect(attached[0]?.masteryProbability).toBe(getConceptMastery(allLogs, "concept-a").masteryProbability);
    expect(attached[0]?.masteryProbability).not.toBe(
      masteryFromFiltered.get("concept-a")?.masteryProbability
    );
  });

  it("Conceptなしは理解度 null であり 0 にしない", () => {
    const rows = aggregateDataLabLogs({
      logs: [log({ conceptId: undefined, questionConceptId: undefined })],
      groupBy: "concept",
      conceptById: new Map(),
      deckById: new Map()
    });
    const attached = attachDataLabConceptMastery(rows, buildConceptMasteryMap([log()]), new Map());
    expect(attached[0]?.masteryProbability).toBeNull();
  });

  it("削除済み Concept は理解度 null にする", () => {
    const logs = [log({ conceptId: "gone" })];
    const rows = aggregateDataLabLogs({
      logs,
      groupBy: "concept",
      conceptById: new Map(),
      deckById: new Map()
    });
    const attached = attachDataLabConceptMastery(rows, buildConceptMasteryMap(logs), new Map());
    expect(rows[0]?.label).toBe("削除済みConcept");
    expect(attached[0]?.masteryProbability).toBeNull();
  });

  it("分野・Deck・日集計には理解度を付けない", () => {
    const logs = [log()];
    const conceptById = new Map([["concept-a", concept()]]);
    const masteryByConceptId = buildConceptMasteryMap(logs);
    for (const groupBy of ["domain", "deck", "day", "week", "month"] as const) {
      const rows = aggregateDataLabLogs({
        logs,
        groupBy,
        conceptById,
        deckById: new Map()
      });
      const attached = attachDataLabConceptMastery(rows, masteryByConceptId, conceptById);
      expect(attached.every((row) => row.masteryProbability === null)).toBe(true);
    }
  });
});
