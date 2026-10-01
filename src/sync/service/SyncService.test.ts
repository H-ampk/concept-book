import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { CONCEPT_BOOK_DB_NAME, CONCEPT_BOOK_DB_VERSION, openConceptBookDatabase } from "../../storage/indexeddb";
import { toConceptSyncRecord } from "../adapters";
import { sampleConcept } from "../fixtures";
import type { PrivateSyncRecord } from "../types";
import { SyncQueueProcessor } from "../queue/processor";
import { createSyncQueueRepository } from "../queue/repository";
import type { PrivateSyncCloudPort, PullCurrentUserPage, SyncQueueStatus } from "../queue/types";
import { PrivateSyncService } from "./SyncService";
import { createSyncStateRepository } from "./state";
import type { LocalPrivateSyncPort } from "./types";

const USER_A = "user-a";
const USER_B = "user-b";
const NOW = Date.parse("2026-05-01T00:00:00.000Z");

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

const concept = (ownerUserId: string, id: string, version = 1): PrivateSyncRecord =>
  toConceptSyncRecord({
    data: { ...sampleConcept(), id, updatedAt: "2026-03-01T12:00:00.000Z" },
    ownerUserId,
    version
  });

class MemoryLocal implements LocalPrivateSyncPort {
  applied: PrivateSyncRecord[] = [];
  failOnId: string | null = null;

  async applyRemoteRecord(record: PrivateSyncRecord): Promise<void> {
    if (this.failOnId && record.id === this.failOnId) {
      throw new Error("local write failed");
    }
    this.applied.push(record);
  }
}

const page = (records: unknown[], nextCursor: string | null, hasMore: boolean): PullCurrentUserPage => ({
  records,
  nextCursor,
  hasMore
});

const createHarness = (options?: {
  userId?: string | null;
  pages?: PullCurrentUserPage[];
  online?: boolean;
  local?: MemoryLocal;
}) => {
  const local = options?.local ?? new MemoryLocal();
  const pages = [...(options?.pages ?? [page([], "cursor-1", false)])];
  let pullCalls = 0;
  let pushCalls = 0;
  const order: string[] = [];
  const cloud: PrivateSyncCloudPort = {
    async pullCurrentUserChanges() {
      pullCalls += 1;
      order.push("pull");
      const next = pages.shift();
      if (!next) {
        return { ok: true, page: page([], null, false) };
      }
      return { ok: true, page: next };
    },
    async pushCurrentUserChanges() {
      pushCalls += 1;
      order.push("push");
      return { ok: true };
    }
  };
  const queue = createSyncQueueRepository();
  const state = createSyncStateRepository();
  const service = new PrivateSyncService({
    cloud,
    local,
    queue,
    state,
    getCurrentUser: async () => (options?.userId === null ? null : { id: options?.userId ?? USER_A }),
    now: () => NOW,
    isOnline: () => options?.online !== false,
    processor: new SyncQueueProcessor({
      queue,
      cloud,
      getCurrentUser: async () => (options?.userId === null ? null : { id: options?.userId ?? USER_A }),
      now: () => NOW
    })
  });
  return { service, local, cloud, queue, state, pullCalls: () => pullCalls, pushCalls: () => pushCalls, order };
};

const enqueue = async (
  queue: ReturnType<typeof createSyncQueueRepository>,
  status: SyncQueueStatus,
  id = "concept_local"
) => {
  const item = await queue.enqueue({
    ownerUserId: USER_A,
    operation: "upsert",
    record: concept(USER_A, id, 6)
  });
  if (status === "pending") {
    return item;
  }
  if (status === "failed") {
    return queue.markFailed(item.id, {
      retryCount: 1,
      lastAttemptAt: "2026-04-01T00:00:00.000Z",
      nextAttemptAt: "2099-01-01T00:00:00.000Z",
      errorCode: "network",
      lastError: "retry"
    });
  }
  if (status === "processing") {
    return queue.markProcessing(item.id, "2026-04-01T00:00:00.000Z");
  }
  return queue.markBlocked(item.id, {
    lastAttemptAt: "2026-04-01T00:00:00.000Z",
    retryCount: 1,
    errorCode: "conflict",
    lastError: "conflict"
  });
};

describe("PrivateSyncService pull", () => {
  it("valid な current user の record を local へ apply する", async () => {
    const harness = createHarness({
      pages: [page([concept(USER_A, "concept_a"), concept(USER_A, "concept_b")], "c1", false)]
    });
    const result = await harness.service.sync();
    expect(result.pull.outcome).toBe("completed");
    expect(result.pull.report.applied).toBe(2);
    expect(harness.local.applied.map((record) => record.id)).toEqual(["concept_a", "concept_b"]);
    expect(result.push).not.toBeNull();
    expect(harness.order[0]).toBe("pull");
  });

  it("invalid record を隔離し、前後の valid は apply する", async () => {
    const harness = createHarness({
      pages: [page([concept(USER_A, "concept_a"), { nope: true }, concept(USER_A, "concept_c")], "c1", false)]
    });
    const result = await harness.service.sync();
    expect(result.pull.outcome).toBe("completed");
    expect(harness.local.applied.map((record) => record.id)).toEqual(["concept_a", "concept_c"]);
    expect(result.pull.report.rejected).toBe(1);
    expect(result.pull.report.applied).toBe(2);
  });

  it("owner 不一致は apply せず、owner を書き換えない", async () => {
    const foreign = concept(USER_B, "concept_foreign");
    const harness = createHarness({
      pages: [page([concept(USER_A, "concept_a"), foreign, concept(USER_A, "concept_c")], "c1", false)]
    });
    const result = await harness.service.sync();
    expect(harness.local.applied.map((record) => record.id)).toEqual(["concept_a", "concept_c"]);
    expect(harness.local.applied.every((record) => record.metadata.ownerUserId === USER_A)).toBe(true);
    expect(result.pull.report.rejectedRecords.some((note) => note.code === "owner_mismatch")).toBe(true);
    expect(foreign.metadata.ownerUserId).toBe(USER_B);
  });

  it.each(["pending", "failed", "processing", "blocked"] as const)(
    "同 entity の queue が %s なら remote を apply しない",
    async (status) => {
      const harness = createHarness({
        pages: [page([concept(USER_A, "concept_local", 7)], "c1", false)]
      });
      await enqueue(harness.queue, status);
      const result = await harness.service.sync();
      expect(harness.local.applied).toHaveLength(0);
      expect(result.pull.report.deferred).toBe(1);
      expect(result.pull.report.deferredRecords[0]?.reason).toBe(status);
    }
  );

  it("別 entity の queue があっても対象外の remote は apply する", async () => {
    const harness = createHarness({
      pages: [page([concept(USER_A, "concept_other")], "c1", false)]
    });
    await enqueue(harness.queue, "pending", "concept_local");
    const result = await harness.service.sync();
    expect(harness.local.applied.map((record) => record.id)).toEqual(["concept_other"]);
    expect(result.pull.report.deferred).toBe(0);
  });

  it("page 完了後にだけ cursor を保存し、次の sync はその cursor から読む", async () => {
    const seen: Array<string | null> = [];
    const local = new MemoryLocal();
    const queue = createSyncQueueRepository();
    const state = createSyncStateRepository();
    let pullCalls = 0;
    const cloud: PrivateSyncCloudPort = {
      async pullCurrentUserChanges(cursor) {
        seen.push(cursor);
        pullCalls += 1;
        if (pullCalls === 1) {
          return { ok: true, page: page([concept(USER_A, "concept_a")], "cursor-a", false) };
        }
        return { ok: true, page: page([], "cursor-b", false) };
      },
      async pushCurrentUserChanges() {
        return { ok: true };
      }
    };
    const deps = {
      cloud,
      local,
      queue,
      state,
      getCurrentUser: async () => ({ id: USER_A }),
      now: () => NOW,
      isOnline: () => true
    };
    await new PrivateSyncService(deps).sync();
    expect(await state.getState(USER_A)).toMatchObject({ cursor: "cursor-a" });
    await new PrivateSyncService(deps).sync();
    expect(seen).toEqual([null, "cursor-a"]);
    expect((await state.getState(USER_A)).cursor).toBe("cursor-b");
  });

  it("owner ごとに cursor を分ける", async () => {
    const state = createSyncStateRepository();
    const queue = createSyncQueueRepository();
    const cloudFor = (cursor: string): PrivateSyncCloudPort => ({
      pullCurrentUserChanges: async () => ({ ok: true, page: page([], cursor, false) }),
      pushCurrentUserChanges: async () => ({ ok: true })
    });
    await new PrivateSyncService({
      cloud: cloudFor("cursor-a"),
      local: new MemoryLocal(),
      queue,
      state,
      getCurrentUser: async () => ({ id: USER_A }),
      now: () => NOW,
      isOnline: () => true
    }).sync();
    await new PrivateSyncService({
      cloud: cloudFor("cursor-b"),
      local: new MemoryLocal(),
      queue,
      state,
      getCurrentUser: async () => ({ id: USER_B }),
      now: () => NOW,
      isOnline: () => true
    }).sync();
    expect((await state.getState(USER_A)).cursor).toBe("cursor-a");
    expect((await state.getState(USER_B)).cursor).toBe("cursor-b");
  });

  it("local apply が失敗したら cursor と成功時刻を進めない", async () => {
    const local = new MemoryLocal();
    local.failOnId = "concept_b";
    const harness = createHarness({
      local,
      pages: [page([concept(USER_A, "concept_a"), concept(USER_A, "concept_b")], "c-next", false)]
    });
    await harness.state.setLastSuccessfulSyncAt(USER_A, "2026-01-01T00:00:00.000Z");
    const result = await harness.service.sync();
    expect(result.pull.outcome).toBe("failed");
    expect(result.pull.report.partial).toBe(true);
    expect(result.pull.report.applied).toBe(1);
    expect(result.pull.report.cursorCommitted).toBe(false);
    expect(result.push).toBeNull();
    expect((await harness.state.getState(USER_A)).cursor).toBeNull();
    expect((await harness.state.getState(USER_A)).lastSuccessfulSyncAt).toBe("2026-01-01T00:00:00.000Z");
    expect(harness.service.getState().status).toBe("error");
  });

  it("hasMore のまま cursor が変わらなければ失敗し、繰り返さない", async () => {
    let calls = 0;
    const cloud: PrivateSyncCloudPort = {
      async pullCurrentUserChanges() {
        calls += 1;
        return { ok: true, page: page([concept(USER_A, "concept_a")], "same", true) };
      },
      async pushCurrentUserChanges() {
        return { ok: true };
      }
    };
    const state = createSyncStateRepository();
    await state.setCursor(USER_A, "same");
    const service = new PrivateSyncService({
      cloud,
      local: new MemoryLocal(),
      queue: createSyncQueueRepository(),
      state,
      getCurrentUser: async () => ({ id: USER_A }),
      now: () => NOW,
      isOnline: () => true
    });
    const result = await service.sync();
    expect(result.pull.outcome).toBe("failed");
    expect(result.pull.report.failure?.code).toBe("cursor_stalled");
    expect(calls).toBe(1);
    expect((await state.getState(USER_A)).cursor).toBe("same");
    expect((await state.getState(USER_A)).lastSuccessfulSyncAt).toBeNull();
  });

  it("未認証では cloud を呼ばず cursor も成功時刻も変えない", async () => {
    const harness = createHarness({ userId: null });
    await harness.state.setCursor(USER_A, "keep");
    await harness.state.setLastSuccessfulSyncAt(USER_A, "2026-01-01T00:00:00.000Z");
    const result = await harness.service.sync();
    expect(result.pull.reason).toBe("unauthenticated");
    expect(harness.pullCalls()).toBe(0);
    expect(harness.pushCalls()).toBe(0);
    expect((await harness.state.getState(USER_A)).cursor).toBe("keep");
    expect((await harness.state.getState(USER_A)).lastSuccessfulSyncAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("cloud auth 失敗では local を消さず cursor も成功時刻も進めない", async () => {
    const local = new MemoryLocal();
    local.applied.push(concept(USER_A, "already"));
    const cloud: PrivateSyncCloudPort = {
      async pullCurrentUserChanges() {
        return { ok: false, failure: { kind: "auth", code: "unauthenticated", message: "session missing" } };
      },
      async pushCurrentUserChanges() {
        return { ok: true };
      }
    };
    const state = createSyncStateRepository();
    await state.setLastSuccessfulSyncAt(USER_A, "2026-01-01T00:00:00.000Z");
    const service = new PrivateSyncService({
      cloud,
      local,
      queue: createSyncQueueRepository(),
      state,
      getCurrentUser: async () => ({ id: USER_A }),
      now: () => NOW,
      isOnline: () => true
    });
    const result = await service.sync();
    expect(result.pull.report.failure?.kind).toBe("auth");
    expect(result.pull.report.cursorCommitted).toBe(false);
    expect(local.applied).toHaveLength(1);
    expect((await state.getState(USER_A)).lastSuccessfulSyncAt).toBe("2026-01-01T00:00:00.000Z");
    expect(result.push).toBeNull();
  });

  it("同時 sync は pull を1回だけ行う", async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let calls = 0;
    const cloud: PrivateSyncCloudPort = {
      async pullCurrentUserChanges() {
        calls += 1;
        await gate;
        return { ok: true, page: page([], "c1", false) };
      },
      async pushCurrentUserChanges() {
        return { ok: true };
      }
    };
    const service = new PrivateSyncService({
      cloud,
      local: new MemoryLocal(),
      queue: createSyncQueueRepository(),
      state: createSyncStateRepository(),
      getCurrentUser: async () => ({ id: USER_A }),
      now: () => NOW,
      isOnline: () => true
    });
    const first = service.sync();
    const second = service.sync();
    expect(second).toBe(first);
    release();
    await Promise.all([first, second]);
    expect(calls).toBe(1);
    expect(service.getState().status).toBe("idle");
  });

  it("正常完了のときだけ lastSuccessfulSyncAt を更新する", async () => {
    const harness = createHarness({ pages: [page([concept(USER_A, "concept_a")], "c1", false)] });
    await harness.service.sync();
    expect((await harness.state.getState(USER_A)).lastSuccessfulSyncAt).toBe("2026-05-01T00:00:00.000Z");
  });

  it("offline では pull も push もしない", async () => {
    const harness = createHarness({ online: false, pages: [page([concept(USER_A, "concept_a")], "c1", false)] });
    const result = await harness.service.sync();
    expect(result.status).toBe("offline");
    expect(harness.pullCalls()).toBe(0);
    expect(harness.pushCalls()).toBe(0);
    expect(harness.local.applied).toHaveLength(0);
  });

  it("複数 page を順に処理し、cursor を最後まで進める", async () => {
    const harness = createHarness({
      pages: [
        page([concept(USER_A, "concept_a")], "c1", true),
        page([concept(USER_A, "concept_b")], "c2", false)
      ]
    });
    const result = await harness.service.sync();
    expect(harness.local.applied.map((record) => record.id)).toEqual(["concept_a", "concept_b"]);
    expect((await harness.state.getState(USER_A)).cursor).toBe("c2");
    expect(result.pull.report.applied).toBe(2);
    expect(harness.pullCalls()).toBe(2);
  });

  it("deletedAt は tombstone として deferred し、物理削除しない", async () => {
    const tombstone = concept(USER_A, "concept_gone");
    tombstone.metadata.deletedAt = "2026-04-02T00:00:00.000Z";
    const harness = createHarness({
      pages: [page([tombstone, concept(USER_A, "concept_keep")], "c1", false)]
    });
    const result = await harness.service.sync();
    expect(harness.local.applied.map((record) => record.id)).toEqual(["concept_keep"]);
    expect(result.pull.report.deferredRecords[0]?.reason).toBe("tombstone");
    expect((await harness.state.getState(USER_A)).cursor).toBe("c1");
  });

  it("cursor null の初回 pull を受け付ける", async () => {
    const seen: Array<string | null> = [];
    const cloud: PrivateSyncCloudPort = {
      async pullCurrentUserChanges(cursor) {
        seen.push(cursor);
        return { ok: true, page: page([], "first", false) };
      },
      async pushCurrentUserChanges() {
        return { ok: true };
      }
    };
    const service = new PrivateSyncService({
      cloud,
      local: new MemoryLocal(),
      queue: createSyncQueueRepository(),
      state: createSyncStateRepository(),
      getCurrentUser: async () => ({ id: USER_A }),
      now: () => NOW,
      isOnline: () => true
    });
    await service.sync();
    expect(seen).toEqual([null]);
  });

  it("sync 中は status が syncing になる", async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let observed: string | null = null;
    const cloud: PrivateSyncCloudPort = {
      async pullCurrentUserChanges() {
        observed = service.getState().status;
        await gate;
        return { ok: true, page: page([], null, false) };
      },
      async pushCurrentUserChanges() {
        return { ok: true };
      }
    };
    const service = new PrivateSyncService({
      cloud,
      local: new MemoryLocal(),
      queue: createSyncQueueRepository(),
      state: createSyncStateRepository(),
      getCurrentUser: async () => ({ id: USER_A }),
      now: () => NOW,
      isOnline: () => true
    });
    const pending = service.sync();
    release();
    await pending;
    expect(observed).toBe("syncing");
  });
});

describe("sync state migration", () => {
  it("version 10 から upgrade しても concept と sync queue が残る", async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(CONCEPT_BOOK_DB_NAME, CONCEPT_BOOK_DB_VERSION - 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("concepts")) {
          db.createObjectStore("concepts", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("syncQueue")) {
          db.createObjectStore("syncQueue", { keyPath: "id" });
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction(["concepts", "syncQueue"], "readwrite");
        tx.objectStore("concepts").put({ id: "kept", title: "残る" });
        tx.objectStore("syncQueue").put({
          id: "syncq_kept",
          ownerUserId: USER_A,
          entityType: "concept",
          entityId: "kept",
          operation: "upsert",
          status: "pending",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          retryCount: 0,
          snapshot: concept(USER_A, "kept")
        });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      request.onerror = () => reject(request.error);
    });

    const db = await openConceptBookDatabase();
    expect(db.version).toBe(CONCEPT_BOOK_DB_VERSION);
    expect(db.objectStoreNames.contains("syncState")).toBe(true);
    const keptConcept = await new Promise<{ title: string }>((resolve, reject) => {
      const tx = db.transaction("concepts", "readonly");
      const request = tx.objectStore("concepts").get("kept");
      request.onsuccess = () => resolve(request.result as { title: string });
      request.onerror = () => reject(request.error);
    });
    const keptQueue = await new Promise<{ entityId: string }>((resolve, reject) => {
      const tx = db.transaction("syncQueue", "readonly");
      const request = tx.objectStore("syncQueue").get("syncq_kept");
      request.onsuccess = () => resolve(request.result as { entityId: string });
      request.onerror = () => reject(request.error);
    });
    db.close();
    expect(keptConcept.title).toBe("残る");
    expect(keptQueue.entityId).toBe("kept");

    const state = createSyncStateRepository();
    await state.setCursor(USER_A, "after-upgrade");
    expect((await state.getState(USER_A)).cursor).toBe("after-upgrade");
    expect((await state.getState(USER_B)).cursor).toBeNull();
  });
});
