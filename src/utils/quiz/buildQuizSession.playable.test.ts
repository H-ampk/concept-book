import { describe, expect, it } from "vitest";
import { QUIZ_QUESTION_SCHEMA_VERSION, type QuizQuestion } from "../../types/quiz";
import { buildQuizSession, isPlayableQuestion } from "./buildQuizSession";

const iso = "2026-01-01T00:00:00.000Z";

const mc = (overrides: Partial<QuizQuestion> = {}): QuizQuestion => ({
  id: "q-mc",
  questionType: "multiple-choice",
  prompt: "四択の問い",
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

const fr = (overrides: Partial<QuizQuestion> = {}): QuizQuestion => ({
  id: "q-fr",
  questionType: "free-response",
  prompt: "入力式の問い",
  choices: [],
  correctChoiceId: "",
  referenceAnswer: "模範解答",
  visibility: "private",
  schemaVersion: QUIZ_QUESTION_SCHEMA_VERSION,
  createdAt: iso,
  updatedAt: iso,
  ...overrides
});

describe("isPlayableQuestion", () => {
  it("legacy 相当の four-choice は playable", () => {
    expect(isPlayableQuestion(mc())).toBe(true);
  });

  it("valid free-response は playable", () => {
    expect(isPlayableQuestion(fr())).toBe(true);
  });

  it("referenceAnswer が空の free-response は playable ではない", () => {
    expect(isPlayableQuestion(fr({ referenceAnswer: "   " }))).toBe(false);
    expect(isPlayableQuestion(fr({ referenceAnswer: undefined }))).toBe(false);
  });

  it("prompt が空の free-response は playable ではない", () => {
    expect(isPlayableQuestion(fr({ prompt: "  " }))).toBe(false);
  });

  it("multiple-choice の既存条件は維持する", () => {
    expect(isPlayableQuestion(mc({ prompt: "" }))).toBe(false);
    expect(isPlayableQuestion(mc({ choices: [{ id: "a", text: "A" }] }))).toBe(false);
    expect(isPlayableQuestion(mc({ correctChoiceId: "missing" }))).toBe(false);
  });
});

describe("buildQuizSession free-response", () => {
  it("free-response をセッション抽出し shuffledChoices は空にする", () => {
    const session = buildQuizSession([fr(), mc()], { sessionSize: 2, random: () => 0 });
    expect(session).toHaveLength(2);
    const frItem = session.find((item) => item.question.id === "q-fr");
    expect(frItem?.shuffledChoices).toEqual([]);
  });
});
