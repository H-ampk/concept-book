import { loadAISettings } from "./settings";
import type { AIEmbeddingProvider, AISettings, AITextProvider } from "./types";
import { OllamaEmbeddingProvider } from "./providers/ollamaEmbeddingProvider";
import { OllamaTextProvider } from "./providers/ollamaTextProvider";

export const getAITextProvider = (settings: AISettings = loadAISettings()): AITextProvider =>
  new OllamaTextProvider({
    enabled: settings.enabled,
    baseUrl: settings.baseUrl,
    model: settings.textModel
  });

export const getAIEmbeddingProvider = (settings: AISettings = loadAISettings()): AIEmbeddingProvider =>
  new OllamaEmbeddingProvider({
    enabled: settings.enabled,
    baseUrl: settings.baseUrl,
    model: settings.embeddingModel
  });
