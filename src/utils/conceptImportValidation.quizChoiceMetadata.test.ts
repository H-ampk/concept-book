import { describe, expect, it } from "vitest";
import { QUIZ_QUESTION_SCHEMA_VERSION } from "../types/quiz";
import { applyBackupExportOptions } from "../storage/backupExport";
import type { BackupExportData } from "../storage/types";
import type { Concept } from "../types/concept";
import type { ContextCard } from "../types/contextCard";
import type { QuizQuestion } from "../types/quiz";
import { validateBackupImportPayload } from "./conceptImportValidation";

const iso = "2026-01-01T00:00:00.000Z";

const metadataChoice = {
  id: "a",
  text: "オペラント条件づけ",
  displayText: "○○条件づけ",
  linkedConceptId: "c_operant",
  sourceConceptId: "c_source",
  contextDefinitionId: "ctx_1",
  sourceStrategy: "same-context" as const
};

const question: QuizQuestion = {
  id: "question_1",
  prompt: "問い",
  choices: [metadataChoice, { id: "b", text: "古典的条件づけ" }],
  correctChoiceId: "a",
  visibility: "private",
  schemaVersion: QUIZ_QUESTION_SCHEMA_VERSION,
  createdAt: iso,
  updatedAt: iso
};

describe("JSON backup QuizChoice metadata", () => {
  it("validateBackupImportPayload は Choice metadata を保持する", () => {
    const exported = JSON.parse(
      JSON.stringify(
        applyBackupExportOptions({
          concepts: [] as Concept[],
          contextCards: [] as ContextCard[],
          quizQuestions: [question],
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
    const choice = result.quizQuestions[0]?.choices.find((c) => c.id === "a");
    expect(choice).toEqual(metadataChoice);
  });
});
