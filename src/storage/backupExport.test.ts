import { describe, expect, it } from "vitest";
import type { Concept } from "../types/concept";
import type { ContextCard } from "../types/contextCard";
import type { QuizAttemptLog, QuizDeck, QuizQuestion } from "../types/quiz";
import { applyBackupExportOptions } from "./backupExport";
import type { BackupExportData } from "./types";

const concept = { id: "c1", title: "概念" } as Concept;
const contextCard = { id: "cc1" } as ContextCard;
const quizQuestion = { id: "q1" } as QuizQuestion;
const quizDeck = { id: "d1" } as QuizDeck;
const quizAttemptLog = { id: "log1" } as QuizAttemptLog;

const sampleData = (): BackupExportData => ({
  concepts: [concept],
  contextCards: [contextCard],
  quizQuestions: [quizQuestion],
  quizDecks: [quizDeck],
  quizAttemptLogs: [quizAttemptLog]
});

describe("applyBackupExportOptions / exportBackupData 相当", () => {
  it("オプション省略時は学習ログを含む", () => {
    const data = sampleData();
    const result = applyBackupExportOptions(data);
    expect(result.quizAttemptLogs).toEqual([quizAttemptLog]);
  });

  it("includeQuizAttemptLogs: true では学習ログを含む", () => {
    const result = applyBackupExportOptions(sampleData(), { includeQuizAttemptLogs: true });
    expect(result.quizAttemptLogs).toEqual([quizAttemptLog]);
  });

  it("includeQuizAttemptLogs: false では quizAttemptLogs が []", () => {
    const result = applyBackupExportOptions(sampleData(), { includeQuizAttemptLogs: false });
    expect(result.quizAttemptLogs).toEqual([]);
  });

  it("学習ログ除外時も concepts / contextCards / quizQuestions / quizDecks は維持される", () => {
    const data = sampleData();
    const result = applyBackupExportOptions(data, { includeQuizAttemptLogs: false });
    expect(result.concepts).toEqual(data.concepts);
    expect(result.contextCards).toEqual(data.contextCards);
    expect(result.quizQuestions).toEqual(data.quizQuestions);
    expect(result.quizDecks).toEqual(data.quizDecks);
  });
});
