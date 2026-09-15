import { describe, expect, it } from "vitest";
import { QUIZ_QUESTION_SCHEMA_VERSION, type QuizQuestion } from "../../types/quiz";
import { resolveQuestionConceptId } from "./resolveQuestionConceptId";

const question = (overrides: Partial<QuizQuestion> = {}): QuizQuestion => ({
  id: "q-1",
  questionType: "multiple-choice",
  prompt: "問い",
  choices: [
    { id: "a", text: "A" },
    { id: "b", text: "B" }
  ],
  correctChoiceId: "a",
  visibility: "private",
  schemaVersion: QUIZ_QUESTION_SCHEMA_VERSION,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides
});

describe("resolveQuestionConceptId", () => {
  const valid = new Set(["live-a", "live-b"]);

  it("direct conceptId が valid なら direct を返す", () => {
    expect(resolveQuestionConceptId(question({ conceptId: "live-a" }), valid)).toBe("live-a");
  });

  it("direct 無し、正解 choice.sourceConceptId が valid なら sourceConceptId を返す", () => {
    expect(
      resolveQuestionConceptId(
        question({
          choices: [
            { id: "a", text: "A", sourceConceptId: "live-b" },
            { id: "b", text: "B" }
          ]
        }),
        valid
      )
    ).toBe("live-b");
  });

  it("direct conceptId が dangling なら dangling を返さない", () => {
    expect(resolveQuestionConceptId(question({ conceptId: "deleted" }), valid)).toBeUndefined();
  });

  it("direct dangling + 正解 sourceConceptId valid なら sourceConceptId を返す", () => {
    expect(
      resolveQuestionConceptId(
        question({
          conceptId: "deleted",
          choices: [
            { id: "a", text: "A", sourceConceptId: "live-a" },
            { id: "b", text: "B" }
          ]
        }),
        valid
      )
    ).toBe("live-a");
  });

  it("direct 無し + sourceConceptId dangling なら undefined", () => {
    expect(
      resolveQuestionConceptId(
        question({
          choices: [
            { id: "a", text: "A", sourceConceptId: "deleted" },
            { id: "b", text: "B" }
          ]
        }),
        valid
      )
    ).toBeUndefined();
  });

  it("direct / source とも無しなら undefined", () => {
    expect(resolveQuestionConceptId(question(), valid)).toBeUndefined();
  });
});
