import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createEmptyConceptInput, type Concept } from "../types/concept";
import { PREREQUISITE_CYCLE_SAVE_ERROR } from "../utils/conceptPrerequisites";
import { IndexedDBStorage, sanitizeConcept } from "./indexeddb";

const iso = "2026-01-01T00:00:00.000Z";

const concept = (id: string, extras: Partial<Concept> = {}): Concept => ({
  ...createEmptyConceptInput(),
  id,
  title: extras.title ?? id,
  createdAt: iso,
  updatedAt: iso,
  ...extras
});

const deleteDb = (): Promise<void> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase("concept-book-db");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });

const byId = (concepts: Concept[], id: string): Concept | undefined =>
  concepts.find((item) => item.id === id);

describe("sanitizeConcept prerequisites", () => {
  it("missing prerequisiteIds を [] にし、legacy relatedIds はコピーしない", () => {
    const { concept: normalized, migrated } = sanitizeConcept({
      id: "A",
      title: "A",
      relatedIds: ["B"]
    });
    expect(normalized.prerequisiteIds).toEqual([]);
    expect(normalized.relatedIds).toEqual(["B"]);
    expect(migrated).toBe(true);
  });

  it("trim / 空 / 重複 / self を除去する", () => {
    const { concept: normalized } = sanitizeConcept({
      id: "A",
      title: "A",
      prerequisiteIds: [" B ", "B", "", "A"]
    });
    expect(normalized.prerequisiteIds).toEqual(["B"]);
  });
});

describe("IndexedDBStorage prerequisites", () => {
  let storage: IndexedDBStorage;

  beforeEach(async () => {
    await deleteDb();
    storage = new IndexedDBStorage();
  });

  afterEach(async () => {
    await deleteDb();
  });

  it("update は B.prerequisiteIds だけを変え、A 側 relatedIds / prerequisiteIds を触らない", async () => {
    await storage.importConcepts(
      [
        concept("A", { relatedIds: ["B"] }),
        concept("B", { relatedIds: ["A"] })
      ],
      "replace"
    );
    const updated = await storage.updateConcept("B", { prerequisiteIds: ["A"] });
    expect(updated?.prerequisiteIds).toEqual(["A"]);
    expect(updated?.relatedIds).toEqual(["A"]);

    const all = await storage.getAllConcepts();
    expect(byId(all, "A")?.relatedIds).toEqual(["B"]);
    expect(byId(all, "A")?.prerequisiteIds).toEqual([]);
    expect(byId(all, "B")?.relatedIds).toEqual(["A"]);
    expect(byId(all, "B")?.prerequisiteIds).toEqual(["A"]);
  });

  it("cycle になる update は保存せずエラーにする", async () => {
    await storage.importConcepts(
      [
        concept("A"),
        concept("B", { prerequisiteIds: ["A"] }),
        concept("C", { prerequisiteIds: ["B"] })
      ],
      "replace"
    );
    await expect(storage.updateConcept("A", { prerequisiteIds: ["C"] })).rejects.toThrow(
      PREREQUISITE_CYCLE_SAVE_ERROR
    );
    const all = await storage.getAllConcepts();
    expect(byId(all, "A")?.prerequisiteIds).toEqual([]);
  });

  it("Concept 削除で incoming / outgoing prerequisite を残さない", async () => {
    await storage.importConcepts(
      [
        concept("A", { relatedIds: ["B"] }),
        concept("B", { relatedIds: ["A", "C"], prerequisiteIds: ["A"] }),
        concept("C", { relatedIds: ["B"], prerequisiteIds: ["B"] })
      ],
      "replace"
    );
    await storage.deleteConcept("B");
    const all = await storage.getAllConcepts();
    expect(all.map((item) => item.id).sort()).toEqual(["A", "C"]);
    expect(byId(all, "A")?.prerequisiteIds).toEqual([]);
    expect(byId(all, "C")?.prerequisiteIds).toEqual([]);
    expect(byId(all, "A")?.relatedIds).toEqual([]);
    expect(byId(all, "C")?.relatedIds).toEqual([]);
  });

  it("relatedIds と prerequisiteIds を独立に保持し、prerequisite 削除で relatedIds を残す", async () => {
    await storage.importConcepts(
      [
        concept("A", { relatedIds: ["B"] }),
        concept("B", { relatedIds: ["A"], prerequisiteIds: ["A"] })
      ],
      "replace"
    );
    await storage.updateConcept("B", { prerequisiteIds: [] });
    const all = await storage.getAllConcepts();
    expect(byId(all, "A")?.relatedIds).toEqual(["B"]);
    expect(byId(all, "B")?.relatedIds).toEqual(["A"]);
    expect(byId(all, "B")?.prerequisiteIds).toEqual([]);
    expect(byId(all, "A")?.prerequisiteIds).toEqual([]);
  });

  it("backup JSON round-trip で A → B → C が維持される", async () => {
    await storage.importConcepts(
      [concept("A"), concept("B", { prerequisiteIds: ["A"] }), concept("C", { prerequisiteIds: ["B"] })],
      "replace"
    );
    const exported = await storage.exportBackupData();
    await storage.importBackupData(
      {
        ...exported,
        quizQuestionParseSkipped: 0,
        quizDeckParseSkipped: 0,
        quizAttemptLogParseSkipped: 0
      },
      "replace"
    );
    const all = await storage.getAllConcepts();
    expect(byId(all, "B")?.prerequisiteIds).toEqual(["A"]);
    expect(byId(all, "C")?.prerequisiteIds).toEqual(["B"]);
  });

  it("legacy IndexedDB record は getAll で prerequisiteIds: [] に正規化される", async () => {
    await storage.importConcepts([concept("A", { relatedIds: ["B"] }), concept("B")], "replace");
    const raw = indexedDB.open("concept-book-db");
    await new Promise<void>((resolve, reject) => {
      raw.onsuccess = () => {
        const db = raw.result;
        const tx = db.transaction("concepts", "readwrite");
        const store = tx.objectStore("concepts");
        const getReq = store.get("A");
        getReq.onsuccess = () => {
          const record = { ...(getReq.result as Record<string, unknown>) };
          delete record.prerequisiteIds;
          store.put(record);
        };
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      raw.onerror = () => reject(raw.error);
    });

    const all = await storage.getAllConcepts();
    expect(byId(all, "A")?.prerequisiteIds).toEqual([]);
    expect(byId(all, "A")?.relatedIds).toEqual(["B"]);
  });

  it("import の self / orphan / duplicate を除去し、cycle は保存しない", async () => {
    await storage.importConcepts(
      [concept("keep", { notes: "original" })],
      "replace"
    );

    const cleaned = await storage.importConcepts(
      [
        concept("A", { prerequisiteIds: ["A", "A", "missing", "B"] }),
        concept("B", { prerequisiteIds: ["B"] })
      ],
      "replace"
    );
    expect(cleaned.imported).toBe(2);
    const afterClean = await storage.getAllConcepts();
    expect(byId(afterClean, "A")?.prerequisiteIds).toEqual(["B"]);
    expect(byId(afterClean, "B")?.prerequisiteIds).toEqual([]);
    expect(byId(afterClean, "keep")).toBeUndefined();

    await storage.importConcepts(
      [concept("seed", { notes: "before-cycle" })],
      "replace"
    );
    await expect(
      storage.importConcepts(
        [
          concept("A", { prerequisiteIds: ["C"] }),
          concept("B", { prerequisiteIds: ["A"] }),
          concept("C", { prerequisiteIds: ["B"] })
        ],
        "replace"
      )
    ).rejects.toThrow(/前提概念に循環があるためインポートできません/);

    const afterCycle = await storage.getAllConcepts();
    expect(afterCycle.map((item) => item.id)).toEqual(["seed"]);
    expect(byId(afterCycle, "A")).toBeUndefined();
  });

  it("createConcept は self / orphan を保存せず relatedIds へ自動追加しない", async () => {
    await storage.importConcepts([concept("A")], "replace");
    const created = await storage.createConcept({
      ...createEmptyConceptInput(),
      title: "B",
      prerequisiteIds: ["A", "A", "missing"],
      relatedIds: []
    });
    expect(created.prerequisiteIds).toEqual(["A"]);
    expect(created.relatedIds).toEqual([]);
    const all = await storage.getAllConcepts();
    expect(byId(all, "A")?.relatedIds).toEqual([]);
    expect(byId(all, "A")?.prerequisiteIds).toEqual([]);
  });
});
