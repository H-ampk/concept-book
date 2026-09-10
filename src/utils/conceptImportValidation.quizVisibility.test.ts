import { describe, expect, it } from "vitest";
import { applyBackupExportOptions } from "../storage/backupExport";
import type { BackupExportData } from "../storage/types";
import type { Concept } from "../types/concept";
import type { ContextCard } from "../types/contextCard";
import {
  QUIZ_DECK_SCHEMA_VERSION,
  QUIZ_QUESTION_SCHEMA_VERSION,
  type QuizDeck,
  type QuizQuestion
} from "../types/quiz";
import { buildConceptBookZip, parseConceptBookZip } from "./conceptBookZip";
import {
  normalizeQuizDecksForBackupImport,
  normalizeQuizQuestionsForBackupImport,
  quizVisibilitySchema,
  validateBackupImportPayload
} from "./conceptImportValidation";

const iso = "2026-01-01T00:00:00.000Z";

const baseQuestion = (overrides: Record<string, unknown> = {}) => ({
  id: "question_1",
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

const baseDeck = (overrides: Record<string, unknown> = {}) => ({
  id: "deck_1",
  title: "クイズ集",
  questionIds: ["question_1"],
  visibility: "private",
  schemaVersion: QUIZ_DECK_SCHEMA_VERSION,
  createdAt: iso,
  updatedAt: iso,
  ...overrides
});

describe("backup import QuizVisibility", () => {
  it("旧 JSON の visibility public を QuizQuestion として import すると shareable になる", () => {
    const { questions, skipped } = normalizeQuizQuestionsForBackupImport([
      baseQuestion({ visibility: "public" })
    ]);
    expect(skipped).toBe(0);
    expect(questions).toHaveLength(1);
    expect(questions[0]?.visibility).toBe("shareable");
  });

  it("旧 JSON の visibility public を QuizDeck として import すると shareable になる", () => {
    const { decks, skipped } = normalizeQuizDecksForBackupImport([
      baseDeck({ visibility: "public" })
    ]);
    expect(skipped).toBe(0);
    expect(decks).toHaveLength(1);
    expect(decks[0]?.visibility).toBe("shareable");
  });

  it("visibility 欠落の旧 QuizQuestion は private になる", () => {
    const raw = baseQuestion();
    delete (raw as { visibility?: unknown }).visibility;
    const { questions, skipped } = normalizeQuizQuestionsForBackupImport([raw]);
    expect(skipped).toBe(0);
    expect(questions[0]?.visibility).toBe("private");
  });

  it("visibility 欠落の旧 QuizDeck は private になる", () => {
    const raw = baseDeck();
    delete (raw as { visibility?: unknown }).visibility;
    const { decks, skipped } = normalizeQuizDecksForBackupImport([raw]);
    expect(skipped).toBe(0);
    expect(decks[0]?.visibility).toBe("private");
  });

  it("canonical shareable の QuizQuestion / QuizDeck を import できる", () => {
    const { questions } = normalizeQuizQuestionsForBackupImport([
      baseQuestion({ visibility: "shareable" })
    ]);
    const { decks } = normalizeQuizDecksForBackupImport([
      baseDeck({ visibility: "shareable" })
    ]);
    expect(questions[0]?.visibility).toBe("shareable");
    expect(decks[0]?.visibility).toBe("shareable");
  });

  it("private の既存 backup は壊さない", () => {
    const { questions } = normalizeQuizQuestionsForBackupImport([baseQuestion()]);
    const { decks } = normalizeQuizDecksForBackupImport([baseDeck()]);
    expect(questions[0]?.visibility).toBe("private");
    expect(decks[0]?.visibility).toBe("private");
  });

  it("validateBackupImportPayload は旧 public を受理し shareable にする", () => {
    const result = validateBackupImportPayload({
      concepts: [],
      contextCards: [],
      quizQuestions: [baseQuestion({ visibility: "public" })],
      quizDecks: [baseDeck({ visibility: "public" })]
    });
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.quizQuestions[0]?.visibility).toBe("shareable");
    expect(result.quizDecks[0]?.visibility).toBe("shareable");
  });

  it("canonical schema は private | shareable である", () => {
    expect(quizVisibilitySchema.safeParse("private").success).toBe(true);
    expect(quizVisibilitySchema.safeParse("shareable").success).toBe(true);
    expect(quizVisibilitySchema.safeParse("public").success).toBe(false);
  });
});

describe("backup export QuizVisibility", () => {
  it("shareable の QuizQuestion / QuizDeck を Export すると visibility shareable を出力する", () => {
    const question: QuizQuestion = {
      ...baseQuestion({ visibility: "shareable" })
    } as QuizQuestion;
    const deck: QuizDeck = {
      ...baseDeck({ visibility: "shareable" })
    } as QuizDeck;
    const exported = JSON.parse(
      JSON.stringify(
        applyBackupExportOptions({
          concepts: [] as Concept[],
          contextCards: [] as ContextCard[],
          quizQuestions: [question],
          quizDecks: [deck],
          quizAttemptLogs: []
        } satisfies BackupExportData)
      )
    ) as {
      quizQuestions: { visibility: string }[];
      quizDecks: { visibility: string }[];
    };
    expect(exported.quizQuestions[0]?.visibility).toBe("shareable");
    expect(exported.quizDecks[0]?.visibility).toBe("shareable");
    expect(JSON.stringify(exported)).not.toContain('"visibility":"public"');
  });
});

describe("ZIP backup QuizVisibility", () => {
  it("旧 ZIP の visibility public を import すると shareable になる", () => {
    const json = JSON.stringify({
      concepts: [],
      contextCards: [],
      quizQuestions: [baseQuestion({ visibility: "public" })],
      quizDecks: [baseDeck({ visibility: "public" })]
    });
    const zipped = buildConceptBookZip(json, []);
    const parsed = parseConceptBookZip(
      zipped.buffer.slice(zipped.byteOffset, zipped.byteOffset + zipped.byteLength)
    );
    const result = validateBackupImportPayload(JSON.parse(parsed.conceptsText));
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.quizQuestions[0]?.visibility).toBe("shareable");
    expect(result.quizDecks[0]?.visibility).toBe("shareable");
  });

  it("visibility 欠落の旧 ZIP は private になる", () => {
    const question = baseQuestion();
    delete (question as { visibility?: unknown }).visibility;
    const deck = baseDeck();
    delete (deck as { visibility?: unknown }).visibility;
    const json = JSON.stringify({
      concepts: [],
      contextCards: [],
      quizQuestions: [question],
      quizDecks: [deck]
    });
    const zipped = buildConceptBookZip(json, []);
    const parsed = parseConceptBookZip(
      zipped.buffer.slice(zipped.byteOffset, zipped.byteOffset + zipped.byteLength)
    );
    const result = validateBackupImportPayload(JSON.parse(parsed.conceptsText));
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.quizQuestions[0]?.visibility).toBe("private");
    expect(result.quizDecks[0]?.visibility).toBe("private");
  });
});
