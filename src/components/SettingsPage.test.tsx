import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "../theme";

const { getQuizAttemptLogs, getAllConcepts } = vi.hoisted(() => ({
  getQuizAttemptLogs: vi.fn(async () => []),
  getAllConcepts: vi.fn(async () => [])
}));

vi.mock("../storage", () => ({
  getStorage: () => ({
    getQuizAttemptLogs,
    getAllConcepts
  })
}));

import { SettingsPage } from "./SettingsPage";

describe("SettingsPage AI section", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("AI機能セクションを表示し、ページ表示だけではfetchしない", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(
      <ThemeProvider>
        <SettingsPage
          onImported={vi.fn(async () => undefined)}
          domainTags={[]}
          domainColorMap={{}}
          onChangeDomainColor={vi.fn()}
        />
      </ThemeProvider>
    );
    expect(screen.getByRole("heading", { name: "AI機能" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "接続確認" })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
