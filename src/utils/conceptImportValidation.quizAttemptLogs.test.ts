import { describe, expect, it } from "vitest";
import { QUIZ_ATTEMPT_LOG_SCHEMA_VERSION, type QuizAttemptLog } from "../types/quiz";
import { validateBackupImportPayload } from "./conceptImportValidation";

const baseBackup = {
  concepts: [] as unknown[],
  contextCards: [],
  quizQuestions: [],
  quizDecks: []
};

const validLog = (id: string): QuizAttemptLog => ({
  id,
  questionId: "q1",
  questionPromptSnapshot: "問い",
  selectedChoiceId: "c1",
  selectedChoiceTextSnapshot: "選択",
  correctChoiceId: "c2",
  correctChoiceTextSnapshot: "正解",
  correct: false,
  startedAt: "2026-01-01T00:00:00.000Z",
  answeredAt: "2026-01-01T00:00:01.000Z",
  timeMs: 1000,
  schemaVersion: QUIZ_ATTEMPT_LOG_SCHEMA_VERSION
});

describe("validateBackupImportPayload quizAttemptLogs", () => {
  it("quizAttemptLogs を含むバックアップを validation できる", () => {
    const result = validateBackupImportPayload({
      ...baseBackup,
      quizAttemptLogs: [validLog("log_a")]
    });
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.quizAttemptLogs).toHaveLength(1);
    expect(result.quizAttemptLogParseSkipped).toBe(0);
  });

  it("有効な QuizAttemptLog が保持される", () => {
    const result = validateBackupImportPayload({
      ...baseBackup,
      quizAttemptLogs: [validLog("log_keep")]
    });
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.quizAttemptLogs[0]?.id).toBe("log_keep");
    expect(result.quizAttemptLogs[0]?.questionId).toBe("q1");
    expect(result.quizAttemptLogs[0]?.selectedChoiceId).toBe("c1");
    expect(result.quizAttemptLogs[0]?.correctChoiceId).toBe("c2");
    expect(result.quizAttemptLogs[0]?.schemaVersion).toBe(QUIZ_ATTEMPT_LOG_SCHEMA_VERSION);
  });

  it("不正な QuizAttemptLog だけ skip される", () => {
    const result = validateBackupImportPayload({
      ...baseBackup,
      quizAttemptLogs: [
        validLog("log_ok"),
        { questionId: "q1" },
        null,
        "bad"
      ]
    });
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.quizAttemptLogs.map((l) => l.id)).toEqual(["log_ok"]);
    expect(result.quizAttemptLogParseSkipped).toBe(3);
  });

  it("quizAttemptLogs が空配列のバックアップを正常に読み込める", () => {
    const result = validateBackupImportPayload({
      ...baseBackup,
      quizAttemptLogs: []
    });
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.quizAttemptLogs).toEqual([]);
    expect(result.quizAttemptLogParseSkipped).toBe(0);
  });

  it("quizAttemptLogs が存在しない旧バックアップを正常に読み込める", () => {
    const result = validateBackupImportPayload(baseBackup);
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.quizAttemptLogs).toEqual([]);
    expect(result.quizAttemptLogParseSkipped).toBe(0);
  });

  it("quizAttemptLogs が配列でない場合は空配列として扱う", () => {
    const result = validateBackupImportPayload({
      ...baseBackup,
      quizAttemptLogs: { id: "log_a" }
    });
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.quizAttemptLogs).toEqual([]);
    expect(result.quizAttemptLogParseSkipped).toBe(0);
  });

  it("legacy concept array 形式では学習ログは空になる", () => {
    const result = validateBackupImportPayload([
      {
        id: "c1",
        title: "概念",
        definition: "定義",
        myInterpretation: "",
        domainTags: [],
        researchTags: [],
        relatedIds: [],
        source: { book: "", page: "", author: null },
        notes: "",
        status: "draft",
        favorite: false,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z"
      }
    ]);
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.quizAttemptLogs).toEqual([]);
    expect(result.quizAttemptLogParseSkipped).toBe(0);
  });
});
