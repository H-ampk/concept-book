import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

const { getAllConcepts } = vi.hoisted(() => ({
  getAllConcepts: vi.fn()
}));

vi.mock("../storage", () => {
  const methods: Record<string, unknown> = {
    getAllConcepts,
    getQuizAttemptLogs: vi.fn(async () => []),
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

describe("App getting started guide", () => {
  beforeEach(() => {
    getAllConcepts.mockReset();
    getAllConcepts.mockResolvedValue([]);
  });

  it("ヘッダーからガイドを開き、Concept 作成と既存画面へ移動できる", async () => {
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId("concept-empty-none")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "ConceptBook の使い方" }));
    expect(screen.getByRole("heading", { name: "ConceptBook の使い方" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Concept を追加する" }));
    expect(screen.getByRole("heading", { name: "新しい概念" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "キャンセル" }));

    await user.click(screen.getByRole("button", { name: "クイズを作る" }));
    expect(screen.getByRole("heading", { name: /クイズ作成/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "ConceptBook の使い方" }));
    await user.click(screen.getByRole("button", { name: "クイズで学習する" }));
    expect(await screen.findByRole("heading", { name: /クイズで学習|クイズ学習/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "ConceptBook の使い方" }));
    await user.click(screen.getByRole("button", { name: "学習ログを見る" }));
    expect(screen.getByRole("heading", { level: 1, name: "学習ログ" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "ConceptBook の使い方" }));
    await user.click(screen.getByRole("button", { name: "Data Lab を見る" }));
    expect(screen.getByRole("heading", { name: /Data Lab/ })).toBeInTheDocument();
  });
});
