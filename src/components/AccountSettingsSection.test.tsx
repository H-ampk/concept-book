import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { AuthProvider } from "../auth/AuthProvider";
import { FakeAuthClient } from "../auth/fakeAuthClient";
import { USER_FACING_AUTH_ERROR, USER_FACING_AUTH_ERROR_LOCAL_NOTE } from "../auth/userFacingAuthError";
import { AccountSettingsSection } from "./AccountSettingsSection";

const renderAccount = (client: FakeAuthClient) =>
  render(
    <AuthProvider client={client}>
      <AccountSettingsSection />
      <p>local-app-still-available</p>
    </AuthProvider>
  );

describe("AccountSettingsSection", () => {
  it("未ログイン表示とメール入力ができる", async () => {
    const user = userEvent.setup();
    const client = new FakeAuthClient({ status: "anonymous", configured: true });
    renderAccount(client);

    expect(screen.getByRole("heading", { name: "アカウント / クラウド" })).toBeInTheDocument();
    expect(screen.getByText("未ログイン")).toBeInTheDocument();
    expect(
      screen.getByText("ログインしなくても ConceptBook のローカル機能は利用できます。")
    ).toBeInTheDocument();
    expect(
      screen.getByText("ログインすると、今後クラウド同期や公開機能を利用できます。")
    ).toBeInTheDocument();
    expect(screen.queryByText(/現在すぐ同期/)).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("メールアドレス"), "reader@example.com");
    await user.click(screen.getByRole("button", { name: "ログインリンクを送信" }));
    expect(client.signInWithEmailCalls).toEqual(["reader@example.com"]);
    await waitFor(() => {
      expect(screen.getByText("ログイン用メールを送信しました。")).toBeInTheDocument();
    });
    expect(screen.getByText("メール内のリンクから ConceptBook に戻ってください。")).toBeInTheDocument();
    expect(screen.getByText("local-app-still-available")).toBeInTheDocument();
  });

  it("送信中はボタン連打を防ぐ", async () => {
    const user = userEvent.setup();
    let release: () => void = () => undefined;
    const client = new FakeAuthClient({ status: "anonymous", configured: true });
    client.signInWithEmail = () =>
      new Promise((resolve) => {
        release = () => resolve();
      });

    renderAccount(client);
    await user.type(screen.getByLabelText("メールアドレス"), "reader@example.com");
    await user.click(screen.getByRole("button", { name: "ログインリンクを送信" }));
    expect(screen.getByRole("button", { name: "ログインリンクを送信中" })).toBeDisabled();
    expect(screen.getByLabelText("メールアドレス")).toBeDisabled();
    release();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "ログインリンクを送信" })).toBeEnabled();
    });
  });

  it("認証初期化中は本体を塞がず、送信を無効化する", () => {
    const client = new FakeAuthClient({ configured: true, emitInitial: false });
    renderAccount(client);
    expect(screen.getByText("認証状態を確認しています。")).toBeInTheDocument();
    expect(screen.getByText("local-app-still-available")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "ログインリンクを送信" })).not.toBeInTheDocument();
  });

  it("認証エラーを表示してもローカル利用可能のまま", () => {
    const client = new FakeAuthClient({
      status: "error",
      configured: true,
      error: USER_FACING_AUTH_ERROR
    });
    renderAccount(client);
    expect(screen.getByText(USER_FACING_AUTH_ERROR)).toBeInTheDocument();
    expect(screen.getByText(USER_FACING_AUTH_ERROR_LOCAL_NOTE)).toBeInTheDocument();
    expect(screen.getByText("local-app-still-available")).toBeInTheDocument();
  });

  it("ログイン済み表示とログアウト", async () => {
    const user = userEvent.setup();
    const client = new FakeAuthClient({
      status: "authenticated",
      configured: true,
      user: {
        id: "stable-user",
        email: "reader@example.com",
        createdAt: "2026-01-01T00:00:00.000Z"
      }
    });
    renderAccount(client);

    expect(screen.getByText("ログイン済み")).toBeInTheDocument();
    expect(screen.getByText("メールアドレス")).toBeInTheDocument();
    expect(screen.getByText("reader@example.com")).toBeInTheDocument();
    expect(screen.queryByText("stable-user")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "ログアウト" }));
    expect(client.signOutCalls).toBe(1);
    await waitFor(() => {
      expect(screen.getByText("未ログイン")).toBeInTheDocument();
    });
  });

  it("未設定環境では認証 UI のみ unavailable", () => {
    const client = new FakeAuthClient({ status: "anonymous", configured: false });
    renderAccount(client);
    expect(
      screen.getByText("クラウド認証はこの環境では設定されていません。ローカル機能はそのまま利用できます。")
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "ログインリンクを送信" })).not.toBeInTheDocument();
    expect(screen.getByText("local-app-still-available")).toBeInTheDocument();
  });
});
