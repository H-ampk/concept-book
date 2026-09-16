import { describe, expect, it } from "vitest";
import { QUIZ_QUESTION_SCHEMA_VERSION, type QuizQuestion } from "../../types/quiz";
import { filterQuizPool } from "./filterQuizPool";

const iso = "2026-01-01T00:00:00.000Z";

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
  createdAt: iso,
  updatedAt: iso,
  ...overrides
});

describe("filterQuizPool conceptGeneral", () => {
  const general = question({
    id: "general",
    source: {
      type: "conceptGeneral",
      sourceId: "a",
      sourceTitle: "概念A",
      fieldName: "情報科学"
    }
  });
  const contextCard = question({
    id: "cc",
    source: {
      type: "contextCard",
      sourceId: "card-1",
      sourceTitle: "カード",
      fieldName: "心理学"
    }
  });
  const contextual = question({
    id: "ccc",
    source: {
      type: "contextualConceptCard",
      sourceId: "a:ctx-1",
      sourceTitle: "概念A",
      fieldName: "統計"
    }
  });
  const sourceless = question({ id: "old" });

  it("fieldTag = source.fieldName で conceptGeneral を取得できる", () => {
    const filtered = filterQuizPool([general, contextCard, contextual, sourceless], {
      fieldTag: "情報科学"
    });
    expect(filtered.map((q) => q.id).sort()).toEqual(["general", "old"]);
  });

  it("sourceType = conceptGeneral で絞り込める", () => {
    const filtered = filterQuizPool([general, contextCard, contextual], {
      sourceType: "conceptGeneral"
    });
    expect(filtered.map((q) => q.id)).toEqual(["general"]);
  });

  it("contextCardId は contextCard source のみ", () => {
    const filtered = filterQuizPool([general, contextCard, contextual], {
      contextCardId: "card-1"
    });
    expect(filtered.map((q) => q.id)).toEqual(["cc"]);
  });

  it("contextualCardId は contextualConceptCard source のみ", () => {
    const filtered = filterQuizPool([general, contextCard, contextual], {
      contextualCardId: "a:ctx-1"
    });
    expect(filtered.map((q) => q.id)).toEqual(["ccc"]);
  });
});
