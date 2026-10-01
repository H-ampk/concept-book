import type { ProcessQueueReport } from "./processor";
import { createSyncQueueScheduler, type SyncQueueScheduler, type SyncQueueSchedulerDeps } from "./scheduler";

export type SyncQueueIntegration = {
  start(): Promise<ProcessQueueReport>;
  stop(): void;
  triggerNow(): Promise<ProcessQueueReport>;
  processQueue(): Promise<ProcessQueueReport>;
  /** 起動時。未ログインなら送信しない。navigator.onLine は成功判定に使わない。 */
  resumeOnAppStart(): Promise<ProcessQueueReport>;
  /** online 復帰。onLine === false なら送らない。true でも Port の結果で成否を決める。 */
  handleOnline(isOnline?: boolean): Promise<ProcessQueueReport>;
};

const offlineReport = (): ProcessQueueReport => ({
  ran: false,
  reason: "offline",
  succeeded: [],
  failed: [],
  blocked: []
});

const subscribeWindowOnline = (onOnline: () => void): (() => void) => {
  if (typeof window === "undefined" || typeof window.addEventListener !== "function") {
    return () => undefined;
  }
  window.addEventListener("online", onOnline);
  return () => window.removeEventListener("online", onOnline);
};

/**
 * App lifecycle との接続。window 購読はこの層だけ。
 * 実 Cloud Port が無い起動経路からは呼ばない（#71 / #82）。
 */
export const createSyncQueueIntegration = (
  deps: SyncQueueSchedulerDeps,
  scheduler: SyncQueueScheduler = createSyncQueueScheduler(deps)
): SyncQueueIntegration => {
  let detachOnline: (() => void) | null = null;

  const attachOnline = () => {
    detachOnline?.();
    const subscribe = deps.subscribeOnline ?? subscribeWindowOnline;
    detachOnline = subscribe(() => {
      void scheduler.triggerNow();
    });
  };

  const start = (): Promise<ProcessQueueReport> => {
    attachOnline();
    return scheduler.start();
  };

  return {
    start,
    stop: () => {
      detachOnline?.();
      detachOnline = null;
      scheduler.stop();
    },
    triggerNow: () => scheduler.triggerNow(),
    processQueue: () => scheduler.triggerNow(),
    resumeOnAppStart: start,
    handleOnline: (isOnline = typeof navigator === "undefined" ? true : navigator.onLine) => {
      if (!isOnline) {
        return Promise.resolve(offlineReport());
      }
      return scheduler.triggerNow();
    }
  };
};
