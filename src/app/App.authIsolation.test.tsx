import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "../theme";

const { getAllConcepts, getQuizAttemptLogs } = vi.hoisted(() => ({
  getAllConcepts: vi.fn(async () => []),
  getQuizAttemptLogs: vi.fn(async () => [])
}));

vi.mock("../storage", () => {
  const methods: Record<string, unknown> = {
    getAllConcepts,
    getQuizAttemptLogs,
    updateConcept: vi.fn(async () => undefined),
    getMediaBlob: vi.fn(async () => undefined),
    getAllContextCards: vi.fn(async () => [])
  };
  const storage = new Proxy(methods, {
    get(target, prop) {
      if (prop in target) {
        return target[prop as string];
      }
      return vi.fn(async () => []);
    }
  });
  return {
    getStorage: () => storage,
    getContextStorage: () => storage
  };
});

import { App } from "./App";

describe("App auth isolation", () => {
  beforeEach(() => {
    getAllConcepts.mockResolvedValue([]);
    getQuizAttemptLogs.mockResolvedValue([]);
  });

  it("Supabase 未設定でも ConceptBook 本体と設定画面が crash しない", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <App />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "設定" })).toBeInTheDocument();
    });
    expect(screen.getByRole("heading", { name: "Concept Book App" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "設定" }));
    expect(screen.getByRole("heading", { name: "設定" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "アカウント / クラウド" })).toBeInTheDocument();
    expect(
      screen.getByText("クラウド認証はこの環境では設定されていません。ローカル機能はそのまま利用できます。")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ZIPを保存" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "JSONを保存" })).toBeInTheDocument();
  });
});
