import { describe, expect, it } from "vitest";
import { QUIZ_ATTEMPT_LOG_SCHEMA_VERSION, type QuizAttemptLog } from "../../types/quiz";
import { getConceptHlrEstimate } from "../hlr/getConceptHlrEstimate";
import { buildOneStepAheadPredictionSeries } from "../learningModelEvaluation/oneStepAhead";
import { calculateBktMastery } from "../mastery/bkt";
import { getConceptMastery } from "../mastery/getConceptMastery";
import { getConceptMasteryHistory } from "../mastery/getConceptMasteryHistory";
import { getConceptPfaPrediction } from "../pfa/getConceptPfaPrediction";
import {
  normalizeLearningModelEvents,
  normalizeQuizAttemptLogSequence,
  parseAnsweredAtMs
} from "./normalizeQuizAttemptLogs";

const baseLog = (overrides: Partial<QuizAttemptLog>): QuizAttemptLog => ({
  id: "log-1",
  questionId: "q-1",
  questionType: "multiple-choice",
  questionPromptSnapshot: "prompt",
  selectedChoiceId: "a",
  selectedChoiceTextSnapshot: "A",
  correctChoiceId: "a",
  correctChoiceTextSnapshot: "A",
  correct: true,
  startedAt: "2026-01-01T00:00:00.000Z",
  answeredAt: "2026-01-01T00:00:01.000Z",
  timeMs: 1000,
  schemaVersion: QUIZ_ATTEMPT_LOG_SCHEMA_VERSION,
  ...overrides
});

describe("parseAnsweredAtMs", () => {
  it("timezone offset が異なる同等時刻を同じ timeMs にする", () => {
    const utc = parseAnsweredAtMs("2026-01-01T03:00:00.000Z");
    const offset = parseAnsweredAtMs("2026-01-01T12:00:00+09:00");
    expect(utc).not.toBeNull();
    expect(utc).toBe(offset);
  });

  it("Invalid Date を null にする", () => {
    expect(parseAnsweredAtMs("not-a-date")).toBeNull();
  });
});

describe("normalizeQuizAttemptLogSequence", () => {
  const a = baseLog({
    id: "a",
    answeredAt: "2026-01-01T03:00:00.000Z"
  });
  const b = baseLog({
    id: "b",
    answeredAt: "2026-01-01T12:00:00+09:00"
  });
  const c = baseLog({
    id: "c",
    answeredAt: "2026-01-01T04:00:00.000Z"
  });

  it("timezone offset 混在時は実時刻順、同一時刻は id 順", () => {
    const ids = normalizeQuizAttemptLogSequence([b, a, c]).map((item) => item.log.id);
    expect(ids).toEqual(["a", "b", "c"]);
    expect(normalizeQuizAttemptLogSequence([b, a, c])[0].timeMs).toBe(
      normalizeQuizAttemptLogSequence([b, a, c])[1].timeMs
    );
  });

  it("入力順列を変えても同じ sequence になる", () => {
    const permutations = [
      [a, b, c],
      [c, a, b],
      [b, c, a]
    ];
    const expected = ["a", "b", "c"];
    for (const logs of permutations) {
      expect(normalizeQuizAttemptLogSequence(logs).map((item) => item.log.id)).toEqual(expected);
    }
  });

  it("invalid timestamp を除外する", () => {
    const invalid = baseLog({ id: "invalid", answeredAt: "not-a-date" });
    expect(normalizeQuizAttemptLogSequence([a, invalid, c]).map((item) => item.log.id)).toEqual(["a", "c"]);
  });

  it("元の配列順と log object を変更しない", () => {
    const logs = [c, a, b];
    const snapshot = logs.map((log) => ({ ...log }));
    const first = logs[0];
    normalizeQuizAttemptLogSequence(logs);
    expect(logs).toEqual(snapshot);
    expect(logs[0]).toBe(first);
    expect(logs[0].id).toBe("c");
  });
});

describe("normalizeLearningModelEvents", () => {
  it("Concept を解決できないログを除外する", () => {
    const resolved = baseLog({
      id: "kept",
      questionConceptId: "concept-a",
      answeredAt: "2026-01-01T00:00:00.000Z"
    });
    const unresolved = baseLog({
      id: "orphan",
      selectedLinkedConceptId: "only-selected",
      answeredAt: "2026-01-01T01:00:00.000Z"
    });
    expect(normalizeLearningModelEvents([unresolved, resolved]).map((event) => event.log.id)).toEqual(["kept"]);
    expect(normalizeLearningModelEvents([unresolved, resolved])[0].conceptId).toBe("concept-a");
  });

  it("conceptId なし / questionConceptId なしは除外する", () => {
    const log = baseLog({
      id: "none",
      answeredAt: "2026-01-01T00:00:00.000Z"
    });
    expect(normalizeLearningModelEvents([log])).toEqual([]);
  });
});

describe("learning-model eligible set の共有", () => {
  const validA = baseLog({
    id: "a",
    questionConceptId: "concept-a",
    correct: true,
    answeredAt: "2026-01-01T03:00:00.000Z"
  });
  const timezoneB = baseLog({
    id: "b",
    questionConceptId: "concept-a",
    correct: false,
    answeredAt: "2026-01-01T12:00:00+09:00"
  });
  const laterC = baseLog({
    id: "c",
    questionConceptId: "concept-a",
    correct: true,
    answeredAt: "2026-01-01T04:00:00.000Z"
  });
  const invalidD = baseLog({
    id: "d",
    questionConceptId: "concept-a",
    correct: false,
    answeredAt: "not-a-date"
  });
  const unresolvedE = baseLog({
    id: "e",
    selectedLinkedConceptId: "other",
    correct: true,
    answeredAt: "2026-01-01T05:00:00.000Z"
  });
  const mixed = [validA, timezoneB, laterC, invalidD, unresolvedE];
  const eligibleIds = ["a", "b", "c"];

  it("Concept-aware 正規化の eligible IDs が BKT / PFA / HLR / history / one-step-ahead と一致する", () => {
    expect(normalizeLearningModelEvents(mixed).map((event) => event.log.id)).toEqual(eligibleIds);

    const mastery = getConceptMastery(mixed, "concept-a");
    expect(mastery.attemptCount).toBe(3);
    expect(mastery.correctCount).toBe(2);
    expect(mastery.incorrectCount).toBe(1);

    const eligibleOnly = [validA, timezoneB, laterC];
    expect(mastery.masteryProbability).toBe(calculateBktMastery(eligibleOnly));
    expect(getConceptMasteryHistory(mixed, "concept-a").map((point) => point.quizAttemptLogId)).toEqual(
      eligibleIds
    );
    expect(getConceptPfaPrediction(mixed, "concept-a")).toEqual(getConceptPfaPrediction(eligibleOnly, "concept-a"));
    const now = new Date("2026-01-10T00:00:00.000Z");
    expect(getConceptHlrEstimate(mixed, "concept-a", { now })).toEqual(
      getConceptHlrEstimate(eligibleOnly, "concept-a", { now })
    );

    const spy = {
      id: "spy",
      predictNextCorrectProbability: () => 0.5
    };
    expect(buildOneStepAheadPredictionSeries(mixed, [spy]).map((point) => point.attemptId)).toEqual(eligibleIds);
  });
});
