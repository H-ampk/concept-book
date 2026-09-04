import { expect, test, type Page } from "@playwright/test";

type Snapshot = {
  id: string;
  title: string;
  relatedIds: string[];
  updatedAt: string;
};

type RawSeed = {
  id: string;
  title: string;
  relatedIds: string[];
  updatedAt?: string;
};

const relatedOf = (rows: Snapshot[], title: string) =>
  rows.find((row) => row.title === title)?.relatedIds ?? null;

const idOf = (rows: Snapshot[], title: string) => {
  const id = rows.find((row) => row.title === title)?.id;
  if (!id) {
    throw new Error(`missing ${title}`);
  }
  return id;
};

const api = (page: Page) => ({
  list: () =>
    page.evaluate(async () => {
      const e2e = window.__conceptRelationE2e;
      if (!e2e) {
        throw new Error("concept relation e2e API is missing");
      }
      return e2e.list();
    }),
  resetDb: () =>
    page.evaluate(async () => {
      const e2e = window.__conceptRelationE2e;
      if (!e2e) {
        throw new Error("concept relation e2e API is missing");
      }
      return e2e.resetDb();
    }),
  createUntitled: (title: string) =>
    page.evaluate(async (value) => {
      const e2e = window.__conceptRelationE2e;
      if (!e2e) {
        throw new Error("concept relation e2e API is missing");
      }
      return e2e.createUntitled(value);
    }, title),
  addRelated: (fromId: string, toId: string) =>
    page.evaluate(
      async ({ fromId: from, toId: to }) => {
        const e2e = window.__conceptRelationE2e;
        if (!e2e) {
          throw new Error("concept relation e2e API is missing");
        }
        return e2e.addRelated(from, to);
      },
      { fromId, toId }
    ),
  unlinkRelated: (fromId: string, toId: string) =>
    page.evaluate(
      async ({ fromId: from, toId: to }) => {
        const e2e = window.__conceptRelationE2e;
        if (!e2e) {
          throw new Error("concept relation e2e API is missing");
        }
        return e2e.unlinkRelated(from, to);
      },
      { fromId, toId }
    ),
  setRelatedIds: (id: string, relatedIds: string[]) =>
    page.evaluate(
      async ({ id: conceptId, relatedIds: ids }) => {
        const e2e = window.__conceptRelationE2e;
        if (!e2e) {
          throw new Error("concept relation e2e API is missing");
        }
        return e2e.setRelatedIds(conceptId, ids);
      },
      { id, relatedIds }
    ),
  deleteConcept: (id: string) =>
    page.evaluate(async (value) => {
      const e2e = window.__conceptRelationE2e;
      if (!e2e) {
        throw new Error("concept relation e2e API is missing");
      }
      return e2e.deleteConcept(value);
    }, id),
  putRawConcepts: (records: RawSeed[]) =>
    page.evaluate(async (value) => {
      const e2e = window.__conceptRelationE2e;
      if (!e2e) {
        throw new Error("concept relation e2e API is missing");
      }
      return e2e.putRawConcepts(value);
    }, records),
  seedLegacyV6: (records: RawSeed[]) =>
    page.evaluate(async (value) => {
      const e2e = window.__conceptRelationE2e;
      if (!e2e) {
        throw new Error("concept relation e2e API is missing");
      }
      return e2e.seedLegacyV6(value);
    }, records),
  openProductionDb: () =>
    page.evaluate(async () => {
      const e2e = window.__conceptRelationE2e;
      if (!e2e) {
        throw new Error("concept relation e2e API is missing");
      }
      return e2e.openProductionDb();
    }),
  readRawConcepts: () =>
    page.evaluate(async () => {
      const e2e = window.__conceptRelationE2e;
      if (!e2e) {
        throw new Error("concept relation e2e API is missing");
      }
      return e2e.readRawConcepts();
    }),
  mergeImportConcepts: (records: RawSeed[]) =>
    page.evaluate(async (value) => {
      const e2e = window.__conceptRelationE2e;
      if (!e2e) {
        throw new Error("concept relation e2e API is missing");
      }
      return e2e.mergeImportConcepts(value);
    }, records),
  replaceImportConcepts: (records: RawSeed[]) =>
    page.evaluate(async (value) => {
      const e2e = window.__conceptRelationE2e;
      if (!e2e) {
        throw new Error("concept relation e2e API is missing");
      }
      return e2e.replaceImportConcepts(value);
    }, records),
  zipReplaceRoundtrip: () =>
    page.evaluate(async () => {
      const e2e = window.__conceptRelationE2e;
      if (!e2e) {
        throw new Error("concept relation e2e API is missing");
      }
      return e2e.zipReplaceRoundtrip();
    })
});

test.describe.configure({ mode: "serial" });

test.describe("relatedIds IndexedDB storage regressions (#140)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/?e2eConceptRelations=1");
    await expect(page.getByTestId("concept-relations-e2e-ready")).toHaveText("ready");
    await api(page).resetDb();
  });

  test("A から B を追加すると A↔B になり reload 後も維持される", async ({ page }) => {
    const e2e = api(page);
    await e2e.createUntitled("A");
    await e2e.createUntitled("B");
    let rows = await e2e.list();
    await e2e.addRelated(idOf(rows, "A"), idOf(rows, "B"));
    rows = await e2e.list();
    expect(relatedOf(rows, "A")).toEqual([idOf(rows, "B")]);
    expect(relatedOf(rows, "B")).toEqual([idOf(rows, "A")]);

    await page.reload();
    await expect(page.getByTestId("concept-relations-e2e-ready")).toHaveText("ready");
    rows = await e2e.list();
    expect(relatedOf(rows, "A")).toEqual([idOf(rows, "B")]);
    expect(relatedOf(rows, "B")).toEqual([idOf(rows, "A")]);
  });

  test("unlink すると双方から消え reload 後も解除が維持される", async ({ page }) => {
    const e2e = api(page);
    await e2e.createUntitled("A");
    await e2e.createUntitled("B");
    let rows = await e2e.list();
    await e2e.addRelated(idOf(rows, "A"), idOf(rows, "B"));
    await e2e.unlinkRelated(idOf(rows, "A"), idOf(rows, "B"));
    rows = await e2e.list();
    expect(relatedOf(rows, "A")).toEqual([]);
    expect(relatedOf(rows, "B")).toEqual([]);

    await page.reload();
    await expect(page.getByTestId("concept-relations-e2e-ready")).toHaveText("ready");
    rows = await e2e.list();
    expect(relatedOf(rows, "A")).toEqual([]);
    expect(relatedOf(rows, "B")).toEqual([]);
  });

  test("Concept 削除後に相手側へ dangling ID が残らない", async ({ page }) => {
    const e2e = api(page);
    await e2e.createUntitled("A");
    await e2e.createUntitled("B");
    let rows = await e2e.list();
    const bId = idOf(rows, "B");
    await e2e.addRelated(idOf(rows, "A"), bId);
    await e2e.deleteConcept(bId);
    rows = await e2e.list();
    expect(rows.map((row) => row.title)).toEqual(["A"]);
    expect(relatedOf(rows, "A")).toEqual([]);
  });

  test("update 経路で自己参照・重複・空ID・欠落IDが保存されない", async ({ page }) => {
    const e2e = api(page);
    await e2e.createUntitled("A");
    await e2e.createUntitled("B");
    let rows = await e2e.list();
    const aId = idOf(rows, "A");
    const bId = idOf(rows, "B");

    await e2e.setRelatedIds(aId, [aId, bId, bId, bId, "", "   "]);
    rows = await e2e.list();
    expect(relatedOf(rows, "A")).toEqual([bId]);
    expect(relatedOf(rows, "B")).toEqual([aId]);

    await e2e.setRelatedIds(aId, ["missing-concept"]);
    rows = await e2e.list();
    expect(relatedOf(rows, "A")).toEqual([]);
    expect(relatedOf(rows, "B")).toEqual([]);
  });

  test("旧データの一方向関係と不正IDが getAll 修復で正規化される", async ({ page }) => {
    const e2e = api(page);
    await e2e.putRawConcepts([
      {
        id: "legacy-a",
        title: "A",
        relatedIds: ["legacy-a", "legacy-b", "legacy-b", "", "   ", "missing-concept"],
        updatedAt: "2020-01-01T00:00:00.000Z"
      },
      {
        id: "legacy-b",
        title: "B",
        relatedIds: [],
        updatedAt: "2020-01-01T00:00:00.000Z"
      }
    ]);
    const rows = await e2e.list();
    expect(relatedOf(rows, "A")).toEqual(["legacy-b"]);
    expect(relatedOf(rows, "B")).toEqual(["legacy-a"]);
    expect(rows.find((row) => row.title === "A")?.updatedAt).toBe("2020-01-01T00:00:00.000Z");
    expect(rows.find((row) => row.title === "B")?.updatedAt).toBe("2020-01-01T00:00:00.000Z");

    const raw = await e2e.readRawConcepts();
    expect(relatedOf(raw, "A")).toEqual(["legacy-b"]);
    expect(relatedOf(raw, "B")).toEqual(["legacy-a"]);
    expect(raw.find((row) => row.title === "A")?.updatedAt).toBe("2020-01-01T00:00:00.000Z");
  });

  test("merge import で既存 DB の Concept への関連が双方向に統合される", async ({ page }) => {
    const e2e = api(page);
    const existing = await e2e.createUntitled("A");
    await e2e.mergeImportConcepts([
      {
        id: "imported-c",
        title: "C",
        relatedIds: [existing.id]
      }
    ]);
    const rows = await e2e.list();
    expect(relatedOf(rows, "A")).toEqual(["imported-c"]);
    expect(relatedOf(rows, "C")).toEqual([existing.id]);
  });

  test("replace import 後も関係整合性が保たれる", async ({ page }) => {
    const e2e = api(page);
    await e2e.createUntitled("stale");
    await e2e.replaceImportConcepts([
      {
        id: "rep-a",
        title: "A",
        relatedIds: ["rep-a", "rep-b", "rep-b", "missing-concept", ""]
      },
      {
        id: "rep-b",
        title: "B",
        relatedIds: []
      }
    ]);
    const rows = await e2e.list();
    expect(rows.map((row) => row.title).sort()).toEqual(["A", "B"]);
    expect(relatedOf(rows, "A")).toEqual(["rep-b"]);
    expect(relatedOf(rows, "B")).toEqual(["rep-a"]);
  });

  test("ZIP restore 後も双方向関係が維持される", async ({ page }) => {
    const e2e = api(page);
    await e2e.createUntitled("A");
    await e2e.createUntitled("B");
    let rows = await e2e.list();
    await e2e.addRelated(idOf(rows, "A"), idOf(rows, "B"));
    await e2e.zipReplaceRoundtrip();
    rows = await e2e.list();
    expect(relatedOf(rows, "A")).toEqual([idOf(rows, "B")]);
    expect(relatedOf(rows, "B")).toEqual([idOf(rows, "A")]);
  });

  test("DB_VERSION 6 からの upgrade で片方向関係を修復し updatedAt を維持する", async ({ page }) => {
    const e2e = api(page);
    await e2e.seedLegacyV6([
      {
        id: "v6-a",
        title: "A",
        relatedIds: ["v6-a", "v6-b", "v6-b", "", "missing-concept"],
        updatedAt: "2019-06-01T00:00:00.000Z"
      },
      {
        id: "v6-b",
        title: "B",
        relatedIds: [],
        updatedAt: "2019-06-01T00:00:00.000Z"
      }
    ]);
    const opened = await e2e.openProductionDb();
    expect(opened.dbVersion).toBe(7);

    const raw = await e2e.readRawConcepts();
    expect(relatedOf(raw, "A")).toEqual(["v6-b"]);
    expect(relatedOf(raw, "B")).toEqual(["v6-a"]);
    expect(raw.find((row) => row.title === "A")?.relatedIds).not.toContain("v6-a");
    expect(raw.find((row) => row.title === "A")?.relatedIds).not.toContain("missing-concept");
    expect(raw.find((row) => row.title === "A")?.relatedIds).not.toContain("");
    expect(raw.find((row) => row.title === "A")?.updatedAt).toBe("2019-06-01T00:00:00.000Z");
    expect(raw.find((row) => row.title === "B")?.updatedAt).toBe("2019-06-01T00:00:00.000Z");
  });
});
