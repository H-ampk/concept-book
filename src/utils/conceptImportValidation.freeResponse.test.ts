import { describe, expect, it } from "vitest";
import { QUIZ_ATTEMPT_LOG_SCHEMA_VERSION, QUIZ_QUESTION_SCHEMA_VERSION } from "../types/quiz";
import { normalizeQuizQuestion } from "../storage/indexeddb";
import {
  normalizeQuizQuestionsForBackupImport,
  validateBackupImportPayload
} from "./conceptImportValidation";
import { isPlayableQuestion } from "./quiz/buildQuizSession";
import { isValidImportedQuizAttemptLog, normalizeQuizAttemptLog } from "./normalizeQuizAttemptLog";

const iso = "2026-01-01T00:00:00.000Z";

describe("legacy QuizQuestion compatibility", () => {
  it("questionType が無い既存 multiple-choice を multiple-choice として正規化し playable にする", () => {
    const normalized = normalizeQuizQuestion({
      id: "q_legacy",
      prompt: "オペラント条件づけの提唱者は？",
      choices: [
        { id: "a", text: "スキナー" },
        { id: "b", text: "パブロフ" }
      ],
      correctChoiceId: "a",
      visibility: "private",
      schemaVersion: 1,
      createdAt: iso,
      updatedAt: iso
    });
    expect(normalized.questionType).toBe("multiple-choice");
    expect(isPlayableQuestion(normalized)).toBe(true);

    const { questions, skipped } = normalizeQuizQuestionsForBackupImport([
      {
        id: "q_legacy_import",
        prompt: "問い",
        choices: [
          { id: "a", text: "A" },
          { id: "b", text: "B" }
        ],
        correctChoiceId: "a",
        visibility: "private",
        schemaVersion: 1,
        createdAt: iso,
        updatedAt: iso
      }
    ]);
    expect(skipped).toBe(0);
    expect(questions[0]?.questionType).toBe("multiple-choice");
  });
});

describe("free-response QuizQuestion normalize", () => {
  it("choices 空・correctChoiceId 空でも保存形として読める", () => {
    const raw = {
      id: "q_fr",
      questionType: "free-response",
      prompt: "教師あり学習とは何ですか？",
      choices: [],
      correctChoiceId: "",
      referenceAnswer: "ラベル付きデータで学習する手法",
      visibility: "private",
      schemaVersion: QUIZ_QUESTION_SCHEMA_VERSION,
      createdAt: iso,
      updatedAt: iso
    };
    const normalized = normalizeQuizQuestion(raw);
    expect(normalized.questionType).toBe("free-response");
    expect(normalized.choices).toEqual([]);
    expect(normalized.correctChoiceId).toBe("");
    expect(normalized.referenceAnswer).toBe("ラベル付きデータで学習する手法");

    const { questions, skipped } = normalizeQuizQuestionsForBackupImport([raw]);
    expect(skipped).toBe(0);
    expect(questions[0]?.referenceAnswer).toBe("ラベル付きデータで学習する手法");
  });
});

describe("legacy and free-response QuizAttemptLog", () => {
  it("questionType が無い既存ログを multiple-choice として読める", () => {
    const normalized = normalizeQuizAttemptLog({
      id: "log_legacy",
      questionId: "q1",
      questionPromptSnapshot: "問い",
      selectedChoiceId: "c1",
      selectedChoiceTextSnapshot: "選択",
      correctChoiceId: "c2",
      correctChoiceTextSnapshot: "正解",
      correct: true,
      startedAt: iso,
      answeredAt: iso,
      timeMs: 10,
      schemaVersion: 1
    });
    expect(normalized.questionType).toBe("multiple-choice");
    expect(isValidImportedQuizAttemptLog(normalized)).toBe(true);
  });

  it("free-response ログは choice ID が空でも import できる", () => {
    const normalized = normalizeQuizAttemptLog({
      id: "log_fr",
      questionId: "q_fr",
      questionType: "free-response",
      questionPromptSnapshot: "問い",
      selectedChoiceId: "",
      selectedChoiceTextSnapshot: "",
      correctChoiceId: "",
      correctChoiceTextSnapshot: "",
      userAnswerTextSnapshot: "自分の答え",
      referenceAnswerSnapshot: "模範",
      selfEvaluation: "partial",
      correct: false,
      startedAt: iso,
      answeredAt: iso,
      timeMs: 20,
      schemaVersion: QUIZ_ATTEMPT_LOG_SCHEMA_VERSION
    });
    expect(isValidImportedQuizAttemptLog(normalized)).toBe(true);
    expect(normalized.selfEvaluation).toBe("partial");
    expect(normalized.correct).toBe(false);
  });
});

describe("free-response import/export round-trip", () => {
  it("JSON backup で Question / AttemptLog の新フィールドが消えない", () => {
    const result = validateBackupImportPayload({
      concepts: [],
      contextCards: [],
      quizQuestions: [
        {
          id: "q_fr",
          questionType: "free-response",
          prompt: "教師あり学習とは？",
          choices: [],
          correctChoiceId: "",
          referenceAnswer: "ラベル付きデータで学習する",
          visibility: "private",
          schemaVersion: QUIZ_QUESTION_SCHEMA_VERSION,
          createdAt: iso,
          updatedAt: iso
        }
      ],
      quizDecks: [],
      quizAttemptLogs: [
        {
          id: "log_fr",
          questionId: "q_fr",
          questionType: "free-response",
          questionPromptSnapshot: "教師あり学習とは？",
          selectedChoiceId: "",
          selectedChoiceTextSnapshot: "",
          correctChoiceId: "",
          correctChoiceTextSnapshot: "",
          userAnswerTextSnapshot: "ラベルで学ぶ",
          referenceAnswerSnapshot: "ラベル付きデータで学習する",
          selfEvaluation: "correct",
          correct: true,
          startedAt: iso,
          answeredAt: iso,
          timeMs: 30,
          schemaVersion: QUIZ_ATTEMPT_LOG_SCHEMA_VERSION
        }
      ]
    });
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.quizQuestions[0]?.questionType).toBe("free-response");
    expect(result.quizQuestions[0]?.referenceAnswer).toBe("ラベル付きデータで学習する");
    expect(result.quizAttemptLogs[0]?.questionType).toBe("free-response");
    expect(result.quizAttemptLogs[0]?.userAnswerTextSnapshot).toBe("ラベルで学ぶ");
    expect(result.quizAttemptLogs[0]?.referenceAnswerSnapshot).toBe("ラベル付きデータで学習する");
    expect(result.quizAttemptLogs[0]?.selfEvaluation).toBe("correct");
  });
});
