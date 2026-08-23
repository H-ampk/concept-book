import { describe, expect, it } from "vitest";
import { QUIZ_ATTEMPT_LOG_SCHEMA_VERSION, type QuizAttemptLog } from "../types/quiz";
import { planQuizAttemptLogImport } from "./normalizeQuizAttemptLog";

const log = (id: string): QuizAttemptLog => ({
  id,
  questionId: "q1",
  questionPromptSnapshot: "問い",
  selectedChoiceId: "c1",
  selectedChoiceTextSnapshot: "選択",
  correctChoiceId: "c2",
  correctChoiceTextSnapshot: "正解",
  correct: true,
  startedAt: "2026-01-01T00:00:00.000Z",
  answeredAt: "2026-01-01T00:00:01.000Z",
  timeMs: 10,
  schemaVersion: QUIZ_ATTEMPT_LOG_SCHEMA_VERSION
});

describe("planQuizAttemptLogImport", () => {
  it("同一 id のログが重複保存されない", () => {
    const { toSave, skipped } = planQuizAttemptLogImport(
      [log("log_b")],
      new Set(["log_a", "log_b"]),
      "merge"
    );
    expect(toSave.map((l) => l.id)).toEqual([]);
    expect(skipped).toBe(1);
  });

  it("merge で既存ログを維持しながら新規ログを追加できる", () => {
    const { toSave, skipped } = planQuizAttemptLogImport(
      [log("log_b"), log("log_c")],
      new Set(["log_a", "log_b"]),
      "merge"
    );
    expect(toSave.map((l) => l.id)).toEqual(["log_c"]);
    expect(skipped).toBe(1);
  });

  it("replace で既存ログがバックアップ内容に置き換わる", () => {
    const { toSave, skipped } = planQuizAttemptLogImport(
      [log("log_c")],
      new Set(["log_a", "log_b"]),
      "replace"
    );
    expect(toSave.map((l) => l.id)).toEqual(["log_c"]);
    expect(skipped).toBe(0);
  });

  it("バックアップ内部に同一 id が複数存在しても重複保存されない", () => {
    const { toSave, skipped } = planQuizAttemptLogImport(
      [log("log_a"), { ...log("log_a"), timeMs: 999 }],
      new Set(),
      "merge"
    );
    expect(toSave).toHaveLength(1);
    expect(toSave[0]?.id).toBe("log_a");
    expect(toSave[0]?.timeMs).toBe(10);
    expect(skipped).toBe(1);
  });
});
