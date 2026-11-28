import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AIError } from "../errors";
import { grantExternalSendConsent, revokeExternalSendConsent } from "../ollamaEndpoint";
import { OLLAMA_CONNECTION_TIMEOUT_MS, OLLAMA_REQUEST_TIMEOUT_MS } from "../timeouts";
import {
  checkOllamaConnection,
  isOllamaModelInstalled,
  listOllamaModels
} from "./ollamaClient";

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });

const neverResolvingFetch = () =>
  vi.fn((_url: string, init?: RequestInit) => {
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        const abortError = new Error("Aborted");
        abortError.name = "AbortError";
        reject(abortError);
      });
    });
  });

const installLocalStorage = () => {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => {
        store.clear();
      }
    }
  });
};

beforeEach(() => {
  installLocalStorage();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Ollama timeout constants", () => {
  it("接続は5〜10秒、chat/embedはモデル切り替えを含め3分以内", () => {
    expect(OLLAMA_CONNECTION_TIMEOUT_MS).toBeGreaterThanOrEqual(5_000);
    expect(OLLAMA_CONNECTION_TIMEOUT_MS).toBeLessThanOrEqual(10_000);
    expect(OLLAMA_REQUEST_TIMEOUT_MS).toBe(180_000);
  });
});

describe("checkOllamaConnection", () => {
  it("正常接続できる", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ version: "0.11.4" }))
    );
    await expect(checkOllamaConnection("http://localhost:11434")).resolves.toEqual({
      connected: true,
      version: "0.11.4"
    });
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:11434/api/version",
      expect.objectContaining({ method: "GET", redirect: "error" })
    );
  });

  it("不正なURLではfetchしない", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await checkOllamaConnection("javascript:alert(1)");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.connected).toBe(false);
    if (!result.connected) {
      expect(result.error.code).toBe("invalid-endpoint");
      expect(result.error.message).not.toContain("concept");
    }
  });

  it("未同意の外部URLではfetchしない", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    revokeExternalSendConsent();
    const result = await checkOllamaConnection("https://ollama.example.com");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.connected).toBe(false);
    if (!result.connected) {
      expect(result.error.code).toBe("external-consent-required");
    }
  });

  it("同意済みの外部URLでは通信できる", async () => {
    grantExternalSendConsent("https://ollama.example.com/proxy/");
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ version: "0.1.0" })));
    await expect(checkOllamaConnection("https://ollama.example.com/proxy")).resolves.toMatchObject({
      connected: true,
      version: "0.1.0"
    });
    expect(fetch).toHaveBeenCalledWith(
      "https://ollama.example.com/proxy/api/version",
      expect.objectContaining({ redirect: "error" })
    );
  });

  it("connection refused を connection-failed にする", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      })
    );
    const result = await checkOllamaConnection();
    expect(result.connected).toBe(false);
    if (!result.connected) {
      expect(result.error).toBeInstanceOf(AIError);
      expect(result.error.code).toBe("connection-failed");
    }
  });

  it("timeoutする", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", neverResolvingFetch());
    const promise = checkOllamaConnection();
    const assertion = promise.then((result) => {
      expect(result.connected).toBe(false);
      if (!result.connected) {
        expect(result.error.code).toBe("timeout");
      }
    });
    await vi.advanceTimersByTimeAsync(OLLAMA_CONNECTION_TIMEOUT_MS);
    await assertion;
  });

  it("不正JSONを invalid-response にする", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{not-json", { status: 200 }))
    );
    const result = await checkOllamaConnection();
    expect(result.connected).toBe(false);
    if (!result.connected) {
      expect(result.error.code).toBe("invalid-response");
    }
  });

  it("HTTP error を api-error にする", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: "internal" }, 500)));
    const result = await checkOllamaConnection();
    expect(result.connected).toBe(false);
    if (!result.connected) {
      expect(result.error.code).toBe("api-error");
      expect(result.error.status).toBe(500);
    }
  });
});

describe("listOllamaModels", () => {
  it("未同意の外部URLではfetchしない", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    revokeExternalSendConsent();
    await expect(listOllamaModels("http://192.168.1.10:11434")).rejects.toMatchObject({
      code: "external-consent-required"
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("/api/tags の正常レスポンスから名前を返す", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          models: [{ name: "qwen3:4b" }, { name: "bge-m3:latest" }, { name: 1 }, {}]
        })
      )
    );
    await expect(listOllamaModels()).resolves.toEqual(["qwen3:4b", "bge-m3:latest"]);
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:11434/api/tags",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("空モデル一覧を返す", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ models: [] })));
    await expect(listOllamaModels()).resolves.toEqual([]);
  });

  it("malformed response を invalid-response にする", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ models: "qwen3:4b" })));
    await expect(listOllamaModels()).rejects.toMatchObject({ code: "invalid-response" });
  });

  it("HTTP error を api-error にする", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: "internal" }, 500)));
    await expect(listOllamaModels()).rejects.toMatchObject({ code: "api-error", status: 500 });
  });
});

describe("isOllamaModelInstalled", () => {
  it("設定名と :latest を同一視できる", () => {
    expect(isOllamaModelInstalled(["bge-m3:latest"], "bge-m3")).toBe(true);
    expect(isOllamaModelInstalled(["qwen3:4b"], "qwen3:4b")).toBe(true);
    expect(isOllamaModelInstalled(["qwen3:4b"], "missing")).toBe(false);
  });
});
