import { SyncQueueProcessor, type ProcessQueueReport, type SyncQueueProcessorDeps } from "./processor";

/** setTimeout に渡して安全な上限。超過分は発火後に残りを張り直す。 */
export const MAX_TIMER_DELAY_MS = 2_147_000_000;

export type SyncQueueTimerId = ReturnType<typeof setTimeout>;

export type SyncQueueSchedulerDeps = SyncQueueProcessorDeps & {
  isOnline?: () => boolean;
  setTimer?: (callback: () => void, delayMs: number) => SyncQueueTimerId;
  clearTimer?: (id: SyncQueueTimerId) => void;
  /** Integration だけが使う。未指定なら window の online。 */
  subscribeOnline?: (listener: () => void) => () => void;
};

export interface SyncQueueScheduler {
  start(): Promise<ProcessQueueReport>;
  stop(): void;
  triggerNow(): Promise<ProcessQueueReport>;
}

const skipped = (reason: NonNullable<ProcessQueueReport["reason"]>): ProcessQueueReport => ({
  ran: false,
  reason,
  succeeded: [],
  failed: [],
  blocked: []
});

const defaultIsOnline = (): boolean => (typeof navigator === "undefined" ? true : navigator.onLine);

/**
 * いつ Processor を起動するかを管理する。
 * Processor は 1 回の処理だけを担当し、timer はここだけが持つ。
 */
export class SyncQueueScheduler implements SyncQueueScheduler {
  private readonly processor: SyncQueueProcessor;
  private running = false;
  private timer: SyncQueueTimerId | null = null;

  constructor(private readonly deps: SyncQueueSchedulerDeps) {
    this.processor = new SyncQueueProcessor(deps);
  }

  start(): Promise<ProcessQueueReport> {
    this.running = true;
    return this.triggerNow();
  }

  stop(): void {
    this.running = false;
    this.clearTimer();
  }

  async triggerNow(): Promise<ProcessQueueReport> {
    if (!this.running) {
      return skipped("stopped");
    }
    const isOnline = this.deps.isOnline ?? defaultIsOnline;
    if (!isOnline()) {
      return skipped("offline");
    }
    const report = await this.processor.processQueue();
    if (this.running) {
      await this.reschedule();
    }
    return report;
  }

  private async reschedule(): Promise<void> {
    if (!this.running) {
      this.clearTimer();
      return;
    }
    const user = await this.deps.getCurrentUser();
    if (!user?.id) {
      this.clearTimer();
      return;
    }
    const nextAt = await this.deps.queue.getNextProcessableAt(user.id);
    if (!nextAt) {
      this.clearTimer();
      return;
    }
    const now = this.deps.now ?? Date.now;
    const parsed = Date.parse(nextAt);
    const delay = Number.isNaN(parsed) ? 0 : Math.max(0, parsed - now());
    this.arm(Math.min(delay, MAX_TIMER_DELAY_MS));
  }

  private arm(delayMs: number): void {
    this.clearTimer();
    if (!this.running) {
      return;
    }
    const setTimer = this.deps.setTimer ?? ((callback, ms) => setTimeout(callback, ms));
    this.timer = setTimer(() => {
      this.timer = null;
      if (!this.running) {
        return;
      }
      void this.triggerNow();
    }, delayMs);
  }

  private clearTimer(): void {
    if (this.timer === null) {
      return;
    }
    const clearTimer = this.deps.clearTimer ?? ((id) => clearTimeout(id));
    clearTimer(this.timer);
    this.timer = null;
  }
}

export const createSyncQueueScheduler = (deps: SyncQueueSchedulerDeps): SyncQueueScheduler =>
  new SyncQueueScheduler(deps);
