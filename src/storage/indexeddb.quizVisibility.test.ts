import { describe, expect, it } from "vitest";
import { QUIZ_DECK_SCHEMA_VERSION, QUIZ_QUESTION_SCHEMA_VERSION } from "../types/quiz";
import { normalizeQuizDeck, normalizeQuizQuestion } from "./indexeddb";

const iso = "2026-01-01T00:00:00.000Z";

describe("IndexedDB QuizVisibility normalize", () => {
  it("旧 QuizQuestion の visibility public を読み込むと shareable になる", () => {
    const question = normalizeQuizQuestion({
      id: "q_legacy",
      prompt: "問い",
      choices: [
        { id: "a", text: "A" },
        { id: "b", text: "B" }
      ],
      correctChoiceId: "a",
      visibility: "public",
      schemaVersion: QUIZ_QUESTION_SCHEMA_VERSION,
      createdAt: iso,
      updatedAt: iso
    });
    expect(question.visibility).toBe("shareable");
  });

  it("旧 QuizDeck の visibility public を読み込むと shareable になる", () => {
    const deck = normalizeQuizDeck({
      id: "deck_legacy",
      title: "旧公開集",
      questionIds: ["q_legacy"],
      visibility: "public",
      schemaVersion: QUIZ_DECK_SCHEMA_VERSION,
      createdAt: iso,
      updatedAt: iso
    });
    expect(deck.visibility).toBe("shareable");
  });

  it("新規保存した shareable の QuizQuestion が round-trip する", () => {
    const saved = normalizeQuizQuestion({
      id: "q_new",
      prompt: "問い",
      choices: [
        { id: "a", text: "A" },
        { id: "b", text: "B" }
      ],
      correctChoiceId: "a",
      visibility: "shareable",
      schemaVersion: QUIZ_QUESTION_SCHEMA_VERSION,
      createdAt: iso,
      updatedAt: iso
    });
    expect(saved.visibility).toBe("shareable");
    expect(normalizeQuizQuestion(saved).visibility).toBe("shareable");
  });

  it("新規保存した shareable の QuizDeck が round-trip する", () => {
    const saved = normalizeQuizDeck({
      id: "deck_new",
      title: "共有可集",
      questionIds: ["q_new"],
      visibility: "shareable",
      schemaVersion: QUIZ_DECK_SCHEMA_VERSION,
      createdAt: iso,
      updatedAt: iso
    });
    expect(saved.visibility).toBe("shareable");
    expect(normalizeQuizDeck(saved).visibility).toBe("shareable");
  });

  it("private の QuizQuestion / QuizDeck は壊さない", () => {
    const question = normalizeQuizQuestion({
      id: "q_private",
      prompt: "問い",
      choices: [
        { id: "a", text: "A" },
        { id: "b", text: "B" }
      ],
      correctChoiceId: "a",
      visibility: "private",
      schemaVersion: QUIZ_QUESTION_SCHEMA_VERSION,
      createdAt: iso,
      updatedAt: iso
    });
    const deck = normalizeQuizDeck({
      id: "deck_private",
      title: "非共有集",
      questionIds: ["q_private"],
      visibility: "private",
      schemaVersion: QUIZ_DECK_SCHEMA_VERSION,
      createdAt: iso,
      updatedAt: iso
    });
    expect(question.visibility).toBe("private");
    expect(deck.visibility).toBe("private");
  });
});
