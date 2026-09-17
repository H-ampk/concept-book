import { describe, expect, it } from "vitest";
import { createEmptyConceptInput, type Concept } from "../types/concept";
import {
  buildConceptPrerequisiteIndex,
  findPrerequisiteCycle,
  normalizePrerequisiteIdList,
  planConceptPrerequisiteImport,
  PREREQUISITE_CYCLE_SAVE_ERROR,
  resolvePrerequisiteIdsForUpdate,
  wouldCreatePrerequisiteCycle
} from "./conceptPrerequisites";

const concept = (id: string, extras: Partial<Concept> = {}): Concept => ({
  ...createEmptyConceptInput(),
  id,
  title: extras.title ?? id,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...extras
});

describe("normalizePrerequisiteIdList", () => {
  it("trim・重複・空・self を除き元の順を維持する", () => {
    expect(
      normalizePrerequisiteIdList([" B ", "B", "", "A"], { selfId: "A" })
    ).toEqual(["B"]);
  });

  it("existingIds 指定時は orphan を除く", () => {
    expect(
      normalizePrerequisiteIdList(["B", "missing"], {
        selfId: "A",
        existingIds: new Set(["A", "B"])
      })
    ).toEqual(["B"]);
  });

  it("undefined は空配列にする", () => {
    expect(normalizePrerequisiteIdList(undefined, { selfId: "A" })).toEqual([]);
  });
});

describe("buildConceptPrerequisiteIndex", () => {
  it("A → B / A → C / B → D の index を構築する", () => {
    const concepts = [
      concept("A"),
      concept("B", { prerequisiteIds: ["A"] }),
      concept("C", { prerequisiteIds: ["A"] }),
      concept("D", { prerequisiteIds: ["B"] })
    ];
    const index = buildConceptPrerequisiteIndex(concepts);

    expect(index.prerequisitesByConceptId.get("B")).toEqual(["A"]);
    expect(index.prerequisitesByConceptId.get("C")).toEqual(["A"]);
    expect(index.prerequisitesByConceptId.get("D")).toEqual(["B"]);
    expect(index.dependentsByConceptId.get("A")).toEqual(["B", "C"]);
    expect(index.dependentsByConceptId.get("B")).toEqual(["D"]);
    expect(index.dependentsByConceptId.get("C")).toEqual([]);
    expect(index.dependentsByConceptId.get("D")).toEqual([]);
  });
});

describe("findPrerequisiteCycle / wouldCreatePrerequisiteCycle", () => {
  it("A → B → C に C → A を足すと cycle", () => {
    const concepts = [
      concept("A"),
      concept("B", { prerequisiteIds: ["A"] }),
      concept("C", { prerequisiteIds: ["B"] })
    ];
    expect(findPrerequisiteCycle(concepts)).toBeNull();
    expect(
      wouldCreatePrerequisiteCycle(buildConceptPrerequisiteIndex(concepts), "C", "A")
    ).toBe(true);
    expect(
      findPrerequisiteCycle([
        concept("A", { prerequisiteIds: ["C"] }),
        concept("B", { prerequisiteIds: ["A"] }),
        concept("C", { prerequisiteIds: ["B"] })
      ])
    ).toEqual(["A", "B", "C", "A"]);
  });

  it("A → B に B → A を足すと cycle", () => {
    const concepts = [concept("A"), concept("B", { prerequisiteIds: ["A"] })];
    expect(wouldCreatePrerequisiteCycle(buildConceptPrerequisiteIndex(concepts), "B", "A")).toBe(
      true
    );
    expect(
      findPrerequisiteCycle([
        concept("A", { prerequisiteIds: ["B"] }),
        concept("B", { prerequisiteIds: ["A"] })
      ])
    ).toEqual(["A", "B", "A"]);
  });

  it("self A → A は cycle とみなし、正規化では保存しない", () => {
    expect(wouldCreatePrerequisiteCycle(buildConceptPrerequisiteIndex([concept("A")]), "A", "A")).toBe(
      true
    );
    expect(normalizePrerequisiteIdList(["A"], { selfId: "A" })).toEqual([]);
    expect(findPrerequisiteCycle([concept("A", { prerequisiteIds: ["A"] })])).toBeNull();
  });

  it("diamond は cycle ではない", () => {
    const diamond = [
      concept("A"),
      concept("B", { prerequisiteIds: ["A"] }),
      concept("C", { prerequisiteIds: ["A"] }),
      concept("D", { prerequisiteIds: ["B", "C"] })
    ];
    expect(findPrerequisiteCycle(diamond)).toBeNull();
  });

  it("10,000 ノードの acyclic chain で stack overflow せず null を返す", () => {
    const nodeCount = 10_000;
    const concepts = Array.from({ length: nodeCount }, (_, index) =>
      concept(`C${index}`, index === 0 ? {} : { prerequisiteIds: [`C${index - 1}`] })
    );
    expect(findPrerequisiteCycle(concepts)).toBeNull();
  });

  it("10,000 ノードの deep cycle を検出し path の両端が一致する", () => {
    const nodeCount = 10_000;
    const lastId = `C${nodeCount - 1}`;
    const concepts = Array.from({ length: nodeCount }, (_, index) => {
      if (index === 0) {
        return concept("C0", { prerequisiteIds: [lastId] });
      }
      return concept(`C${index}`, { prerequisiteIds: [`C${index - 1}`] });
    });
    const cycle = findPrerequisiteCycle(concepts);
    expect(cycle).not.toBeNull();
    expect(cycle?.[0]).toBe("C0");
    expect(cycle?.at(-1)).toBe(cycle?.[0]);
    expect(cycle?.length).toBeGreaterThan(2);
  });
});

describe("resolvePrerequisiteIdsForUpdate", () => {
  it("B の prerequisite を A に設定でき、A 側は変更しない", () => {
    const concepts = [concept("A", { relatedIds: ["B"] }), concept("B", { relatedIds: ["A"] })];
    const prerequisiteIds = resolvePrerequisiteIdsForUpdate(concepts, "B", ["A"]);
    expect(prerequisiteIds).toEqual(["A"]);
    expect(concepts.find((item) => item.id === "A")?.relatedIds).toEqual(["B"]);
    expect(concepts.find((item) => item.id === "A")?.prerequisiteIds).toEqual([]);
  });

  it("cycle になる更新は拒否する", () => {
    const concepts = [
      concept("A"),
      concept("B", { prerequisiteIds: ["A"] }),
      concept("C", { prerequisiteIds: ["B"] })
    ];
    expect(() => resolvePrerequisiteIdsForUpdate(concepts, "A", ["C"])).toThrow(
      PREREQUISITE_CYCLE_SAVE_ERROR
    );
  });
});

describe("planConceptPrerequisiteImport", () => {
  it("self / duplicate / orphan を除去し cycle は拒否する", () => {
    const incoming = [
      concept("A", { prerequisiteIds: [" A ", "A", "A", "missing"] }),
      concept("B", { prerequisiteIds: ["A", "A"] })
    ];
    const planned = planConceptPrerequisiteImport([], incoming, "replace");
    expect(planned.find((item) => item.id === "A")?.prerequisiteIds).toEqual([]);
    expect(planned.find((item) => item.id === "B")?.prerequisiteIds).toEqual(["A"]);
  });

  it("cycle import は保存前に拒否する", () => {
    const incoming = [
      concept("A", { prerequisiteIds: ["C"] }),
      concept("B", { prerequisiteIds: ["A"] }),
      concept("C", { prerequisiteIds: ["B"] })
    ];
    expect(() => planConceptPrerequisiteImport([], incoming, "replace")).toThrow(
      /前提概念に循環があるためインポートできません/
    );
  });

  it("legacy relatedIds を prerequisite に変換しない", () => {
    const incoming = [concept("A", { relatedIds: ["B"] }), concept("B", { relatedIds: ["A"] })];
    const planned = planConceptPrerequisiteImport([], incoming, "replace");
    expect(planned.find((item) => item.id === "A")?.prerequisiteIds).toEqual([]);
    expect(planned.find((item) => item.id === "B")?.prerequisiteIds).toEqual([]);
    expect(planned.find((item) => item.id === "A")?.relatedIds).toEqual(["B"]);
  });

  it("merge で import が新しいとき本体は import、local-only 定義は残す", () => {
    const t1 = "2026-01-01T00:00:00.000Z";
    const t2 = "2026-02-01T00:00:00.000Z";
    const existing = [
      concept("A", {
        title: "local",
        definition: "local-def",
        updatedAt: t1,
        contextDefinitions: [
          { id: "D1", context: "local", definition: "local D1" },
          { id: "D2", context: "local", definition: "local D2" }
        ]
      })
    ];
    const incoming = [
      concept("A", {
        title: "import",
        definition: "import-def",
        updatedAt: t2,
        contextDefinitions: [{ id: "D1", context: "import", definition: "import D1" }]
      })
    ];
    const planned = planConceptPrerequisiteImport(existing, incoming, "merge");
    const merged = planned.find((item) => item.id === "A");
    expect(merged?.title).toBe("import");
    expect(merged?.definition).toBe("import-def");
    expect(merged?.updatedAt).toBe(t2);
    expect(merged?.contextDefinitions).toEqual([
      { id: "D1", context: "import", definition: "import D1" },
      { id: "D2", context: "local", definition: "local D2" }
    ]);
  });

  it("merge で local が新しいとき本体は local、import-only 定義は追加する", () => {
    const t1 = "2026-01-01T00:00:00.000Z";
    const t2 = "2026-02-01T00:00:00.000Z";
    const existing = [
      concept("A", {
        title: "local",
        definition: "local-def",
        updatedAt: t2,
        contextDefinitions: [
          { id: "D1", context: "local", definition: "local D1" },
          { id: "D2", context: "local", definition: "local D2" }
        ]
      })
    ];
    const incoming = [
      concept("A", {
        title: "import",
        definition: "import-def",
        updatedAt: t1,
        contextDefinitions: [
          { id: "D1", context: "import", definition: "import D1" },
          { id: "D3", context: "import", definition: "import D3" }
        ]
      })
    ];
    const planned = planConceptPrerequisiteImport(existing, incoming, "merge");
    const merged = planned.find((item) => item.id === "A");
    expect(merged?.title).toBe("local");
    expect(merged?.definition).toBe("local-def");
    expect(merged?.updatedAt).toBe(t2);
    expect(merged?.contextDefinitions).toEqual([
      { id: "D1", context: "local", definition: "local D1" },
      { id: "D2", context: "local", definition: "local D2" },
      { id: "D3", context: "import", definition: "import D3" }
    ]);
  });

  it("merge で updatedAt が同じなら existing を winner とし import-only ID は追加する", () => {
    const t = "2026-01-01T00:00:00.000Z";
    const existing = [
      concept("A", {
        title: "local",
        updatedAt: t,
        contextDefinitions: [{ id: "D1", context: "local", definition: "local D1" }]
      })
    ];
    const incoming = [
      concept("A", {
        title: "import",
        updatedAt: t,
        contextDefinitions: [
          { id: "D1", context: "import", definition: "import D1" },
          { id: "D3", context: "import", definition: "import D3" }
        ]
      })
    ];
    const planned = planConceptPrerequisiteImport(existing, incoming, "merge");
    const merged = planned.find((item) => item.id === "A");
    expect(merged?.title).toBe("local");
    expect(merged?.updatedAt).toBe(t);
    expect(merged?.contextDefinitions).toEqual([
      { id: "D1", context: "local", definition: "local D1" },
      { id: "D3", context: "import", definition: "import D3" }
    ]);
  });

  it("replace では contextDefinitions を union しない", () => {
    const existing = [
      concept("A", {
        contextDefinitions: [
          { id: "D1", context: "local", definition: "local D1" },
          { id: "D2", context: "local", definition: "local D2" }
        ]
      })
    ];
    const incoming = [
      concept("A", {
        contextDefinitions: [{ id: "D1", context: "import", definition: "import D1" }]
      })
    ];
    const planned = planConceptPrerequisiteImport(existing, incoming, "replace");
    expect(planned.find((item) => item.id === "A")?.contextDefinitions).toEqual([
      { id: "D1", context: "import", definition: "import D1" }
    ]);
  });
});
