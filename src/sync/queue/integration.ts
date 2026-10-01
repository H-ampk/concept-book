import { SyncQueueProcessor, type ProcessQueueReport, type SyncQueueProcessorDeps } from "./processor";

export type SyncQueueIntegration = {
  processQueue: () => Promise<ProcessQueueReport>;
  /** 起動時。未ログインなら送信しない。navigator.onLine は成功判定に使わない。 */
  resumeOnAppStart: () => Promise<ProcessQueueReport>;
  /** online 復帰。onLine === false なら送らない。true でも Port の結果で成否を決める。 */
  handleOnline: (isOnline?: boolean) => Promise<ProcessQueueReport>;
};

const skippedOffline = (): ProcessQueueReport => ({
  ran: false,
  reason: "unauthenticated",
  succeeded: [],
  failed: [],
  blocked: []
});

/**
 * window へ直接購読しない。アプリは実 Cloud Port があるときだけこれを呼ぶ。
 * Port 未接続の起動経路からは呼ばない（#71 / #82）。
 */
export const createSyncQueueIntegration = (deps: SyncQueueProcessorDeps): SyncQueueIntegration => {
  const processor = new SyncQueueProcessor(deps);
  return {
    processQueue: () => processor.processQueue(),
    resumeOnAppStart: () => processor.processQueue(),
    handleOnline: (isOnline = typeof navigator === "undefined" ? true : navigator.onLine) => {
      if (!isOnline) {
        return Promise.resolve({
          ...skippedOffline(),
          reason: undefined
        });
      }
      return processor.processQueue();
    }
  };
};
