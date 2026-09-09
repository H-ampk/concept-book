import { AI_PROVIDER_KIND, type AIProviderKind, type AISettings } from "./types";

export const AI_SETTINGS_STORAGE_KEY = "concept-book-ai-settings";

export const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434";
export const DEFAULT_TEXT_MODEL = "qwen3:4b";
export const DEFAULT_EMBEDDING_MODEL = "bge-m3:latest";

export const DEFAULT_AI_SETTINGS: AISettings = {
  enabled: false,
  provider: AI_PROVIDER_KIND,
  baseUrl: DEFAULT_OLLAMA_BASE_URL,
  textModel: DEFAULT_TEXT_MODEL,
  embeddingModel: DEFAULT_EMBEDDING_MODEL
};

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const normalizeProvider = (value: unknown): AIProviderKind =>
  value === AI_PROVIDER_KIND ? AI_PROVIDER_KIND : DEFAULT_AI_SETTINGS.provider;

const normalizeBaseUrl = (value: unknown): string => {
  if (!isNonEmptyString(value)) {
    return DEFAULT_AI_SETTINGS.baseUrl;
  }
  return value.trim().replace(/\/+$/, "");
};

const normalizeModel = (value: unknown, fallback: string): string => {
  if (!isNonEmptyString(value)) {
    return fallback;
  }
  return value.trim();
};

export const normalizeAISettings = (input: unknown): AISettings => {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ...DEFAULT_AI_SETTINGS };
  }
  const raw = input as Record<string, unknown>;
  return {
    enabled: typeof raw.enabled === "boolean" ? raw.enabled : DEFAULT_AI_SETTINGS.enabled,
    provider: normalizeProvider(raw.provider),
    baseUrl: normalizeBaseUrl(raw.baseUrl),
    textModel: normalizeModel(raw.textModel, DEFAULT_AI_SETTINGS.textModel),
    embeddingModel: normalizeModel(raw.embeddingModel, DEFAULT_AI_SETTINGS.embeddingModel)
  };
};

export const loadAISettings = (): AISettings => {
  try {
    const raw = localStorage.getItem(AI_SETTINGS_STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_AI_SETTINGS };
    }
    return normalizeAISettings(JSON.parse(raw) as unknown);
  } catch {
    return { ...DEFAULT_AI_SETTINGS };
  }
};

export const saveAISettings = (settings: AISettings): void => {
  try {
    localStorage.setItem(AI_SETTINGS_STORAGE_KEY, JSON.stringify(normalizeAISettings(settings)));
  } catch {
    // Storage access failure must not break ConceptBook.
  }
};

export const resetAISettings = (): void => {
  try {
    localStorage.removeItem(AI_SETTINGS_STORAGE_KEY);
  } catch {
    // Storage access failure must not break ConceptBook.
  }
};

export const isAIEnabled = (): boolean => loadAISettings().enabled;
