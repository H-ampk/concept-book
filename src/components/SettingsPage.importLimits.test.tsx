import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "../theme";
import { JSON_IMPORT_TOO_LARGE_MESSAGE } from "../utils/importResourceLimits";

const { importBackupData, getQuizAttemptLogs, getAllConcepts } = vi.hoisted(() => ({
  importBackupData: vi.fn(),
  getQuizAttemptLogs: vi.fn(async () => []),
  getAllConcepts: vi.fn(async () => [])
}));

vi.mock("../storage", () => ({
  getStorage: () => ({
    importBackupData,
    getQuizAttemptLogs,
    getAllConcepts
  })
}));

import { SettingsPage } from "./SettingsPage";

const importResult = {
  importedConcepts: 1,
  skippedConcepts: 0,
  importedContextCards: 0,
  skippedContextCards: 0,
  importedQuizQuestions: 0,
  skippedQuizQuestions: 0,
  importedQuizDecks: 0,
  skippedQuizDecks: 0,
  importedQuizAttemptLogs: 0,
  skippedQuizAttemptLogs: 0,
  importedResearchReports: 0,
  skippedResearchReports: 0
};

const renderPage = () => {
  const onImported = vi.fn(async () => undefined);
  const onChangeDomainColor = vi.fn();
  render(
    <ThemeProvider>
      <SettingsPage
        onImported={onImported}
        domainTags={[]}
        domainColorMap={{}}
        onChangeDomainColor={onChangeDomainColor}
      />
    </ThemeProvider>
  );
  return { onImported, onChangeDomainColor };
};

const jsonInput = (): HTMLInputElement => {
  const input = document.querySelector('input[accept="application/json"]');
  if (!(input instanceof HTMLInputElement)) {
    throw new Error("JSON input not found");
  }
  return input;
};

describe("SettingsPage JSON import limits", () => {
  beforeEach(() => {
    localStorage.clear();
    importBackupData.mockReset();
    importBackupData.mockResolvedValue(importResult);
  });

  it("正常なJSONを merge で取り込める", async () => {
    const user = userEvent.setup();
    const { onImported } = renderPage();
    const file = new File(['{"concepts":[]}'], "backup.json", { type: "application/json" });
    await user.upload(jsonInput(), file);
    expect(await screen.findByText(/インポート完了/)).toBeInTheDocument();
    expect(importBackupData).toHaveBeenCalledWith(expect.objectContaining({ concepts: [] }), "merge");
    expect(onImported).toHaveBeenCalledOnce();
  });

  it.each(["merge", "replace"] as const)(
    "%s では上限超過のJSONを読まず、既存の色設定も保存処理も変えない",
    async (mode) => {
      const user = userEvent.setup();
      localStorage.setItem("concept-book-domain-colors", JSON.stringify({ 心理学: "#112233" }));
      const { onImported, onChangeDomainColor } = renderPage();
      if (mode === "replace") {
        await user.selectOptions(screen.getByRole("combobox", { name: "取り込みモード" }), "replace");
      }
      const file = new File(["{}"], "backup.json", { type: "application/json" });
      Object.defineProperty(file, "size", { value: 50 * 1024 * 1024 + 1 });
      const text = vi.spyOn(file, "text");
      await user.upload(jsonInput(), file);

      expect(await screen.findByText(new RegExp(JSON_IMPORT_TOO_LARGE_MESSAGE))).toBeInTheDocument();
      if (mode === "replace") {
        expect(screen.getByText(/既存データは変更されませんでした/)).toBeInTheDocument();
      }
      expect(text).not.toHaveBeenCalled();
      expect(importBackupData).not.toHaveBeenCalled();
      expect(onImported).not.toHaveBeenCalled();
      expect(onChangeDomainColor).not.toHaveBeenCalled();
      expect(localStorage.getItem("concept-book-domain-colors")).toBe(JSON.stringify({ 心理学: "#112233" }));
    }
  );

  it.each(["merge", "replace"] as const)("%s では不正JSONでも保存しない", async (mode) => {
    const user = userEvent.setup();
    localStorage.setItem("concept-book-domain-colors", JSON.stringify({ 心理学: "#112233" }));
    const { onImported } = renderPage();
    if (mode === "replace") {
      await user.selectOptions(screen.getByRole("combobox", { name: "取り込みモード" }), "replace");
    }
    await user.upload(jsonInput(), new File(["{"], "bad.json", { type: "application/json" }));
    expect(await screen.findByText(/JSONの構文が不正です/)).toBeInTheDocument();
    if (mode === "replace") {
      expect(screen.getByText(/既存データは変更されませんでした/)).toBeInTheDocument();
    }
    expect(importBackupData).not.toHaveBeenCalled();
    expect(onImported).not.toHaveBeenCalled();

    await user.upload(jsonInput(), new File(['{"concepts":"nope"}'], "schema.json", { type: "application/json" }));
    expect(await screen.findByText(/インポートに失敗しました/)).toBeInTheDocument();
    expect(importBackupData).not.toHaveBeenCalled();
    expect(localStorage.getItem("concept-book-domain-colors")).toBe(JSON.stringify({ 心理学: "#112233" }));
  });
});
