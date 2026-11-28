import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AI_SETTINGS_STORAGE_KEY,
  DEFAULT_AI_SETTINGS,
  OLLAMA_EXTERNAL_CONSENT_STORAGE_KEY
} from "../features/ai";
import { AISettingsSection } from "./AISettingsSection";

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });

describe("AISettingsSection", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("AI enable toggle を保存する", async () => {
    const user = userEvent.setup();
    render(<AISettingsSection />);
    await user.click(screen.getByRole("checkbox", { name: /ローカルAIを有効にする/ }));
    expect(JSON.parse(localStorage.getItem(AI_SETTINGS_STORAGE_KEY) ?? "{}")).toMatchObject({ enabled: true });
  });

  it("Base URL / 生成モデル / Embeddingモデルを変更できる", async () => {
    const user = userEvent.setup();
    render(<AISettingsSection />);
    await user.clear(screen.getByLabelText("Ollama URL"));
    await user.type(screen.getByLabelText("Ollama URL"), "http://127.0.0.1:11434");
    await user.clear(screen.getByLabelText("生成モデル"));
    await user.type(screen.getByLabelText("生成モデル"), "qwen3:8b");
    await user.clear(screen.getByLabelText("Embeddingモデル"));
    await user.type(screen.getByLabelText("Embeddingモデル"), "nomic-embed-text");
    expect(JSON.parse(localStorage.getItem(AI_SETTINGS_STORAGE_KEY) ?? "{}")).toMatchObject({
      baseUrl: "http://127.0.0.1:11434",
      textModel: "qwen3:8b",
      embeddingModel: "nomic-embed-text"
    });
  });

  it("ページ表示だけではfetchされない", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<AISettingsSection />);
    expect(screen.getByRole("button", { name: "接続確認" })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("接続確認を押すとfetchされ、成功時にモデル一覧を表示する", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/version")) {
        return jsonResponse({ version: "0.11.4" });
      }
      if (url.endsWith("/api/tags")) {
        return jsonResponse({
          models: [{ name: "qwen3:4b" }, { name: "bge-m3:latest" }]
        });
      }
      return jsonResponse({ error: "not found" }, 404);
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<AISettingsSection />);
    expect(fetchMock).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "接続確認" }));
    await waitFor(() => {
      expect(screen.getByText(/Ollamaに接続できました/)).toBeInTheDocument();
    });
    expect(screen.getByText(/Version 0.11.4/)).toBeInTheDocument();
    expect(screen.getByText("qwen3:4b")).toBeInTheDocument();
    expect(screen.getByText("bge-m3:latest")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalled();
    expect(fetchMock.mock.calls.map((call) => String(call[0]))).toEqual([
      `${DEFAULT_AI_SETTINGS.baseUrl}/api/version`,
      `${DEFAULT_AI_SETTINGS.baseUrl}/api/tags`
    ]);
  });

  it("接続成功時に空のモデル一覧を表示する", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/api/version")) {
          return jsonResponse({ version: "0.33.3" });
        }
        return jsonResponse({ models: [] });
      })
    );
    render(<AISettingsSection />);
    await user.click(screen.getByRole("button", { name: "接続確認" }));
    await waitFor(() => {
      expect(screen.getByText(/Ollamaに接続できました/)).toBeInTheDocument();
    });
    expect(screen.getByText("インストール済みモデルはありません。")).toBeInTheDocument();
  });

  it("接続失敗を表示する", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      })
    );
    render(<AISettingsSection />);
    await user.click(screen.getByRole("button", { name: "接続確認" }));
    await waitFor(() => {
      expect(screen.getByText(/Ollamaに接続できませんでした/)).toBeInTheDocument();
    });
  });

  it("設定モデルが見つからない場合は案内を表示する", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/api/version")) {
          return jsonResponse({ version: "0.11.4" });
        }
        return jsonResponse({ models: [{ name: "llama3.2:1b" }] });
      })
    );
    render(<AISettingsSection />);
    await user.click(screen.getByRole("button", { name: "接続確認" }));
    await waitFor(() => {
      expect(screen.getByText(/設定された生成モデル「qwen3:4b」が見つかりません/)).toBeInTheDocument();
    });
    expect(screen.getByText(/設定されたEmbeddingモデル「bge-m3:latest」が見つかりません/)).toBeInTheDocument();
    expect(screen.getByText("ollama pull qwen3:4b")).toBeInTheDocument();
  });

  it("外部URLは同意前にfetchせず、同意後に接続確認できる", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async () => jsonResponse({ version: "0.1.0" }));
    vi.stubGlobal("fetch", fetchMock);
    localStorage.setItem(
      AI_SETTINGS_STORAGE_KEY,
      JSON.stringify({ ...DEFAULT_AI_SETTINGS, baseUrl: "https://ollama.example.com" })
    );
    render(<AISettingsSection />);
    expect(screen.getByText(/この端末上のローカルOllamaではありません/)).toBeInTheDocument();
    expect(screen.getByText("接続先：https://ollama.example.com")).toBeInTheDocument();
    expect(screen.queryByText(/通信は暗号化されません/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "接続確認" }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText(/設定画面で許可してから/)).toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: /学習データ送信を許可する/ }));
    expect(JSON.parse(localStorage.getItem(OLLAMA_EXTERNAL_CONSENT_STORAGE_KEY) ?? "{}")).toEqual({
      baseUrl: "https://ollama.example.com"
    });
    await user.click(screen.getByRole("button", { name: "接続確認" }));
    await waitFor(() => {
      expect(screen.getByText(/Ollamaに接続できました/)).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalled();
  });

  it("HTTPの外部URLでは暗号化されないことを表示する", async () => {
    localStorage.setItem(
      AI_SETTINGS_STORAGE_KEY,
      JSON.stringify({ ...DEFAULT_AI_SETTINGS, baseUrl: "http://192.168.1.10:11434" })
    );
    render(<AISettingsSection />);
    expect(screen.getByText(/通信は暗号化されません/)).toBeInTheDocument();
  });

  it("ローカルURLでは外部送信の警告を出さない", () => {
    render(<AISettingsSection />);
    expect(screen.queryByText(/ローカルOllamaではありません/)).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /学習データ送信を許可する/ })).not.toBeInTheDocument();
  });
});
