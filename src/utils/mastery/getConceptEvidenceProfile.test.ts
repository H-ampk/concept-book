import { describe, expect, it } from "vitest";
import { getConceptEvidenceProfile } from "./getConceptEvidenceProfile";
import type { ConceptMasteryPoint } from "./types";

const point = (overrides: Partial<ConceptMasteryPoint> = {}): ConceptMasteryPoint => ({
  conceptId: "c1",
  attemptIndex: 1,
  answeredAt: "2026-09-10T05:32:00.000Z",
  correct: true,
  masteryProbability: 0.5,
  masteryScore: 50,
  previousMasteryProbability: 0.2,
  previousMasteryScore: 20,
  masteryDelta: 30,
  quizAttemptLogId: "log-1",
  questionId: "q-1",
  questionPromptSnapshot: "prompt",
  timeMs: 4200,
  questionType: "multiple-choice",
  evidenceKind: "recognition",
  observationOutcome: "correct",
  ...overrides
});

describe("getConceptEvidenceProfile", () => {
  it("空配列は no-evidence で件数 0", () => {
    const profile = getConceptEvidenceProfile([]);
    expect(profile.state).toBe("no-evidence");
    expect(profile.recognition.attemptCount).toBe(0);
    expect(profile.recall.attemptCount).toBe(0);
    expect(profile.recognition.latestOutcome).toBeNull();
    expect(profile.recall.latestOutcome).toBeNull();
  });

  it("recognition only を集計し、最新は時系列の最後", () => {
    const profile = getConceptEvidenceProfile([
      point({
        attemptIndex: 1,
        quizAttemptLogId: "a",
        answeredAt: "2026-01-01T00:00:00.000Z",
        observationOutcome: "correct",
        correct: true
      }),
      point({
        attemptIndex: 2,
        quizAttemptLogId: "b",
        answeredAt: "2026-01-02T00:00:00.000Z",
        observationOutcome: "incorrect",
        correct: false
      }),
      point({
        attemptIndex: 3,
        quizAttemptLogId: "c",
        answeredAt: "2026-01-03T00:00:00.000Z",
        observationOutcome: "correct",
        correct: true
      })
    ]);
    expect(profile.recognition.attemptCount).toBe(3);
    expect(profile.recognition.correctCount).toBe(2);
    expect(profile.recognition.incorrectCount).toBe(1);
    expect(profile.recognition.latestOutcome).toBe("correct");
    expect(profile.recall.attemptCount).toBe(0);
    expect(profile.state).toBe("recognition-only");
  });

  it("recall only は partial を潰さず集計する", () => {
    const profile = getConceptEvidenceProfile([
      point({
        attemptIndex: 1,
        quizAttemptLogId: "a",
        answeredAt: "2026-01-01T00:00:00.000Z",
        questionType: "free-response",
        evidenceKind: "recall",
        observationOutcome: "correct",
        correct: true
      }),
      point({
        attemptIndex: 2,
        quizAttemptLogId: "b",
        answeredAt: "2026-01-02T00:00:00.000Z",
        questionType: "free-response",
        evidenceKind: "recall",
        observationOutcome: "partial",
        correct: false,
        selfEvaluation: "partial"
      }),
      point({
        attemptIndex: 3,
        quizAttemptLogId: "c",
        answeredAt: "2026-01-03T00:00:00.000Z",
        questionType: "free-response",
        evidenceKind: "recall",
        observationOutcome: "incorrect",
        correct: false,
        selfEvaluation: "incorrect"
      })
    ]);
    expect(profile.recall.attemptCount).toBe(3);
    expect(profile.recall.correctCount).toBe(1);
    expect(profile.recall.partialCount).toBe(1);
    expect(profile.recall.incorrectCount).toBe(1);
    expect(profile.recall.latestOutcome).toBe("incorrect");
    expect(profile.recognition.attemptCount).toBe(0);
    expect(profile.state).toBe("recall-only");
  });

  it("latest recognition correct / recall incorrect は recognition-ahead", () => {
    const profile = getConceptEvidenceProfile([
      point({
        attemptIndex: 1,
        quizAttemptLogId: "r",
        answeredAt: "2026-01-02T00:00:00.000Z",
        observationOutcome: "correct"
      }),
      point({
        attemptIndex: 2,
        quizAttemptLogId: "c",
        answeredAt: "2026-01-03T00:00:00.000Z",
        questionType: "free-response",
        evidenceKind: "recall",
        observationOutcome: "incorrect",
        correct: false
      })
    ]);
    expect(profile.state).toBe("recognition-ahead");
  });

  it("latest recognition correct / recall partial も recognition-ahead", () => {
    const profile = getConceptEvidenceProfile([
      point({
        attemptIndex: 1,
        quizAttemptLogId: "r",
        answeredAt: "2026-01-02T00:00:00.000Z",
        observationOutcome: "correct"
      }),
      point({
        attemptIndex: 2,
        quizAttemptLogId: "c",
        answeredAt: "2026-01-03T00:00:00.000Z",
        questionType: "free-response",
        evidenceKind: "recall",
        observationOutcome: "partial",
        correct: false,
        selfEvaluation: "partial"
      })
    ]);
    expect(profile.state).toBe("recognition-ahead");
  });

  it("両方 correct は both-confirmed", () => {
    const profile = getConceptEvidenceProfile([
      point({
        attemptIndex: 1,
        quizAttemptLogId: "r",
        answeredAt: "2026-01-01T00:00:00.000Z",
        observationOutcome: "correct"
      }),
      point({
        attemptIndex: 2,
        quizAttemptLogId: "c",
        answeredAt: "2026-01-02T00:00:00.000Z",
        questionType: "free-response",
        evidenceKind: "recall",
        observationOutcome: "correct"
      })
    ]);
    expect(profile.state).toBe("both-confirmed");
  });

  it("recognition incorrect / recall correct は recall-ahead", () => {
    const profile = getConceptEvidenceProfile([
      point({
        attemptIndex: 1,
        quizAttemptLogId: "r",
        answeredAt: "2026-01-01T00:00:00.000Z",
        observationOutcome: "incorrect",
        correct: false
      }),
      point({
        attemptIndex: 2,
        quizAttemptLogId: "c",
        answeredAt: "2026-01-02T00:00:00.000Z",
        questionType: "free-response",
        evidenceKind: "recall",
        observationOutcome: "correct"
      })
    ]);
    expect(profile.state).toBe("recall-ahead");
  });

  it("両方 incorrect は both-weak", () => {
    const profile = getConceptEvidenceProfile([
      point({
        attemptIndex: 1,
        quizAttemptLogId: "r",
        answeredAt: "2026-01-01T00:00:00.000Z",
        observationOutcome: "incorrect",
        correct: false
      }),
      point({
        attemptIndex: 2,
        quizAttemptLogId: "c",
        answeredAt: "2026-01-02T00:00:00.000Z",
        questionType: "free-response",
        evidenceKind: "recall",
        observationOutcome: "incorrect",
        correct: false
      })
    ]);
    expect(profile.state).toBe("both-weak");
  });

  it("入力が逆順でも latest 判定は変わらず、入力配列を mutate しない", () => {
    const history = [
      point({
        attemptIndex: 3,
        quizAttemptLogId: "later-rec",
        answeredAt: "2026-01-03T00:00:00.000Z",
        observationOutcome: "correct"
      }),
      point({
        attemptIndex: 2,
        quizAttemptLogId: "later-rec-wrong-wait",
        answeredAt: "2026-01-02T00:00:00.000Z",
        questionType: "free-response",
        evidenceKind: "recall",
        observationOutcome: "incorrect",
        correct: false
      }),
      point({
        attemptIndex: 1,
        quizAttemptLogId: "earlier-rec",
        answeredAt: "2026-01-01T00:00:00.000Z",
        observationOutcome: "incorrect",
        correct: false
      })
    ];
    const snapshot = history.map((item) => item.quizAttemptLogId);
    const reversed = [...history].reverse();
    const forward = getConceptEvidenceProfile(history);
    const backward = getConceptEvidenceProfile(reversed);
    expect(forward.recognition.latestOutcome).toBe("correct");
    expect(backward.recognition.latestOutcome).toBe("correct");
    expect(forward.recall.latestOutcome).toBe("incorrect");
    expect(backward.recall.latestOutcome).toBe("incorrect");
    expect(forward.state).toBe("recognition-ahead");
    expect(backward.state).toBe("recognition-ahead");
    expect(history.map((item) => item.quizAttemptLogId)).toEqual(snapshot);
    expect(reversed.map((item) => item.quizAttemptLogId)).toEqual([...snapshot].reverse());
  });

  it("recognition に partial があっても crash せず件数に残す", () => {
    const profile = getConceptEvidenceProfile([
      point({
        observationOutcome: "partial",
        correct: false
      })
    ]);
    expect(profile.recognition.attemptCount).toBe(1);
    expect(profile.recognition.partialCount).toBe(1);
    expect(profile.recognition.incorrectCount).toBe(0);
    expect(profile.state).toBe("recognition-only");
  });
});
