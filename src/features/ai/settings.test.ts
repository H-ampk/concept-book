import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AI_SETTINGS_STORAGE_KEY,
  DEFAULT_AI_SETTINGS,
  DEFAULT_EMBEDDING_MODEL,
  DEFAULT_OLLAMA_BASE_URL,
  DEFAULT_TEXT_MODEL,
  isAIEnabled,
  loadAISettings,
  resetAISettings,
  saveAISettings
} from "./settings";

const installLocalStorage = () => {
  const store = new Map<string, string>();
  const localStorage = {
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
  };
  Object.defineProperty(globalThis, "localStorage", {
    value: localStorage,
    configurable: true
  });
};

describe("AI settings", () => {
  beforeEach(() => {
    installLocalStorage();
  });

  afterEach(() => {
    if (typeof localStorage?.clear === "function") {
      localStorage.clear();
    }
  });

  it("未保存ならdefaultを返す", () => {
    expect(loadAISettings()).toEqual(DEFAULT_AI_SETTINGS);
    expect(isAIEnabled()).toBe(false);
    expect(DEFAULT_AI_SETTINGS).toMatchObject({
      enabled: false,
      provider: "ollama",
      baseUrl: DEFAULT_OLLAMA_BASE_URL,
      textModel: DEFAULT_TEXT_MODEL,
      embeddingModel: DEFAULT_EMBEDDING_MODEL
    });
  });

  it("save → load できる", () => {
    saveAISettings({
      enabled: true,
      provider: "ollama",
      baseUrl: "http://127.0.0.1:11434",
      textModel: "qwen3:8b",
      embeddingModel: "bge-m3:latest"
    });
    expect(loadAISettings()).toEqual({
      enabled: true,
      provider: "ollama",
      baseUrl: "http://127.0.0.1:11434",
      textModel: "qwen3:8b",
      embeddingModel: "bge-m3:latest"
    });
    expect(isAIEnabled()).toBe(true);
  });

  it("不正JSONでもdefaultを返す", () => {
    localStorage.setItem(AI_SETTINGS_STORAGE_KEY, "{not-json");
    expect(loadAISettings()).toEqual(DEFAULT_AI_SETTINGS);
  });

  it("不正providerはdefaultへ戻す", () => {
    localStorage.setItem(
      AI_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        enabled: true,
        provider: "openai",
        baseUrl: "http://127.0.0.1:11434",
        textModel: "qwen3:8b",
        embeddingModel: "custom-embed"
      })
    );
    expect(loadAISettings()).toEqual({
      enabled: true,
      provider: "ollama",
      baseUrl: "http://127.0.0.1:11434",
      textModel: "qwen3:8b",
      embeddingModel: "custom-embed"
    });
  });

  it("空modelはdefaultとして読み込む", () => {
    localStorage.setItem(
      AI_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        enabled: true,
        provider: "ollama",
        baseUrl: "http://localhost:11434",
        textModel: "",
        embeddingModel: "   "
      })
    );
    expect(loadAISettings().textModel).toBe(DEFAULT_TEXT_MODEL);
    expect(loadAISettings().embeddingModel).toBe(DEFAULT_EMBEDDING_MODEL);
  });

  it("不正なbaseUrl型はdefaultへ戻す", () => {
    localStorage.setItem(
      AI_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        enabled: true,
        provider: "ollama",
        baseUrl: 11434,
        textModel: "qwen3:4b",
        embeddingModel: "bge-m3:latest"
      })
    );
    expect(loadAISettings().baseUrl).toBe(DEFAULT_OLLAMA_BASE_URL);
  });

  it("resetでdefaultに戻る", () => {
    saveAISettings({
      ...DEFAULT_AI_SETTINGS,
      enabled: true,
      textModel: "other"
    });
    resetAISettings();
    expect(loadAISettings()).toEqual(DEFAULT_AI_SETTINGS);
    expect(isAIEnabled()).toBe(false);
  });

  it("Storage access failureでもアプリを壊さない", () => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: () => {
          throw new Error("blocked");
        },
        setItem: () => {
          throw new Error("blocked");
        },
        removeItem: () => {
          throw new Error("blocked");
        }
      }
    });
    expect(loadAISettings()).toEqual(DEFAULT_AI_SETTINGS);
    expect(() => saveAISettings(DEFAULT_AI_SETTINGS)).not.toThrow();
    expect(() => resetAISettings()).not.toThrow();
    expect(isAIEnabled()).toBe(false);
  });
});
