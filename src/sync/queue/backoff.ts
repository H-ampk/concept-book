/** 1回目の失敗後。数秒。 */
const BACKOFF_DELAYS_MS = [5_000, 30_000, 120_000, 480_000] as const;

/** 指数が際限なく伸びない上限。 */
export const SYNC_RETRY_MAX_DELAY_MS = 900_000;

/**
 * processing のままプロセスが死んだとみなすまでの時間。
 * この間は fresh な processing を再送しない。
 */
export const SYNC_PROCESSING_LEASE_MS = 120_000;

/** 1回の processQueue で順に扱う上限。無制限並列はしない。 */
export const SYNC_QUEUE_BATCH_SIZE = 25;

/**
 * retryCount は失敗後の回数（1 始まり）。
 * 1 → 5s、2 → 30s、3 → 2min、4 → 8min、以降は 15min で頭打ち。
 */
export const computeBackoffDelayMs = (retryCount: number): number => {
  const index = Math.max(0, retryCount - 1);
  if (index >= BACKOFF_DELAYS_MS.length) {
    return SYNC_RETRY_MAX_DELAY_MS;
  }
  return BACKOFF_DELAYS_MS[index];
};

export const computeNextAttemptAt = (retryCount: number, nowMs: number): string =>
  new Date(nowMs + computeBackoffDelayMs(retryCount)).toISOString();

export const isProcessingLeaseStale = (
  lastAttemptAt: string | undefined,
  nowMs: number,
  leaseMs: number = SYNC_PROCESSING_LEASE_MS
): boolean => {
  if (!lastAttemptAt) {
    return true;
  }
  const attempted = Date.parse(lastAttemptAt);
  if (Number.isNaN(attempted)) {
    return true;
  }
  return nowMs - attempted >= leaseMs;
};
