import { describe, expect, it } from "vitest";
import { QUIZ_ATTEMPT_LOG_SCHEMA_VERSION, type QuizAttemptLog } from "../../types/quiz";
import { DEFAULT_BKT_PARAMETERS, DEFAULT_FREE_RESPONSE_BKT_EVIDENCE } from "./constants";
import { recognitionObservationLikelihood, resolveBktEvidence } from "./resolveBktEvidence";

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

describe("resolveBktEvidence", () => {
  it("multiple-choice correct は recognition / correct", () => {
    const evidence = resolveBktEvidence(baseLog({ correct: true }));
    expect(evidence.kind).toBe("recognition");
    expect(evidence.outcome).toBe("correct");
    expect(evidence.questionType).toBe("multiple-choice");
    expect(evidence.selfEvaluation).toBeUndefined();
    expect(evidence.likelihood).toEqual(recognitionObservationLikelihood("correct", DEFAULT_BKT_PARAMETERS));
  });

  it("multiple-choice incorrect は recognition / incorrect", () => {
    const evidence = resolveBktEvidence(baseLog({ correct: false }));
    expect(evidence.kind).toBe("recognition");
    expect(evidence.outcome).toBe("incorrect");
    expect(evidence.likelihood).toEqual(
      recognitionObservationLikelihood("incorrect", DEFAULT_BKT_PARAMETERS)
    );
  });

  it("free-response correct は recall / correct", () => {
    const evidence = resolveBktEvidence(
      baseLog({
        questionType: "free-response",
        correct: true,
        selfEvaluation: "correct"
      })
    );
    expect(evidence.kind).toBe("recall");
    expect(evidence.outcome).toBe("correct");
    expect(evidence.questionType).toBe("free-response");
    expect(evidence.selfEvaluation).toBe("correct");
    expect(evidence.likelihood).toEqual(DEFAULT_FREE_RESPONSE_BKT_EVIDENCE.correct);
  });

  it("free-response partial は recall / partial（correct=false でも partial を使う）", () => {
    const evidence = resolveBktEvidence(
      baseLog({
        questionType: "free-response",
        correct: false,
        selfEvaluation: "partial"
      })
    );
    expect(evidence.kind).toBe("recall");
    expect(evidence.outcome).toBe("partial");
    expect(evidence.selfEvaluation).toBe("partial");
    expect(evidence.likelihood).toEqual(DEFAULT_FREE_RESPONSE_BKT_EVIDENCE.partial);
  });

  it("free-response incorrect は recall / incorrect", () => {
    const evidence = resolveBktEvidence(
      baseLog({
        questionType: "free-response",
        correct: false,
        selfEvaluation: "incorrect"
      })
    );
    expect(evidence.kind).toBe("recall");
    expect(evidence.outcome).toBe("incorrect");
    expect(evidence.likelihood).toEqual(DEFAULT_FREE_RESPONSE_BKT_EVIDENCE.incorrect);
  });

  it("questionType 欠落の旧ログ相当は multiple-choice fallback になる", () => {
    const log = baseLog({ correct: true });
    delete (log as { questionType?: QuizAttemptLog["questionType"] }).questionType;
    const evidence = resolveBktEvidence(log);
    expect(evidence.kind).toBe("recognition");
    expect(evidence.outcome).toBe("correct");
    expect(evidence.questionType).toBe("multiple-choice");
  });

  it("malformed free-response で selfEvaluation が無くても crash せず correct boolean へ fallback する", () => {
    const correctEvidence = resolveBktEvidence(
      baseLog({
        questionType: "free-response",
        correct: true
      })
    );
    expect(correctEvidence.kind).toBe("recall");
    expect(correctEvidence.outcome).toBe("correct");
    expect(correctEvidence.selfEvaluation).toBeUndefined();
    expect(correctEvidence.likelihood).toEqual(DEFAULT_FREE_RESPONSE_BKT_EVIDENCE.correct);

    const incorrectEvidence = resolveBktEvidence(
      baseLog({
        questionType: "free-response",
        correct: false
      })
    );
    expect(incorrectEvidence.outcome).toBe("incorrect");
    expect(incorrectEvidence.likelihood).toEqual(DEFAULT_FREE_RESPONSE_BKT_EVIDENCE.incorrect);
  });

  it("custom BktParameters の guess / slip を multiple-choice likelihood に使う", () => {
    const parameters = {
      ...DEFAULT_BKT_PARAMETERS,
      guessProbability: 0.05,
      slipProbability: 0.3
    };
    const evidence = resolveBktEvidence(baseLog({ correct: true }), { parameters });
    expect(evidence.likelihood).toEqual({
      probabilityIfLearned: 0.7,
      probabilityIfNotLearned: 0.05
    });
  });
});
