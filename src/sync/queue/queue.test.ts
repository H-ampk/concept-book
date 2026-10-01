import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { CONCEPT_BOOK_DB_NAME, CONCEPT_BOOK_DB_VERSION } from "../../storage/indexeddb";
import { toConceptSyncRecord, toQuizAttemptLogSyncRecord } from "../adapters";
import { sampleConcept, sampleQuizAttemptLog } from "../fixtures";
import { computeBackoffDelayMs } from "./backoff";
import { createSyncQueueIntegration } from "./integration";
import { SyncQueueProcessor } from "./processor";
import { createSyncQueueRepository } from "./repository";
import type { PrivateSyncCloudPort, PushCurrentUserResult, SyncPushFailure } from "./types";

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

const conceptRecord = (ownerUserId: string, version: number, id = "concept_existing_keep") =>
  toConceptSyncRecord({
    data: { ...sampleConcept(), id, updatedAt: "2026-03-01T12:00:00.000Z" },
    ownerUserId,
    version
  });

const logRecord = (ownerUserId: string, id: string) =>
  toQuizAttemptLogSyncRecord({
    data: { ...sampleQuizAttemptLog(), id },
    ownerUserId
  });

const failure = (kind: SyncPushFailure["kind"], message = kind): PushCurrentUserResult => ({
  ok: false,
  failure: { kind, code: kind, message }
});

const port = (impl: PrivateSyncCloudPort["pushCurrentUserChanges"]): PrivateSyncCloudPort => ({
  pushCurrentUserChanges: impl
});

describe("sync queue repository", () => {
  it("enqueue でき、DB を開き直しても残り、成功で消え、失敗では残る", async () => {
    const repo = createSyncQueueRepository();
    const item = await repo.enqueue({
      ownerUserId: USER_A,
      operation: "upsert",
      record: conceptRecord(USER_A, 1),
      now: "2026-04-01T00:00:00.000Z"
    });
    const reopened = createSyncQueueRepository();
    expect((await reopened.getById(item.id))?.entityId).toBe("concept_existing_keep");

    await reopened.markSucceeded(item.id);
    expect(await reopened.getById(item.id)).toBeNull();

    const again = await reopened.enqueue({
      ownerUserId: USER_A,
      operation: "upsert",
      record: conceptRecord(USER_A, 2)
    });
    await reopened.markFailed(again.id, {
      retryCount: 1,
      lastAttemptAt: "2026-04-01T00:00:01.000Z",
      nextAttemptAt: "2026-04-01T00:00:06.000Z",
      errorCode: "network",
      lastError: "offline"
    });
    const stored = await reopened.getById(again.id);
    expect(stored?.status).toBe("failed");
    expect(stored?.retryCount).toBe(1);
  });

  it("旧 version から upgrade しても既存 concept が残り queue store が増える", async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(CONCEPT_BOOK_DB_NAME, CONCEPT_BOOK_DB_VERSION - 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("concepts")) {
          db.createObjectStore("concepts", { keyPath: "id" });
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction("concepts", "readwrite");
        tx.objectStore("concepts").put({ id: "kept", title: "残る" });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      request.onerror = () => reject(request.error);
    });

    const repo = createSyncQueueRepository();
    await repo.enqueue({
      ownerUserId: USER_A,
      operation: "delete",
      record: conceptRecord(USER_A, 1)
    });

    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(CONCEPT_BOOK_DB_NAME);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    expect(db.objectStoreNames.contains("syncQueue")).toBe(true);
    const kept = await new Promise<{ title: string }>((resolve, reject) => {
      const tx = db.transaction("concepts", "readonly");
      const request = tx.objectStore("concepts").get("kept");
      request.onsuccess = () => resolve(request.result as { title: string });
      request.onerror = () => reject(request.error);
    });
    db.close();
    expect(kept.title).toBe("残る");
    const queued = await repo.listByOwner(USER_A);
    expect(queued[0]?.operation).toBe("delete");
  });

  it("versioned upsert は未送信分を最新 snapshot に統合し、processing は残す", async () => {
    const repo = createSyncQueueRepository();
    const first = await repo.enqueue({
      ownerUserId: USER_A,
      operation: "upsert",
      record: conceptRecord(USER_A, 3)
    });
    await repo.enqueue({
      ownerUserId: USER_A,
      operation: "upsert",
      record: conceptRecord(USER_A, 4)
    });
    const latest = await repo.enqueue({
      ownerUserId: USER_A,
      operation: "upsert",
      record: conceptRecord(USER_A, 5)
    });
    const items = await repo.listByOwner(USER_A);
    expect(items).toHaveLength(1);
    expect(items[0]?.id).toBe(first.id);
    expect(latest.snapshot.metadata.version).toBe(5);

    await repo.markProcessing(items[0]!.id, "2026-04-01T00:00:00.000Z");
    await repo.enqueue({
      ownerUserId: USER_A,
      operation: "upsert",
      record: conceptRecord(USER_A, 6)
    });
    const after = await repo.listByOwner(USER_A);
    expect(after).toHaveLength(2);
    expect(after.find((item) => item.status === "processing")?.snapshot.metadata.version).toBe(5);
    expect(after.find((item) => item.status === "pending")?.snapshot.metadata.version).toBe(6);
  });

  it("append-only は ID ごとに独立し、同一 ID は二重登録しない", async () => {
    const repo = createSyncQueueRepository();
    const a = await repo.enqueue({
      ownerUserId: USER_A,
      operation: "upsert",
      record: logRecord(USER_A, "qlog_a")
    });
    const aAgain = await repo.enqueue({
      ownerUserId: USER_A,
      operation: "upsert",
      record: logRecord(USER_A, "qlog_a")
    });
    await repo.enqueue({
      ownerUserId: USER_A,
      operation: "upsert",
      record: logRecord(USER_A, "qlog_b")
    });
    const items = await repo.listByOwner(USER_A);
    expect(aAgain.id).toBe(a.id);
    expect(items.map((item) => item.entityId).sort()).toEqual(["qlog_a", "qlog_b"]);
  });

  it("localOnly setting は enqueue できない", async () => {
    const repo = createSyncQueueRepository();
    const record = {
      ...conceptRecord(USER_A, 1),
      entityType: "setting",
      strategy: "versioned",
      id: "aiSettings",
      data: { key: "aiSettings", value: { endpoint: "http://localhost" } }
    };
    await expect(
      repo.enqueue({ ownerUserId: USER_A, operation: "upsert", record: record as never })
    ).rejects.toThrow();
    expect(await repo.listByOwner(USER_A)).toHaveLength(0);
  });

  it("summary は owner ごとに数える", async () => {
    const repo = createSyncQueueRepository();
    const pending = await repo.enqueue({
      ownerUserId: USER_A,
      operation: "upsert",
      record: conceptRecord(USER_A, 1, "concept_a")
    });
    await repo.markProcessing(pending.id, "2026-04-01T00:00:00.000Z");
    const failed = await repo.enqueue({
      ownerUserId: USER_A,
      operation: "upsert",
      record: conceptRecord(USER_A, 1, "concept_b")
    });
    await repo.markFailed(failed.id, {
      retryCount: 1,
      lastAttemptAt: "2026-04-01T00:00:00.000Z",
      nextAttemptAt: "2026-04-01T00:00:05.000Z",
      errorCode: "network",
      lastError: "offline"
    });
    const blocked = await repo.enqueue({
      ownerUserId: USER_A,
      operation: "upsert",
      record: conceptRecord(USER_A, 1, "concept_c")
    });
    await repo.markBlocked(blocked.id, {
      lastAttemptAt: "2026-04-01T00:00:00.000Z",
      retryCount: 1,
      errorCode: "conflict",
      lastError: "version conflict"
    });
    await repo.enqueue({
      ownerUserId: USER_A,
      operation: "upsert",
      record: conceptRecord(USER_A, 1, "concept_d")
    });
    await repo.enqueue({
      ownerUserId: USER_B,
      operation: "upsert",
      record: conceptRecord(USER_B, 1, "concept_e")
    });

    expect(await repo.getSummary(USER_A)).toEqual({
      pending: 1,
      processing: 1,
      failed: 1,
      blocked: 1,
      total: 4
    });
    expect(await repo.getSummary(USER_B)).toEqual({
      pending: 1,
      processing: 0,
      failed: 0,
      blocked: 0,
      total: 1
    });
  });
});

describe("sync queue processor", () => {
  const setup = (userId: string | null, cloud: PrivateSyncCloudPort, nowMs = T0) => {
    const repo = createSyncQueueRepository();
    let clock = nowMs;
    const processor = new SyncQueueProcessor({
      queue: repo,
      cloud,
      getCurrentUser: async () => (userId ? { id: userId } : null),
      now: () => clock
    });
    return {
      repo,
      processor,
      setNow: (value: number) => {
        clock = value;
      }
    };
  };

  it("現在の owner だけ送り、別ユーザーの status は変えない", async () => {
    const sent: string[] = [];
    const { repo, processor } = setup(
      USER_B,
      port(async (changes) => {
        sent.push(changes[0]!.id);
        return { ok: true };
      })
    );
    await repo.enqueue({ ownerUserId: USER_A, operation: "upsert", record: conceptRecord(USER_A, 1, "concept_a") });
    await repo.enqueue({ ownerUserId: USER_A, operation: "upsert", record: conceptRecord(USER_A, 1, "concept_a2") });
    await repo.enqueue({ ownerUserId: USER_A, operation: "upsert", record: conceptRecord(USER_A, 1, "concept_a3") });
    await repo.enqueue({ ownerUserId: USER_B, operation: "upsert", record: conceptRecord(USER_B, 1, "concept_b") });
    await repo.enqueue({ ownerUserId: USER_B, operation: "upsert", record: conceptRecord(USER_B, 1, "concept_b2") });

    const report = await processor.processQueue();
    expect(report.succeeded).toHaveLength(2);
    expect(sent.sort()).toEqual(["concept_b", "concept_b2"]);
    const userA = await repo.listByOwner(USER_A);
    expect(userA).toHaveLength(3);
    expect(userA.every((item) => item.status === "pending")).toBe(true);
    expect(await repo.listByOwner(USER_B)).toHaveLength(0);
  });

  it("未ログインでは送信せず、ログアウト相当でも queue は残る", async () => {
    let calls = 0;
    const { repo, processor } = setup(
      null,
      port(async () => {
        calls += 1;
        return { ok: true };
      })
    );
    await repo.enqueue({ ownerUserId: USER_A, operation: "upsert", record: conceptRecord(USER_A, 1) });
    const report = await processor.processQueue();
    expect(report.ran).toBe(false);
    expect(report.reason).toBe("unauthenticated");
    expect(calls).toBe(0);
    expect(await repo.listByOwner(USER_A)).toHaveLength(1);
  });

  it("一時失敗は failed と backoff になり、時刻前は再送せず、経過後に再送する", async () => {
    let calls = 0;
    const { repo, processor, setNow } = setup(
      USER_A,
      port(async () => {
        calls += 1;
        return calls === 1 ? failure("timeout", "timed out") : { ok: true };
      })
    );
    await repo.enqueue({ ownerUserId: USER_A, operation: "upsert", record: conceptRecord(USER_A, 1) });
    await processor.processQueue();
    const failed = (await repo.listByOwner(USER_A))[0]!;
    expect(failed.status).toBe("failed");
    expect(failed.retryCount).toBe(1);
    expect(failed.nextAttemptAt).toBe(new Date(T0 + computeBackoffDelayMs(1)).toISOString());

    await processor.processQueue();
    expect(calls).toBe(1);

    setNow(T0 + computeBackoffDelayMs(1));
    await processor.processQueue();
    expect(calls).toBe(2);
    expect(await repo.listByOwner(USER_A)).toHaveLength(0);
  });

  it("backoff は段階的に増え、上限で頭打ちになる", () => {
    const first = computeBackoffDelayMs(1);
    const second = computeBackoffDelayMs(2);
    const third = computeBackoffDelayMs(3);
    const capped = computeBackoffDelayMs(20);
    expect(first).toBeLessThan(second);
    expect(second).toBeLessThan(third);
    expect(third).toBeGreaterThanOrEqual(60_000);
    expect(capped).toBe(900_000);
    expect(first).toBeGreaterThanOrEqual(5_000);
  });

  it("conflict / validation / permission は blocked になり再送しない", async () => {
    for (const kind of ["conflict", "validation", "permission", "auth"] as const) {
      await deleteDb();
      let calls = 0;
      const { repo, processor, setNow } = setup(
        USER_A,
        port(async () => {
          calls += 1;
          return failure(kind, `Bearer secret-token ${kind}`);
        })
      );
      await repo.enqueue({ ownerUserId: USER_A, operation: "upsert", record: conceptRecord(USER_A, 1) });
      await processor.processQueue();
      const item = (await repo.listByOwner(USER_A))[0]!;
      expect(item.status).toBe("blocked");
      expect(item.lastError).not.toContain("secret-token");
      expect(item.lastError).toContain("[redacted]");
      setNow(T0 + 86_400_000);
      await processor.processQueue();
      expect(calls).toBe(1);
    }
  });

  it("同時の processQueue は同じ item を二度送らない", async () => {
    let calls = 0;
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { repo, processor } = setup(
      USER_A,
      port(async () => {
        calls += 1;
        await gate;
        return { ok: true };
      })
    );
    await repo.enqueue({ ownerUserId: USER_A, operation: "upsert", record: conceptRecord(USER_A, 1) });
    const first = processor.processQueue();
    const second = processor.processQueue();
    expect(second).toBe(first);
    release();
    await first;
    expect(calls).toBe(1);
  });

  it("一件の blocked が他の item を止めない", async () => {
    const { repo, processor } = setup(
      USER_A,
      port(async (changes) => (changes[0]?.id === "concept_bad" ? failure("validation", "bad") : { ok: true }))
    );
    await repo.enqueue({ ownerUserId: USER_A, operation: "upsert", record: conceptRecord(USER_A, 1, "concept_ok") });
    await repo.enqueue({
      ownerUserId: USER_A,
      operation: "upsert",
      record: conceptRecord(USER_A, 1, "concept_bad")
    });
    await repo.enqueue({
      ownerUserId: USER_A,
      operation: "upsert",
      record: conceptRecord(USER_A, 1, "concept_later")
    });
    const report = await processor.processQueue();
    expect(report.succeeded).toHaveLength(2);
    expect(report.blocked).toHaveLength(1);
    const left = await repo.listByOwner(USER_A);
    expect(left.map((item) => item.entityId)).toEqual(["concept_bad"]);
  });

  it("stale な processing は再送し、fresh な processing は触らない", async () => {
    let calls = 0;
    const stale = setup(
      USER_A,
      port(async () => {
        calls += 1;
        return { ok: true };
      })
    );
    const staleItem = await stale.repo.enqueue({
      ownerUserId: USER_A,
      operation: "upsert",
      record: conceptRecord(USER_A, 1)
    });
    await stale.repo.markProcessing(staleItem.id, "2020-01-01T00:00:00.000Z");
    await stale.processor.processQueue();
    expect(calls).toBe(1);

    calls = 0;
    await deleteDb();
    const fresh = setup(
      USER_A,
      port(async () => {
        calls += 1;
        return { ok: true };
      }),
      T0
    );
    const freshItem = await fresh.repo.enqueue({
      ownerUserId: USER_A,
      operation: "upsert",
      record: conceptRecord(USER_A, 1)
    });
    await fresh.repo.markProcessing(freshItem.id, new Date(T0).toISOString());
    await fresh.processor.processQueue();
    expect(calls).toBe(0);
    expect((await fresh.repo.getById(freshItem.id))?.status).toBe("processing");
  });

  it("online 復帰と起動は Port の結果だけを成功にし、オフラインでは送らない", async () => {
    let calls = 0;
    const repo = createSyncQueueRepository();
    const integration = createSyncQueueIntegration({
      queue: repo,
      getCurrentUser: async () => ({ id: USER_A }),
      now: () => T0,
      cloud: port(async () => {
        calls += 1;
        return failure("network", "still down");
      })
    });
    await repo.enqueue({ ownerUserId: USER_A, operation: "upsert", record: conceptRecord(USER_A, 1) });
    const offline = await integration.handleOnline(false);
    expect(offline.ran).toBe(false);
    expect(calls).toBe(0);

    const online = await integration.handleOnline(true);
    expect(online.failed).toHaveLength(1);
    expect(await repo.listByOwner(USER_A)).toHaveLength(1);

    const started = await integration.resumeOnAppStart();
    expect(started.ran).toBe(true);
    expect(calls).toBe(1);
  });
});
