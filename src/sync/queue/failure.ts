import type { SyncPushFailure, SyncPushFailureKind, SyncQueueStatus } from "./types";

const RETRYABLE: ReadonlySet<SyncPushFailureKind> = new Set([
  "network",
  "timeout",
  "rateLimit",
  "server",
  "unknown"
]);

export const queueStatusForFailure = (kind: SyncPushFailureKind): Extract<SyncQueueStatus, "failed" | "blocked"> =>
  RETRYABLE.has(kind) ? "failed" : "blocked";

const SECRET_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  [/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, "Bearer [redacted]"],
  [/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, "[redacted-jwt]"],
  [/(api[_-]?key|access[_-]?token|refresh[_-]?token|authorization)\s*[:=]\s*\S+/gi, "$1=[redacted]"]
];

const MAX_ERROR_LENGTH = 300;

/** Queue に残すメッセージ。token / header / session 全文は残さない。 */
export const sanitizeSyncErrorMessage = (message: string): string => {
  let sanitized = message;
  for (const [pattern, replacement] of SECRET_PATTERNS) {
    sanitized = sanitized.replace(pattern, replacement);
  }
  if (sanitized.length > MAX_ERROR_LENGTH) {
    return sanitized.slice(0, MAX_ERROR_LENGTH);
  }
  return sanitized;
};

export const toStoredFailure = (
  failure: SyncPushFailure
): { errorCode: string; lastError: string; status: "failed" | "blocked" } => ({
  errorCode: failure.code || failure.kind,
  lastError: sanitizeSyncErrorMessage(failure.message),
  status: queueStatusForFailure(failure.kind)
});
