export type {
  AIEmbeddingProvider,
  AIMessage,
  AIMessageRole,
  AIProviderKind,
  AISettings,
  AITextProvider,
  AITextRequest,
  AITextResponse
} from "./types";
export { AI_PROVIDER_KIND } from "./types";
export { AIError, isAIError, type AIErrorCode } from "./errors";
export {
  AI_SETTINGS_STORAGE_KEY,
  DEFAULT_AI_SETTINGS,
  DEFAULT_EMBEDDING_MODEL,
  DEFAULT_OLLAMA_BASE_URL,
  DEFAULT_TEXT_MODEL,
  isAIEnabled,
  loadAISettings,
  normalizeAISettings,
  resetAISettings,
  saveAISettings
} from "./settings";
export { buildAIConceptSnapshot, type AIConceptSnapshot, type BuildAIConceptSnapshotOptions } from "./conceptSnapshot";
export { getAIEmbeddingProvider, getAITextProvider } from "./factory";
export {
  OLLAMA_CONNECTION_TIMEOUT_MS,
  OLLAMA_REQUEST_TIMEOUT_MS
} from "./timeouts";
export {
  checkOllamaConnection,
  isOllamaModelInstalled,
  listOllamaModels,
  type OllamaConnectionStatus
} from "./providers/ollamaClient";
