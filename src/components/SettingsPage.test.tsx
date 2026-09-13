import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../auth/AuthProvider";
import { FakeAuthClient } from "../auth/fakeAuthClient";
import { USER_FACING_AUTH_ERROR } from "../auth/userFacingAuthError";
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

const renderSettings = (client?: FakeAuthClient) =>
  render(
    <ThemeProvider>
      {client ? (
        <AuthProvider client={client}>
          <SettingsPage
            onImported={vi.fn(async () => undefined)}
            domainTags={[]}
            domainColorMap={{}}
            onChangeDomainColor={vi.fn()}
          />
        </AuthProvider>
      ) : (
        <SettingsPage
          onImported={vi.fn(async () => undefined)}
          domainTags={[]}
          domainColorMap={{}}
          onChangeDomainColor={vi.fn()}
        />
      )}
    </ThemeProvider>
  );

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
    renderSettings();
    expect(screen.getByRole("heading", { name: "AI機能" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "接続確認" })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("SettingsPage local-first with auth states", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const expectLocalSettingsSurfaces = () => {
    expect(screen.getByRole("heading", { name: "設定" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "アカウント / クラウド" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "バックアップ・復元" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ZIPを保存" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "JSONを保存" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "AI機能" })).toBeInTheDocument();
  };

  it("Provider 無し（unconfigured）でも Settings / backup UI を描画する", () => {
    renderSettings();
    expectLocalSettingsSurfaces();
    expect(
      screen.getByText("クラウド認証はこの環境では設定されていません。ローカル機能はそのまま利用できます。")
    ).toBeInTheDocument();
  });

  it("anonymous でも Settings / backup UI を描画する", () => {
    renderSettings(new FakeAuthClient({ status: "anonymous", configured: true }));
    expectLocalSettingsSurfaces();
    expect(screen.getByText("未ログイン")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ログインリンクを送信" })).toBeInTheDocument();
  });

  it("auth error でも Settings / backup UI を描画する", () => {
    renderSettings(
      new FakeAuthClient({
        status: "error",
        configured: true,
        error: USER_FACING_AUTH_ERROR
      })
    );
    expectLocalSettingsSurfaces();
    expect(screen.getByText(USER_FACING_AUTH_ERROR)).toBeInTheDocument();
  });
});
