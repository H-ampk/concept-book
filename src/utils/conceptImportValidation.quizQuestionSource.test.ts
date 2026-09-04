import { describe, expect, it } from "vitest";
import { applyBackupExportOptions } from "../storage/backupExport";
import type { BackupExportData } from "../storage/types";
import type { Concept } from "../types/concept";
import type { ContextCard } from "../types/contextCard";
import { QUIZ_QUESTION_SCHEMA_VERSION, type QuizQuestion } from "../types/quiz";
import {
  normalizeQuizQuestionsForBackupImport,
  quizQuestionSchema,
  validateBackupImportPayload
} from "./conceptImportValidation";

const iso = "2026-01-01T00:00:00.000Z";

const baseQuestion = (): QuizQuestion => ({
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
  updatedAt: iso
});

const backupWithQuestions = (quizQuestions: unknown[]) => ({
  concepts: [] as unknown[],
  contextCards: [],
  quizQuestions,
  quizDecks: []
});

describe("normalizeQuizQuestionsForBackupImport QuizQuestion.source", () => {
  it("contextualConceptCard の source を保持する", () => {
    const q = {
      ...baseQuestion(),
      source: {
        type: "contextualConceptCard",
        sourceId: "ccc_1",
        sourceTitle: "文脈別カード"
      }
    };
    const { questions, skipped } = normalizeQuizQuestionsForBackupImport([q]);
    expect(skipped).toBe(0);
    expect(questions[0]?.source).toEqual({
      type: "contextualConceptCard",
      sourceId: "ccc_1",
      sourceTitle: "文脈別カード"
    });
  });

  it("contextCard の source を保持する", () => {
    const q = {
      ...baseQuestion(),
      source: {
        type: "contextCard",
        sourceId: "cc_1",
        sourceTitle: "文脈カード"
      }
    };
    const { questions } = normalizeQuizQuestionsForBackupImport([q]);
    expect(questions[0]?.source).toEqual({
      type: "contextCard",
      sourceId: "cc_1",
      sourceTitle: "文脈カード"
    });
  });

  it("fieldName ありを保持する", () => {
    const q = {
      ...baseQuestion(),
      source: {
        type: "contextualConceptCard",
        sourceId: "ccc_1",
        sourceTitle: "文脈別カード",
        fieldName: "心理学"
      }
    };
    const { questions } = normalizeQuizQuestionsForBackupImport([q]);
    expect(questions[0]?.source?.fieldName).toBe("心理学");
  });

  it("fieldName なしはそのまま保持する", () => {
    const q = {
      ...baseQuestion(),
      source: {
        type: "contextCard",
        sourceId: "cc_1",
        sourceTitle: "文脈カード"
      }
    };
    const { questions } = normalizeQuizQuestionsForBackupImport([q]);
    expect(questions[0]?.source).toEqual({
      type: "contextCard",
      sourceId: "cc_1",
      sourceTitle: "文脈カード"
    });
    expect(questions[0]?.source).not.toHaveProperty("fieldName");
  });

  it("source なし旧形式データを読み込める", () => {
    const { questions, skipped } = normalizeQuizQuestionsForBackupImport([baseQuestion()]);
    expect(skipped).toBe(0);
    expect(questions).toHaveLength(1);
    expect(questions[0]?.source).toBeUndefined();
  });

  it("不正な source.type では source のみ落として本体は復元する", () => {
    const q = {
      ...baseQuestion(),
      source: {
        type: "unknownType",
        sourceId: "ccc_1",
        sourceTitle: "文脈別カード"
      }
    };
    const { questions, skipped } = normalizeQuizQuestionsForBackupImport([q]);
    expect(skipped).toBe(0);
    expect(questions).toHaveLength(1);
    expect(questions[0]?.id).toBe("question_1");
    expect(questions[0]?.source).toBeUndefined();
  });

  it("空の sourceId では source のみ落とす", () => {
    const q = {
      ...baseQuestion(),
      source: {
        type: "contextualConceptCard",
        sourceId: "  ",
        sourceTitle: "文脈別カード"
      }
    };
    const { questions, skipped } = normalizeQuizQuestionsForBackupImport([q]);
    expect(skipped).toBe(0);
    expect(questions[0]?.source).toBeUndefined();
  });

  it("空の sourceTitle では source のみ落とす", () => {
    const q = {
      ...baseQuestion(),
      source: {
        type: "contextCard",
        sourceId: "cc_1",
        sourceTitle: ""
      }
    };
    const { questions, skipped } = normalizeQuizQuestionsForBackupImport([q]);
    expect(skipped).toBe(0);
    expect(questions[0]?.source).toBeUndefined();
  });

  it("不正な fieldName は省略し source 本体は保持する", () => {
    const q = {
      ...baseQuestion(),
      source: {
        type: "contextualConceptCard",
        sourceId: "ccc_1",
        sourceTitle: "文脈別カード",
        fieldName: 123
      }
    };
    const { questions, skipped } = normalizeQuizQuestionsForBackupImport([q]);
    expect(skipped).toBe(0);
    expect(questions[0]?.source).toEqual({
      type: "contextualConceptCard",
      sourceId: "ccc_1",
      sourceTitle: "文脈別カード"
    });
    expect(questions[0]?.source).not.toHaveProperty("fieldName");
  });
});

describe("JSON backup round-trip QuizQuestion.source", () => {
  it("export JSON → validation で source が一致する", () => {
    const original: QuizQuestion = {
      ...baseQuestion(),
      source: {
        type: "contextualConceptCard",
        sourceId: "ccc_rt",
        sourceTitle: "ラウンドトリップ",
        fieldName: "情報理論"
      }
    };
    const exported = JSON.parse(
      JSON.stringify(
        applyBackupExportOptions({
          concepts: [] as Concept[],
          contextCards: [] as ContextCard[],
          quizQuestions: [original],
          quizDecks: [],
          quizAttemptLogs: []
        } satisfies BackupExportData)
      )
    ) as unknown;
    const result = validateBackupImportPayload(exported);
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.quizQuestions).toHaveLength(1);
    expect(result.quizQuestions[0]?.source).toEqual(original.source);
  });

  it("source なし旧 JSON を受理する", () => {
    const exported = JSON.parse(JSON.stringify(backupWithQuestions([baseQuestion()]))) as unknown;
    const result = validateBackupImportPayload(exported);
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.quizQuestions[0]?.source).toBeUndefined();
  });

  it("quizQuestionSchema は source なしを必須化しない", () => {
    const parsed = quizQuestionSchema.safeParse(baseQuestion());
    expect(parsed.success).toBe(true);
  });
});
