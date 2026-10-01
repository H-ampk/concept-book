import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { CONCEPT_BOOK_DB_NAME } from "../../storage/indexeddb";
import { toConceptSyncRecord } from "../adapters";
import { sampleConcept } from "../fixtures";
import { computeBackoffDelayMs } from "./backoff";
import { createSyncQueueIntegration } from "./integration";
import { createSyncQueueRepository } from "./repository";
import { createSyncQueueScheduler, MAX_TIMER_DELAY_MS, type SyncQueueTimerId } from "./scheduler";
import type { PrivateSyncCloudPort, PushCurrentUserResult } from "./types";

const USER_A = "user-a";
const USER_B = "user-b";
const T0 = Date.parse("2026-04-01T00:00:00.000Z");

const deleteDb = (): Promise<void> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(CONCEPT_BOOK_DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });

afterEach(async () => {
  await deleteDb();
});

const conceptRecord = (ownerUserId: string, id: string) =>
  toConceptSyncRecord({
    data: { ...sampleConcept(), id, updatedAt: "2026-03-01T12:00:00.000Z" },
    ownerUserId,
    version: 1
  });

const failure = (kind: "network" | "server"): PushCurrentUserResult => ({
  ok: false,
  failure: { kind, code: kind, message: kind }
});

type Armed = { id: number; delay: number; cb: () => void };

const timerHarness = () => {
  let seq = 1;
  let armed: Armed | null = null;
  let setCount = 0;
  const setTimer = (cb: () => void, delay: number): SyncQueueTimerId => {
    setCount += 1;
    const id = seq;
    seq += 1;
    armed = { id, delay, cb };
    return id as unknown as SyncQueueTimerId;
  };
  const clearTimer = (id: SyncQueueTimerId) => {
    if (armed && armed.id === Number(id)) {
      armed = null;
    }
  };
  const fire = async () => {
    const current = armed;
    if (!current) {
      return;
    }
    armed = null;
    current.cb();
    await flush();
  };
  return {
    setTimer,
    clearTimer,
    fire,
    armed: () => armed,
    setCount: () => setCount
  };
};

const flush = async () => {
  for (let i = 0; i < 15; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};

describe("sync queue scheduler", () => {
  it("retryable failure の nextAttemptAt まで再送せず、時刻で自動 process する", async () => {
    const timers = timerHarness();
    let now = T0;
    let calls = 0;
    const repo = createSyncQueueRepository();
    const scheduler = createSyncQueueScheduler({
      queue: repo,
      getCurrentUser: async () => ({ id: USER_A }),
      now: () => now,
      isOnline: () => true,
      setTimer: timers.setTimer,
      clearTimer: timers.clearTimer,
      cloud: {
        pullCurrentUserChanges: async () => ({
          ok: true,
          page: { records: [], nextCursor: null, hasMore: false }
        }),
        pushCurrentUserChanges: async () => {
          calls += 1;
          return calls === 1 ? failure("network") : { ok: true };
        }
      }
    });
    await repo.enqueue({ ownerUserId: USER_A, operation: "upsert", record: conceptRecord(USER_A, "concept_retry") });

    const first = await scheduler.start();
    expect(first.failed).toHaveLength(1);
    expect(calls).toBe(1);
    expect(timers.armed()?.delay).toBe(computeBackoffDelayMs(1));

    now = T0 + computeBackoffDelayMs(1) - 1;
    const early = await scheduler.triggerNow();
    expect(early.ran).toBe(true);
    expect(early.failed).toHaveLength(0);
    expect(early.succeeded).toHaveLength(0);
    expect(calls).toBe(1);

    now = T0 + computeBackoffDelayMs(1);
    await timers.fire();
    expect(calls).toBe(2);
    expect(await repo.listByOwner(USER_A)).toHaveLength(0);
    expect(timers.armed()).toBeNull();
  });

  it("連続 failure で retryCount と backoff が延び、成功で削除される", async () => {
    const timers = timerHarness();
    let now = T0;
    let calls = 0;
    const repo = createSyncQueueRepository();
    const scheduler = createSyncQueueScheduler({
      queue: repo,
      getCurrentUser: async () => ({ id: USER_A }),
      now: () => now,
      isOnline: () => true,
      setTimer: timers.setTimer,
      clearTimer: timers.clearTimer,
      cloud: {
        pullCurrentUserChanges: async () => ({
          ok: true,
          page: { records: [], nextCursor: null, hasMore: false }
        }),
        pushCurrentUserChanges: async () => {
          calls += 1;
          if (calls === 1) return failure("network");
          if (calls === 2) return failure("server");
          return { ok: true };
        }
      }
    });
    const item = await repo.enqueue({
      ownerUserId: USER_A,
      operation: "upsert",
      record: conceptRecord(USER_A, "concept_backoff")
    });
    await scheduler.start();
    expect((await repo.getById(item.id))?.retryCount).toBe(1);
    expect(timers.armed()?.delay).toBe(computeBackoffDelayMs(1));

    now += timers.armed()!.delay;
    await timers.fire();
    const second = await repo.getById(item.id);
    expect(second?.retryCount).toBe(2);
    expect(timers.armed()?.delay).toBe(computeBackoffDelayMs(2));
    expect(second?.nextAttemptAt).toBe(new Date(now + computeBackoffDelayMs(2)).toISOString());

    now += timers.armed()!.delay;
    await timers.fire();
    expect(calls).toBe(3);
    expect(await repo.getById(item.id)).toBeNull();
    expect(timers.armed()).toBeNull();
  });

  it("blocked と fresh processing には timer を張らない", async () => {
    const timers = timerHarness();
    const repo = createSyncQueueRepository();
    const blocked = await repo.enqueue({
      ownerUserId: USER_A,
      operation: "upsert",
      record: conceptRecord(USER_A, "concept_blocked")
    });
    await repo.markBlocked(blocked.id, {
      lastAttemptAt: new Date(T0).toISOString(),
      retryCount: 1,
      errorCode: "conflict",
      lastError: "conflict"
    });
    const processing = await repo.enqueue({
      ownerUserId: USER_A,
      operation: "upsert",
      record: conceptRecord(USER_A, "concept_processing")
    });
    await repo.markProcessing(processing.id, new Date(T0).toISOString());

    let calls = 0;
    const scheduler = createSyncQueueScheduler({
      queue: repo,
      getCurrentUser: async () => ({ id: USER_A }),
      now: () => T0,
      isOnline: () => true,
      setTimer: timers.setTimer,
      clearTimer: timers.clearTimer,
      cloud: {
        pullCurrentUserChanges: async () => ({
          ok: true,
          page: { records: [], nextCursor: null, hasMore: false }
        }),
        pushCurrentUserChanges: async () => {
          calls += 1;
          return { ok: true };
        }
      }
    });
    await scheduler.start();
    expect(calls).toBe(0);
    expect(timers.setCount()).toBe(0);
    expect(await repo.getNextProcessableAt(USER_A)).toBeNull();
  });

  it("offline の retry 時刻では Cloud Port を呼ばず、online 復帰で即時処理する", async () => {
    const timers = timerHarness();
    let online = true;
    let calls = 0;
    const repo = createSyncQueueRepository();
    const cloud: PrivateSyncCloudPort = {
      pullCurrentUserChanges: async () => ({
          ok: true,
          page: { records: [], nextCursor: null, hasMore: false }
        }),
        pushCurrentUserChanges: async () => {
        calls += 1;
        return calls === 1 ? failure("network") : { ok: true };
      }
    };
    let now = T0;
    const integration = createSyncQueueIntegration({
      queue: repo,
      getCurrentUser: async () => ({ id: USER_A }),
      now: () => now,
      isOnline: () => online,
      setTimer: timers.setTimer,
      clearTimer: timers.clearTimer,
      cloud
    });
    const item = await repo.enqueue({
      ownerUserId: USER_A,
      operation: "upsert",
      record: conceptRecord(USER_A, "concept_offline")
    });
    const failed = await integration.start();
    expect(failed.failed).toEqual([item.id]);
    expect(calls).toBe(1);
    expect(timers.armed()?.delay).toBe(computeBackoffDelayMs(1));

    online = false;
    now = T0 + computeBackoffDelayMs(1);
    await timers.fire();
    expect(calls).toBe(1);
    expect(await repo.getById(item.id)).not.toBeNull();

    online = true;
    const resumed = await integration.handleOnline(true);
    expect(resumed.succeeded).toEqual([item.id]);
    expect(calls).toBe(2);
    expect(await repo.getById(item.id)).toBeNull();
    integration.stop();
  });

  it("current owner だけを送り、account switch 後は前 owner を送らない", async () => {
    const timers = timerHarness();
    let current: string | null = USER_A;
    const seen: string[] = [];
    const repo = createSyncQueueRepository();
    const scheduler = createSyncQueueScheduler({
      queue: repo,
      getCurrentUser: async () => (current ? { id: current } : null),
      now: () => T0,
      isOnline: () => true,
      setTimer: timers.setTimer,
      clearTimer: timers.clearTimer,
      cloud: {
        pullCurrentUserChanges: async () => ({
          ok: true,
          page: { records: [], nextCursor: null, hasMore: false }
        }),
        pushCurrentUserChanges: async (changes) => {
          seen.push(...changes.map((change) => change.metadata.ownerUserId));
          return { ok: true };
        }
      }
    });
    await repo.enqueue({ ownerUserId: USER_A, operation: "upsert", record: conceptRecord(USER_A, "concept_a") });
    await repo.enqueue({ ownerUserId: USER_B, operation: "upsert", record: conceptRecord(USER_B, "concept_b") });
    await scheduler.start();
    expect(seen).toEqual([USER_A]);
    expect(await repo.listByOwner(USER_B)).toHaveLength(1);

    const later = await repo.enqueue({
      ownerUserId: USER_A,
      operation: "upsert",
      record: conceptRecord(USER_A, "concept_a2")
    });
    await repo.markFailed(later.id, {
      retryCount: 1,
      lastAttemptAt: new Date(T0).toISOString(),
      nextAttemptAt: new Date(T0 + 5_000).toISOString(),
      errorCode: "network",
      lastError: "network"
    });
    await scheduler.triggerNow();
    expect(timers.armed()?.delay).toBe(5_000);
    current = USER_B;
    await timers.fire();
    expect(seen).toEqual([USER_A, USER_B]);
    expect((await repo.getById(later.id))?.status).toBe("failed");
    scheduler.stop();
  });

  it("未認証では Queue を変えず Cloud を呼ばない", async () => {
    const timers = timerHarness();
    let calls = 0;
    const repo = createSyncQueueRepository();
    const item = await repo.enqueue({
      ownerUserId: USER_A,
      operation: "upsert",
      record: conceptRecord(USER_A, "concept_signed_out")
    });
    const scheduler = createSyncQueueScheduler({
      queue: repo,
      getCurrentUser: async () => null,
      now: () => T0,
      isOnline: () => true,
      setTimer: timers.setTimer,
      clearTimer: timers.clearTimer,
      cloud: {
        pullCurrentUserChanges: async () => ({
          ok: true,
          page: { records: [], nextCursor: null, hasMore: false }
        }),
        pushCurrentUserChanges: async () => {
          calls += 1;
          return { ok: true };
        }
      }
    });
    const report = await scheduler.start();
    expect(report.reason).toBe("unauthenticated");
    expect(calls).toBe(0);
    expect(timers.armed()).toBeNull();
    const stored = await repo.getById(item.id);
    expect(stored?.status).toBe("pending");
    expect(stored?.retryCount).toBe(0);
  });

  it("複数 failed でも timer は最短 nextAttemptAt の1本", async () => {
    const timers = timerHarness();
    const repo = createSyncQueueRepository();
    const early = await repo.enqueue({
      ownerUserId: USER_A,
      operation: "upsert",
      record: conceptRecord(USER_A, "concept_early")
    });
    const late = await repo.enqueue({
      ownerUserId: USER_A,
      operation: "upsert",
      record: conceptRecord(USER_A, "concept_late")
    });
    await repo.markFailed(early.id, {
      retryCount: 1,
      lastAttemptAt: new Date(T0).toISOString(),
      nextAttemptAt: new Date(T0 + 5_000).toISOString(),
      errorCode: "network",
      lastError: "network"
    });
    await repo.markFailed(late.id, {
      retryCount: 2,
      lastAttemptAt: new Date(T0).toISOString(),
      nextAttemptAt: new Date(T0 + 30_000).toISOString(),
      errorCode: "server",
      lastError: "server"
    });
    const scheduler = createSyncQueueScheduler({
      queue: repo,
      getCurrentUser: async () => ({ id: USER_A }),
      now: () => T0,
      isOnline: () => true,
      setTimer: timers.setTimer,
      clearTimer: timers.clearTimer,
      cloud: { pullCurrentUserChanges: async () => ({
          ok: true,
          page: { records: [], nextCursor: null, hasMore: false }
        }),
        pushCurrentUserChanges: async () => ({ ok: true }) }
    });
    await scheduler.start();
    expect(timers.setCount()).toBe(1);
    expect(timers.armed()?.delay).toBe(5_000);
    await scheduler.triggerNow();
    expect(timers.setCount()).toBe(2);
    expect(timers.armed()?.delay).toBe(5_000);
  });

  it("timer・online・manual が重なっても同一 item を重複送信しない", async () => {
    const timers = timerHarness();
    let calls = 0;
    let release: (result: PushCurrentUserResult) => void = () => undefined;
    const repo = createSyncQueueRepository();
    const integration = createSyncQueueIntegration({
      queue: repo,
      getCurrentUser: async () => ({ id: USER_A }),
      now: () => T0,
      isOnline: () => true,
      setTimer: timers.setTimer,
      clearTimer: timers.clearTimer,
      subscribeOnline: () => () => undefined,
      cloud: {
        pullCurrentUserChanges: async () => ({
          ok: true,
          page: { records: [], nextCursor: null, hasMore: false }
        }),
        pushCurrentUserChanges: () => {
          calls += 1;
          return new Promise((resolve) => {
            release = resolve;
          });
        }
      }
    });
    await repo.enqueue({ ownerUserId: USER_A, operation: "upsert", record: conceptRecord(USER_A, "concept_flight") });
    const first = integration.start();
    for (let i = 0; i < 30 && calls === 0; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    const second = integration.handleOnline(true);
    const third = integration.triggerNow();
    expect(calls).toBe(1);
    release({ ok: true });
    await Promise.all([first, second, third]);
    expect(calls).toBe(1);
    expect(await repo.listByOwner(USER_A)).toHaveLength(0);
    integration.stop();
  });

  it("stop で timer と online listener を外し、restart で persisted retry を復元する", async () => {
    const timers = timerHarness();
    let listeners = 0;
    let now = T0;
    let calls = 0;
    const repo = createSyncQueueRepository();
    const integration = createSyncQueueIntegration({
      queue: repo,
      getCurrentUser: async () => ({ id: USER_A }),
      now: () => now,
      isOnline: () => true,
      setTimer: timers.setTimer,
      clearTimer: timers.clearTimer,
      subscribeOnline: () => {
        listeners += 1;
        return () => {
          listeners -= 1;
        };
      },
      cloud: {
        pullCurrentUserChanges: async () => ({
          ok: true,
          page: { records: [], nextCursor: null, hasMore: false }
        }),
        pushCurrentUserChanges: async () => {
          calls += 1;
          return failure("network");
        }
      }
    });
    await repo.enqueue({ ownerUserId: USER_A, operation: "upsert", record: conceptRecord(USER_A, "concept_restart") });
    await integration.start();
    expect(listeners).toBe(1);
    expect(timers.armed()).not.toBeNull();
    const pendingCallback = timers.armed()?.cb;
    integration.stop();
    expect(listeners).toBe(0);
    expect(timers.armed()).toBeNull();
    pendingCallback?.();
    await flush();
    expect(calls).toBe(1);

    await integration.start();
    expect(listeners).toBe(1);
    expect(calls).toBe(1);
    expect(timers.armed()?.delay).toBe(computeBackoffDelayMs(1));
    now = T0 + computeBackoffDelayMs(1);
    await timers.fire();
    expect(calls).toBe(2);
    integration.stop();
    expect(listeners).toBe(0);
  });

  it("enqueue 後の triggerNow で pending を起こす", async () => {
    const timers = timerHarness();
    let calls = 0;
    const repo = createSyncQueueRepository();
    const scheduler = createSyncQueueScheduler({
      queue: repo,
      getCurrentUser: async () => ({ id: USER_A }),
      now: () => T0,
      isOnline: () => true,
      setTimer: timers.setTimer,
      clearTimer: timers.clearTimer,
      cloud: {
        pullCurrentUserChanges: async () => ({
          ok: true,
          page: { records: [], nextCursor: null, hasMore: false }
        }),
        pushCurrentUserChanges: async () => {
          calls += 1;
          return { ok: true };
        }
      }
    });
    await scheduler.start();
    expect(calls).toBe(0);
    await repo.enqueue({ ownerUserId: USER_A, operation: "upsert", record: conceptRecord(USER_A, "concept_wake") });
    await scheduler.triggerNow();
    expect(calls).toBe(1);
  });

  it("非常に先の nextAttemptAt は timer delay を上限で切る", async () => {
    const timers = timerHarness();
    const repo = createSyncQueueRepository();
    const item = await repo.enqueue({
      ownerUserId: USER_A,
      operation: "upsert",
      record: conceptRecord(USER_A, "concept_far")
    });
    await repo.markFailed(item.id, {
      retryCount: 1,
      lastAttemptAt: new Date(T0).toISOString(),
      nextAttemptAt: new Date(T0 + MAX_TIMER_DELAY_MS + 60_000).toISOString(),
      errorCode: "network",
      lastError: "network"
    });
    const scheduler = createSyncQueueScheduler({
      queue: repo,
      getCurrentUser: async () => ({ id: USER_A }),
      now: () => T0,
      isOnline: () => true,
      setTimer: timers.setTimer,
      clearTimer: timers.clearTimer,
      cloud: { pullCurrentUserChanges: async () => ({
          ok: true,
          page: { records: [], nextCursor: null, hasMore: false }
        }),
        pushCurrentUserChanges: async () => ({ ok: true }) }
    });
    await scheduler.start();
    expect(timers.armed()?.delay).toBe(MAX_TIMER_DELAY_MS);
  });
});
