import { afterEach, describe, expect, it, vi } from "vitest";
import { OLLAMA_REQUEST_TIMEOUT_MS } from "../timeouts";
import { OllamaTextProvider } from "./ollamaTextProvider";

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

const enabledProvider = () =>
  new OllamaTextProvider({
    enabled: true,
    baseUrl: "http://localhost:11434",
    model: "qwen3:4b"
  });

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("OllamaTextProvider", () => {
  it("正常レスポンスから text だけを返す", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        model: "qwen3:4b",
        message: { role: "assistant", content: "短い返答" },
        done: true
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      enabledProvider().generate({ messages: [{ role: "user", content: "ping" }] })
    ).resolves.toEqual({ text: "短い返答" });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({
      model: "qwen3:4b",
      messages: [{ role: "user", content: "ping" }],
      stream: false
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:11434/api/chat",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("model-not-found を返す", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ error: "model 'qwen3:4b' not found" }, 404))
    );
    await expect(
      enabledProvider().generate({ messages: [{ role: "user", content: "ping" }] })
    ).rejects.toMatchObject({ code: "model-not-found" });
  });

  it("HTTP error を api-error にする", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: "internal" }, 500)));
    await expect(
      enabledProvider().generate({ messages: [{ role: "user", content: "ping" }] })
    ).rejects.toMatchObject({ code: "api-error", status: 500 });
  });

  it("network error を返す", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      })
    );
    await expect(
      enabledProvider().generate({ messages: [{ role: "user", content: "ping" }] })
    ).rejects.toMatchObject({ code: "network" });
  });

  it("timeoutする", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", neverResolvingFetch());
    const promise = enabledProvider().generate({ messages: [{ role: "user", content: "ping" }] });
    const assertion = expect(promise).rejects.toMatchObject({ code: "timeout" });
    await vi.advanceTimersByTimeAsync(OLLAMA_REQUEST_TIMEOUT_MS);
    await assertion;
  });

  it("malformed response を invalid-response にする", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ message: { role: "assistant" } })));
    await expect(
      enabledProvider().generate({ messages: [{ role: "user", content: "ping" }] })
    ).rejects.toMatchObject({ code: "invalid-response" });
  });

  it("無効時は fetch せず disabled を返す", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OllamaTextProvider({
      enabled: false,
      baseUrl: "http://localhost:11434",
      model: "qwen3:4b"
    });
    await expect(provider.generate({ messages: [{ role: "user", content: "ping" }] })).rejects.toMatchObject({
      code: "disabled"
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
