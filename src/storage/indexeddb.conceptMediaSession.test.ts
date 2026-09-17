import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyConceptInput, type Concept } from "../types/concept";
import type { ConceptMediaCommitItem, MediaRecord } from "../types/media";
import { IndexedDBStorage } from "./indexeddb";

const pngBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const pngFile = (name = "pic.png"): File => new File([pngBytes], name, { type: "image/png" });

const deleteDb = (): Promise<void> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase("concept-book-db");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });

const getAllMediaRecords = async (): Promise<MediaRecord[]> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open("concept-book-db");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction("media", "readonly");
      const getAll = tx.objectStore("media").getAll();
      getAll.onerror = () => {
        db.close();
        reject(getAll.error);
      };
      getAll.onsuccess = () => {
        const rows = getAll.result as MediaRecord[];
        db.close();
        resolve(rows);
      };
    };
  });

const inputOf = (overrides: Partial<Concept> = {}) => ({
  ...createEmptyConceptInput(),
  title: "A",
  definition: "定義",
  ...overrides
});

describe("indexeddb concept media session (#199)", () => {
  let storage: IndexedDBStorage;

  beforeEach(async () => {
    await deleteDb();
    storage = new IndexedDBStorage();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("edit 正常保存: 並び替え・caption・delete・new・本文を同一 commit", async () => {
    const created = await storage.createConcept(inputOf({ title: "A" }));
    const m1 = await storage.addMedia({ conceptId: created.id, file: pngFile("m1.png"), caption: "old1" });
    const m2 = await storage.addMedia({ conceptId: created.id, file: pngFile("m2.png"), caption: "old2" });
    const m3 = await storage.addMedia({ conceptId: created.id, file: pngFile("m3.png") });

    const media: ConceptMediaCommitItem[] = [
      { type: "existing", mediaId: m3.id },
      { type: "existing", mediaId: m1.id, caption: "new1" },
      { type: "new", file: pngFile("m4.png") }
    ];
    const saved = await storage.saveConceptWithMediaDraft({
      mode: "edit",
      conceptId: created.id,
      input: { ...inputOf({ title: "A-updated", definition: "新しい定義" }) },
      media
    });

    expect(saved.title).toBe("A-updated");
    expect(saved.definition).toBe("新しい定義");
    expect(saved.media?.map((item) => item.id)).toEqual([
      m3.id,
      m1.id,
      saved.media?.[2]?.id
    ]);
    expect(saved.media?.map((item) => item.sortOrder)).toEqual([0, 1, 2]);
    expect(saved.media?.[1]?.caption).toBe("new1");

    const records = await getAllMediaRecords();
    const byId = new Map(records.map((row) => [row.id, row]));
    expect(byId.get(m1.id)?.caption).toBe("new1");
    expect(byId.has(m2.id)).toBe(false);
    expect(byId.has(m3.id)).toBe(true);
    expect(saved.media?.[2] && byId.has(saved.media[2].id)).toBe(true);
    expect(await storage.getMediaBlob(m2.id)).toBeUndefined();
  });

  it("Concept update failure では本文も media も完全 rollback", async () => {
    const created = await storage.createConcept(inputOf({ title: "old-title" }));
    const m1 = await storage.addMedia({
      conceptId: created.id,
      file: pngFile("m1.png"),
      caption: "old1"
    });
    const originalPut = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (this: IDBObjectStore, value, key) {
      if (
        this.name === "concepts" &&
        value &&
        typeof value === "object" &&
        "id" in value &&
        (value as { id: string }).id === created.id
      ) {
        throw new Error("injected concept put failure");
      }
      return originalPut.call(this, value, key);
    });

    await expect(
      storage.saveConceptWithMediaDraft({
        mode: "edit",
        conceptId: created.id,
        input: { ...inputOf({ title: "new-title" }) },
        media: [
          { type: "existing", mediaId: m1.id, caption: "new1" },
          { type: "new", file: pngFile("m2.png") }
        ]
      })
    ).rejects.toThrow("injected concept put failure");

    const after = await storage.getConceptById(created.id);
    expect(after?.title).toBe("old-title");
    expect(after?.media?.map((item) => item.id)).toEqual([m1.id]);
    const records = await getAllMediaRecords();
    expect(records).toHaveLength(1);
    expect(records[0]?.caption).toBe("old1");
  });

  it("delete 後の failure でも blob と metadata が残る", async () => {
    const created = await storage.createConcept(inputOf());
    const m1 = await storage.addMedia({ conceptId: created.id, file: pngFile("m1.png") });
    let conceptPuts = 0;
    const originalPut = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (this: IDBObjectStore, value, key) {
      if (
        this.name === "concepts" &&
        value &&
        typeof value === "object" &&
        "id" in value &&
        (value as { id: string }).id === created.id
      ) {
        conceptPuts += 1;
        if (conceptPuts >= 2) {
          throw new Error("injected late concept put failure");
        }
      }
      return originalPut.call(this, value, key);
    });

    await expect(
      storage.saveConceptWithMediaDraft({
        mode: "edit",
        conceptId: created.id,
        input: inputOf(),
        media: []
      })
    ).rejects.toThrow("injected late concept put failure");

    const after = await storage.getConceptById(created.id);
    expect(after?.media?.map((item) => item.id)).toEqual([m1.id]);
    expect(await storage.getMediaBlob(m1.id)).toBeDefined();
  });

  it("create の 2件目 media add 失敗では Concept / media / related が残らない", async () => {
    const peer = await storage.createConcept(inputOf({ title: "peer" }));
    let mediaAdds = 0;
    const originalAdd = IDBObjectStore.prototype.add;
    vi.spyOn(IDBObjectStore.prototype, "add").mockImplementation(function (this: IDBObjectStore, value, key) {
      if (this.name === "media") {
        mediaAdds += 1;
        if (mediaAdds >= 2) {
          throw new Error("injected second media add failure");
        }
      }
      return originalAdd.call(this, value, key);
    });

    await expect(
      storage.saveConceptWithMediaDraft({
        mode: "create",
        input: inputOf({ title: "C", relatedIds: [peer.id] }),
        media: [
          { type: "new", file: pngFile("m1.png") },
          { type: "new", file: pngFile("m2.png") }
        ]
      })
    ).rejects.toThrow("injected second media add failure");

    const concepts = await storage.getAllConcepts();
    expect(concepts.map((item) => item.title).sort()).toEqual(["peer"]);
    expect(await getAllMediaRecords()).toEqual([]);
    const refreshedPeer = await storage.getConceptById(peer.id);
    expect(refreshedPeer?.relatedIds ?? []).toEqual([]);
  });

  it("create failure のあと injection 解除で retry すると1 Concept + 2 media だけ残る", async () => {
    let mediaAdds = 0;
    const originalAdd = IDBObjectStore.prototype.add;
    const spy = vi.spyOn(IDBObjectStore.prototype, "add").mockImplementation(function (
      this: IDBObjectStore,
      value,
      key
    ) {
      if (this.name === "media") {
        mediaAdds += 1;
        if (mediaAdds >= 2) {
          throw new Error("injected second media add failure");
        }
      }
      return originalAdd.call(this, value, key);
    });

    const draft: ConceptMediaCommitItem[] = [
      { type: "new", file: pngFile("m1.png") },
      { type: "new", file: pngFile("m2.png") }
    ];
    await expect(
      storage.saveConceptWithMediaDraft({
        mode: "create",
        input: inputOf({ title: "C" }),
        media: draft
      })
    ).rejects.toThrow("injected second media add failure");

    spy.mockRestore();
    const saved = await storage.saveConceptWithMediaDraft({
      mode: "create",
      input: inputOf({ title: "C" }),
      media: draft
    });
    expect((await storage.getAllConcepts()).filter((item) => item.title === "C")).toHaveLength(1);
    expect(saved.media).toHaveLength(2);
    expect(await getAllMediaRecords()).toHaveLength(2);
    expect(new Set(saved.media?.map((item) => item.id)).size).toBe(2);
  });

  it("reorder + Save failure + retry で最終 sortOrder が canonical", async () => {
    const created = await storage.createConcept(inputOf());
    const m1 = await storage.addMedia({ conceptId: created.id, file: pngFile("m1.png") });
    const m2 = await storage.addMedia({ conceptId: created.id, file: pngFile("m2.png") });
    const m3 = await storage.addMedia({ conceptId: created.id, file: pngFile("m3.png") });
    const reordered: ConceptMediaCommitItem[] = [
      { type: "existing", mediaId: m3.id },
      { type: "existing", mediaId: m1.id },
      { type: "existing", mediaId: m2.id }
    ];

    const originalPut = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (this: IDBObjectStore, value, key) {
      if (
        this.name === "concepts" &&
        value &&
        typeof value === "object" &&
        "id" in value &&
        (value as { id: string }).id === created.id
      ) {
        throw new Error("injected reorder save failure");
      }
      return originalPut.call(this, value, key);
    });

    await expect(
      storage.saveConceptWithMediaDraft({
        mode: "edit",
        conceptId: created.id,
        input: inputOf(),
        media: reordered
      })
    ).rejects.toThrow("injected reorder save failure");

    expect((await storage.getConceptById(created.id))?.media?.map((item) => item.id)).toEqual([
      m1.id,
      m2.id,
      m3.id
    ]);

    vi.restoreAllMocks();
    const saved = await storage.saveConceptWithMediaDraft({
      mode: "edit",
      conceptId: created.id,
      input: inputOf(),
      media: reordered
    });
    expect(saved.media?.map((item) => item.id)).toEqual([m3.id, m1.id, m2.id]);
    expect(saved.media?.map((item) => item.sortOrder)).toEqual([0, 1, 2]);
  });

  it("media なしの create/edit が成功する", async () => {
    const created = await storage.saveConceptWithMediaDraft({
      mode: "create",
      input: inputOf({ title: "plain" }),
      media: []
    });
    expect(created.media).toBeUndefined();
    const updated = await storage.saveConceptWithMediaDraft({
      mode: "edit",
      conceptId: created.id,
      input: { ...inputOf({ title: "plain-2" }) },
      media: []
    });
    expect(updated.title).toBe("plain-2");
    expect(updated.media).toBeUndefined();
  });

  it("既存 media を変更しない edit では blob / caption / order が変わらない", async () => {
    const created = await storage.createConcept(inputOf({ title: "keep" }));
    const m1 = await storage.addMedia({
      conceptId: created.id,
      file: pngFile("keep.png"),
      caption: "cap"
    });
    const beforeBlob = await storage.getMediaBlob(m1.id);
    const updated = await storage.saveConceptWithMediaDraft({
      mode: "edit",
      conceptId: created.id,
      input: { ...inputOf({ title: "keep-2" }) },
      media: [{ type: "existing", mediaId: m1.id, caption: "cap" }]
    });
    expect(updated.title).toBe("keep-2");
    expect(updated.media?.[0]).toMatchObject({ id: m1.id, caption: "cap", sortOrder: 0 });
    const afterBlob = await storage.getMediaBlob(m1.id);
    expect(afterBlob?.size).toBe(beforeBlob?.size);
    const records = await getAllMediaRecords();
    expect(records[0]?.caption).toBe("cap");
  });

  it("stale existing media は silent loss せず reject する", async () => {
    const created = await storage.createConcept(inputOf());
    await storage.addMedia({ conceptId: created.id, file: pngFile("m1.png") });
    await expect(
      storage.saveConceptWithMediaDraft({
        mode: "edit",
        conceptId: created.id,
        input: inputOf(),
        media: [{ type: "existing", mediaId: "missing-media" }]
      })
    ).rejects.toThrow("メディアが別の操作で変更されています。再度開いてください。");
  });

  it("既存 addMedia / deleteMedia / updateMediaCaption は引き続き動く", async () => {
    const created = await storage.createConcept(inputOf());
    const ref = await storage.addMedia({ conceptId: created.id, file: pngFile("legacy.png") });
    await storage.updateMediaCaption(ref.id, "legacy-cap");
    const afterCaption = await storage.getConceptById(created.id);
    expect(afterCaption?.media?.[0]?.caption).toBe("legacy-cap");
    await storage.deleteMedia(ref.id);
    expect((await storage.getConceptById(created.id))?.media).toBeUndefined();
    expect(await storage.getMediaBlob(ref.id)).toBeUndefined();
  });

  it("edit で provenance と relatedIds を維持する", async () => {
    const peer = await storage.createConcept(inputOf({ title: "peer" }));
    const created = await storage.createConcept(
      inputOf({
        title: "src",
        relatedIds: [peer.id],
        sourceContextCardId: "card-1",
        autoGenerated: true,
        sourceContextCardTermKey: "ai"
      })
    );
    const saved = await storage.saveConceptWithMediaDraft({
      mode: "edit",
      conceptId: created.id,
      input: {
        ...inputOf({
          title: "src-2",
          relatedIds: [peer.id],
          sourceContextCardId: "card-1",
          autoGenerated: true,
          sourceContextCardTermKey: "ai"
        })
      },
      media: []
    });
    expect(saved.sourceContextCardId).toBe("card-1");
    expect(saved.autoGenerated).toBe(true);
    expect(saved.sourceContextCardTermKey).toBe("ai");
    expect(saved.relatedIds).toEqual([peer.id]);
    expect((await storage.getConceptById(peer.id))?.relatedIds).toEqual([created.id]);
  });
});
