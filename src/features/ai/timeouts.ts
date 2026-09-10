/** GET /api/version および GET /api/tags 用（目安 5〜10秒） */
export const OLLAMA_CONNECTION_TIMEOUT_MS = 8_000;

/** POST /api/chat および POST /api/embed 用。Embedding→生成のモデル切り替えを含む */
export const OLLAMA_REQUEST_TIMEOUT_MS = 180_000;

