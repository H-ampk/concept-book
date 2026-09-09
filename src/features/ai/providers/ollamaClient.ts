import { AIError } from "../errors";
import { DEFAULT_OLLAMA_BASE_URL } from "../settings";
import { OLLAMA_CONNECTION_TIMEOUT_MS, OLLAMA_REQUEST_TIMEOUT_MS } from "../timeouts";
import type { AIMessage } from "../types";

export type OllamaConnectionStatus =
  | { connected: true; version?: string }
  | { connected: false; error: AIError };

type OllamaRequestOptions = {
  path: string;
  method?: "GET" | "POST";
  body?: unknown;
  timeoutMs: number;
};

const joinUrl = (baseUrl: string, path: string): string => {
  const base = baseUrl.trim().replace(/\/+$/, "") || DEFAULT_OLLAMA_BASE_URL;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
};

const isAbortError = (error: unknown): boolean =>
  (typeof DOMException !== "undefined" && error instanceof DOMException && error.name === "AbortError") ||
  (error instanceof Error && error.name === "AbortError");

const extractOllamaErrorMessage = (body: unknown): string | undefined => {
  if (typeof body !== "object" || body === null) {
    return undefined;
  }
  const error = (body as { error?: unknown }).error;
  return typeof error === "string" && error.trim().length > 0 ? error : undefined;
};

const parseJsonBody = async (response: Response): Promise<unknown> => {
  const text = await response.text();
  if (text.trim().length === 0) {
    throw new AIError("invalid-response", "Ollamaからの応答が空です。");
  }
  try {
    return JSON.parse(text) as unknown;
  } catch (cause) {
    throw new AIError("invalid-response", "Ollamaからの応答を解析できませんでした。", { cause });
  }
};

const isModelNotFoundMessage = (message: string): boolean =>
  /not found|does not exist|unknown model/i.test(message);

const throwForUnsuccessfulResponse = (status: number, body: unknown): never => {
  const message = extractOllamaErrorMessage(body) ?? `Ollama APIエラー (${status})`;
  if (status === 404 || isModelNotFoundMessage(message)) {
    throw new AIError("model-not-found", message, { status });
  }
  throw new AIError("api-error", message, { status });
};

const classifyFetchFailure = (error: unknown): AIError => {
  if (error instanceof AIError) {
    return error;
  }
  if (isAbortError(error)) {
    return new AIError("timeout", "Ollamaへの接続がタイムアウトしました。", { cause: error });
  }
  return new AIError("network", "Ollamaへの接続に失敗しました。", { cause: error });
};

export const isOllamaModelInstalled = (models: readonly string[], configured: string): boolean => {
  const wanted = configured.trim();
  if (!wanted) {
    return false;
  }
  const stripLatest = (name: string): string => name.replace(/:latest$/, "");
  return models.some((name) => name === wanted || stripLatest(name) === stripLatest(wanted));
};

export class OllamaClient {
  readonly baseUrl: string;
  private readonly connectionTimeoutMs: number;
  private readonly requestTimeoutMs: number;

  constructor(
    baseUrl: string = DEFAULT_OLLAMA_BASE_URL,
    options?: { connectionTimeoutMs?: number; requestTimeoutMs?: number }
  ) {
    this.baseUrl = joinUrl(baseUrl, "").replace(/\/+$/, "") || DEFAULT_OLLAMA_BASE_URL;
    this.connectionTimeoutMs = options?.connectionTimeoutMs ?? OLLAMA_CONNECTION_TIMEOUT_MS;
    this.requestTimeoutMs = options?.requestTimeoutMs ?? OLLAMA_REQUEST_TIMEOUT_MS;
  }

  async checkConnection(): Promise<OllamaConnectionStatus> {
    try {
      const body = await this.request({
        path: "/api/version",
        method: "GET",
        timeoutMs: this.connectionTimeoutMs
      });
      const version =
        typeof body === "object" && body !== null && typeof (body as { version?: unknown }).version === "string"
          ? (body as { version: string }).version
          : undefined;
      return version ? { connected: true, version } : { connected: true };
    } catch (error) {
      const aiError = classifyFetchFailure(error);
      if (aiError.code === "network") {
        return {
          connected: false,
          error: new AIError(
            "connection-failed",
            "Ollamaに接続できませんでした。Ollamaが起動しているか確認してください。",
            { cause: aiError }
          )
        };
      }
      return { connected: false, error: aiError };
    }
  }

  async listModels(): Promise<string[]> {
    const body = await this.request({
      path: "/api/tags",
      method: "GET",
      timeoutMs: this.connectionTimeoutMs
    });
    if (typeof body !== "object" || body === null) {
      throw new AIError("invalid-response", "Ollamaのモデル一覧を解析できませんでした。");
    }
    const models = (body as { models?: unknown }).models;
    if (!Array.isArray(models)) {
      throw new AIError("invalid-response", "Ollamaのモデル一覧を解析できませんでした。");
    }
    return models.flatMap((item) => {
      if (typeof item !== "object" || item === null) {
        return [];
      }
      const name = (item as { name?: unknown }).name;
      return typeof name === "string" && name.trim().length > 0 ? [name] : [];
    });
  }

  async chat(model: string, messages: AIMessage[]): Promise<string> {
    const body = await this.request({
      path: "/api/chat",
      method: "POST",
      timeoutMs: this.requestTimeoutMs,
      body: {
        model,
        messages,
        stream: false
      }
    });
    if (typeof body !== "object" || body === null) {
      throw new AIError("invalid-response", "Ollamaの生成結果を解析できませんでした。");
    }
    const content = (body as { message?: { content?: unknown } }).message?.content;
    if (typeof content !== "string") {
      throw new AIError("invalid-response", "Ollamaの生成結果を解析できませんでした。");
    }
    return content;
  }

  async embed(model: string, input: string | string[]): Promise<number[][]> {
    const body = await this.request({
      path: "/api/embed",
      method: "POST",
      timeoutMs: this.requestTimeoutMs,
      body: {
        model,
        input
      }
    });
    if (typeof body !== "object" || body === null) {
      throw new AIError("invalid-response", "OllamaのEmbedding結果を解析できませんでした。");
    }
    const embeddings = (body as { embeddings?: unknown }).embeddings;
    if (!Array.isArray(embeddings) || embeddings.length === 0) {
      throw new AIError("invalid-response", "OllamaのEmbedding結果を解析できませんでした。");
    }
    const vectors: number[][] = [];
    for (const item of embeddings) {
      if (!Array.isArray(item) || item.length === 0) {
        throw new AIError("invalid-response", "OllamaのEmbedding結果を解析できませんでした。");
      }
      const vector: number[] = [];
      for (const value of item) {
        if (typeof value !== "number" || !Number.isFinite(value)) {
          throw new AIError("invalid-response", "OllamaのEmbedding結果を解析できませんでした。");
        }
        vector.push(value);
      }
      vectors.push(vector);
    }
    return vectors;
  }

  private async request(options: OllamaRequestOptions): Promise<unknown> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs);
    try {
      const response = await fetch(joinUrl(this.baseUrl, options.path), {
        method: options.method ?? "GET",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          ...(options.body !== undefined ? { "Content-Type": "application/json" } : {})
        },
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined
      });
      const parsed = await parseJsonBody(response);
      if (!response.ok) {
        throwForUnsuccessfulResponse(response.status, parsed);
      }
      return parsed;
    } catch (error) {
      throw classifyFetchFailure(error);
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export const checkOllamaConnection = async (
  baseUrl: string = DEFAULT_OLLAMA_BASE_URL
): Promise<OllamaConnectionStatus> => new OllamaClient(baseUrl).checkConnection();

export const listOllamaModels = async (baseUrl: string = DEFAULT_OLLAMA_BASE_URL): Promise<string[]> =>
  new OllamaClient(baseUrl).listModels();
