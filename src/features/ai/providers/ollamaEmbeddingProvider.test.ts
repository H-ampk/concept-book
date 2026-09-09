import { afterEach, describe, expect, it, vi } from "vitest";
import { OLLAMA_REQUEST_TIMEOUT_MS } from "../timeouts";
import { OllamaEmbeddingProvider } from "./ollamaEmbeddingProvider";

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
  new OllamaEmbeddingProvider({
    enabled: true,
    baseUrl: "http://localhost:11434",
    model: "bge-m3:latest"
  });

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("OllamaEmbeddingProvider", () => {
  it("単一入力を配列で送り embedding を返す", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ embeddings: [[0.1, 0.2, 0.3]] }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(enabledProvider().embed("hello")).resolves.toEqual([[0.1, 0.2, 0.3]]);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({
      model: "bge-m3:latest",
      input: "hello"
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:11434/api/embed",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("複数入力の embedding を返す", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ embeddings: [[1], [2, 3]] }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(enabledProvider().embed(["text A", "text B"])).resolves.toEqual([[1], [2, 3]]);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body)).input).toEqual(["text A", "text B"]);
  });

  it("空/不正embeddingレスポンスを invalid-response にする", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ embeddings: [] })));
    await expect(enabledProvider().embed("hello")).rejects.toMatchObject({ code: "invalid-response" });

    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ embeddings: [["bad"]] })));
    await expect(enabledProvider().embed("hello")).rejects.toMatchObject({ code: "invalid-response" });

    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ embedding: [1, 2] })));
    await expect(enabledProvider().embed("hello")).rejects.toMatchObject({ code: "invalid-response" });
  });

  it("model-not-found を返す", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ error: "model 'bge-m3:latest' not found" }, 404))
    );
    await expect(enabledProvider().embed("hello")).rejects.toMatchObject({ code: "model-not-found" });
  });

  it("network error を返す", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      })
    );
    await expect(enabledProvider().embed("hello")).rejects.toMatchObject({ code: "network" });
  });

  it("timeoutする", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", neverResolvingFetch());
    const promise = enabledProvider().embed("hello");
    const assertion = expect(promise).rejects.toMatchObject({ code: "timeout" });
    await vi.advanceTimersByTimeAsync(OLLAMA_REQUEST_TIMEOUT_MS);
    await assertion;
  });

  it("無効時は fetch せず disabled を返す", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OllamaEmbeddingProvider({
      enabled: false,
      baseUrl: "http://localhost:11434",
      model: "bge-m3:latest"
    });
    await expect(provider.embed("hello")).rejects.toMatchObject({ code: "disabled" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
