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
});
