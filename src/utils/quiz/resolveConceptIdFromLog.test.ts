import { describe, expect, it } from "vitest";
import { QUIZ_ATTEMPT_LOG_SCHEMA_VERSION, type QuizAttemptLog } from "../../types/quiz";
import { resolveConceptIdFromLog } from "./resolveConceptIdFromLog";

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

describe("resolveConceptIdFromLog", () => {
  it("conceptId と questionConceptId が異なるとき conceptId を返す", () => {
    expect(
      resolveConceptIdFromLog(
        baseLog({
          conceptId: "cid",
          questionConceptId: "qid"
        })
      )
    ).toBe("cid");
  });

  it("conceptId が無ければ questionConceptId へ fallback する", () => {
    expect(resolveConceptIdFromLog(baseLog({ questionConceptId: "qid" }))).toBe("qid");
  });

  it("空白のみの conceptId は未設定として questionConceptId へ fallback する", () => {
    expect(
      resolveConceptIdFromLog(
        baseLog({
          conceptId: "   ",
          questionConceptId: "qid"
        })
      )
    ).toBe("qid");
  });

  it("どちらも無ければ selectedLinkedConceptId / correctLinkedConceptId があっても null", () => {
    expect(
      resolveConceptIdFromLog(
        baseLog({
          selectedLinkedConceptId: "other",
          correctLinkedConceptId: "linked"
        })
      )
    ).toBeNull();
  });
});
