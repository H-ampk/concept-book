import { describe, expect, it } from "vitest";
import { createEmptyConceptInput, type Concept } from "../../types/concept";
import { QUIZ_ATTEMPT_LOG_SCHEMA_VERSION, type QuizAttemptLog } from "../../types/quiz";
import { calculateHlrHalfLifeDays, calculateHlrRetentionProbability } from "../hlr/hlr";
import { buildConceptMasteryMap } from "../mastery/getConceptMastery";
import { buildConceptPfaPredictionMap } from "../pfa/getConceptPfaPrediction";
import { buildDataLabAggregatedRows } from "./buildDataLabAggregatedRows";

const log = (overrides: Partial<QuizAttemptLog> = {}): QuizAttemptLog => ({
  id: "log-1",
  questionId: "q1",
  questionType: "multiple-choice",
  questionPromptSnapshot: "問い",
  selectedChoiceId: "c1",
  selectedChoiceTextSnapshot: "選択",
  correctChoiceId: "c1",
  correctChoiceTextSnapshot: "正解",
  correct: false,
  startedAt: "2026-09-01T12:00:00.000Z",
  answeredAt: "2026-09-01T12:00:00.000Z",
  timeMs: 10,
  schemaVersion: QUIZ_ATTEMPT_LOG_SCHEMA_VERSION,
  conceptId: "concept-a",
  ...overrides
});

const concept = (): Concept => ({
  ...createEmptyConceptInput(),
  id: "concept-a",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  title: "人工知能"
});

/** 2 失敗日 → half-life = 0.25 日。T0 最終回答、T1 = T0 + 6h で retention が 1 と 0.5 に分かれる。 */
const t0 = "2026-09-02T12:00:00.000Z";
const t1 = "2026-09-02T18:00:00.000Z";

const shortHalfLifeLogs: QuizAttemptLog[] = [
  log({ id: "d1", answeredAt: "2026-09-01T12:00:00.000Z", correct: false }),
  log({ id: "d2", answeredAt: t0, correct: false })
];

describe("buildDataLabAggregatedRows (#182)", () => {
  it("同じログでも HLR now が T0 と T1 なら retention が異なる", () => {
    const conceptById = new Map([["concept-a", concept()]]);
    const masteryByConceptId = buildConceptMasteryMap(shortHalfLifeLogs);
    const pfaByConceptId = buildConceptPfaPredictionMap(shortHalfLifeLogs);
    const halfLifeDays = calculateHlrHalfLifeDays(0, 2);

    const atT0 = buildDataLabAggregatedRows({
      logs: shortHalfLifeLogs,
      groupBy: "concept",
      conceptById,
      deckById: new Map(),
      masteryByConceptId,
      pfaByConceptId,
      hlrNow: new Date(t0)
    });
    const atT1 = buildDataLabAggregatedRows({
      logs: shortHalfLifeLogs,
      groupBy: "concept",
      conceptById,
      deckById: new Map(),
      masteryByConceptId,
      pfaByConceptId,
      hlrNow: new Date(t1)
    });

    expect(halfLifeDays).toBe(0.25);
    expect(atT0[0]?.hlrHalfLifeDays).toBe(halfLifeDays);
    expect(atT1[0]?.hlrHalfLifeDays).toBe(halfLifeDays);
    expect(atT0[0]?.hlrElapsedDays).toBe(0);
    expect(atT1[0]?.hlrElapsedDays).toBeCloseTo(0.25);
    expect(atT0[0]?.hlrRetentionProbability).toBe(1);
    expect(atT1[0]?.hlrRetentionProbability).toBe(
      calculateHlrRetentionProbability(0.25, halfLifeDays)
    );
    expect(atT0[0]?.hlrRetentionProbability).not.toBe(atT1[0]?.hlrRetentionProbability);
    expect(atT1[0]?.hlrRetentionProbability).toBe(0.5);
  });
});
