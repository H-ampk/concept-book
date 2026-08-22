import { describe, expect, it } from "vitest";
import { validateBackupImportPayload } from "./conceptImportValidation";

const baseBackup = {
  concepts: [] as unknown[],
  contextCards: [],
  quizQuestions: [],
  quizDecks: []
};

describe("validateBackupImportPayload domainColors", () => {
  it("domainColors付きバックアップを正常に読み込める", () => {
    const result = validateBackupImportPayload({
      ...baseBackup,
      domainColors: { 人工知能: "#2563EB", 哲学: "#7C3AED" }
    });
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.concepts).toHaveLength(0);
    expect(result.domainColors).toEqual({ 人工知能: "#2563EB", 哲学: "#7C3AED" });
  });

  it("domainColorsなしの旧バックアップを正常に読み込める", () => {
    const result = validateBackupImportPayload(baseBackup);
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.concepts).toHaveLength(0);
    expect(result.domainColors).toBeUndefined();
  });

  it("不正なカラー値があってもバックアップ全体は成功し、不正entryは除外する", () => {
    const result = validateBackupImportPayload({
      ...baseBackup,
      domainColors: { 人工知能: "#2563EB", bad: "red" }
    });
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.domainColors).toEqual({ 人工知能: "#2563EB" });
  });

  it("domainColorsがオブジェクトでない場合はカラー復元対象にしない", () => {
    const result = validateBackupImportPayload({
      ...baseBackup,
      domainColors: "#2563EB"
    });
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.domainColors).toBeUndefined();
  });
});
