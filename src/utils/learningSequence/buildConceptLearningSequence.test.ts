import { describe, expect, it } from "vitest";
import { createEmptyConceptInput, type Concept } from "../../types/concept";
import { buildConceptPrerequisiteIndex } from "../conceptPrerequisites";
import { buildConceptLearningSequence } from "./buildConceptLearningSequence";
import { collectPrerequisiteClosure } from "./collectPrerequisiteClosure";
import { orderConceptLearningClosure } from "./orderConceptLearningClosure";
import type { ConceptLearningSequenceResult } from "./types";

const concept = (id: string, extras: Partial<Concept> = {}): Concept => ({
  ...createEmptyConceptInput(),
  id,
  title: extras.title ?? id,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...extras
});

const idsOf = (result: ConceptLearningSequenceResult): string[] =>
  result.items.map((item) => item.conceptId);

const depthOf = (result: ConceptLearningSequenceResult, id: string): number | undefined =>
  result.items.find((item) => item.conceptId === id)?.prerequisiteDepth;

describe("collectPrerequisiteClosure", () => {
  it("target 自身を含み、無関係な Concept は入れない", () => {
    const index = buildConceptPrerequisiteIndex([
      concept("A"),
      concept("B", { prerequisiteIds: ["A"] }),
      concept("Target", { prerequisiteIds: ["B"] }),
      concept("X"),
      concept("Y", { prerequisiteIds: ["X"] }),
      concept("Z", { prerequisiteIds: ["Y"] })
    ]);
    const closure = collectPrerequisiteClosure(index, "Target");
    expect(closure).not.toBeNull();
    expect([...closure!.conceptIds].sort()).toEqual(["A", "B", "Target"]);
    expect(closure!.depthByConceptId.get("Target")).toBe(0);
    expect(closure!.depthByConceptId.get("B")).toBe(1);
    expect(closure!.depthByConceptId.get("A")).toBe(2);
  });

  it("prerequisite が無ければ target のみ", () => {
    const index = buildConceptPrerequisiteIndex([concept("solo")]);
    const closure = collectPrerequisiteClosure(index, "solo");
    expect(closure?.conceptIds).toEqual(new Set(["solo"]));
    expect(closure?.depthByConceptId.get("solo")).toBe(0);
  });

  it("複数経路では最短 depth を使う", () => {
    const index = buildConceptPrerequisiteIndex([
      concept("A"),
      concept("B", { prerequisiteIds: ["A"] }),
      concept("D", { prerequisiteIds: ["A", "B"] })
    ]);
    const closure = collectPrerequisiteClosure(index, "D");
    expect(closure?.depthByConceptId.get("A")).toBe(1);
    expect(closure?.depthByConceptId.get("B")).toBe(1);
    expect(closure?.depthByConceptId.get("D")).toBe(0);
  });

  it("target 不存在は null", () => {
    const index = buildConceptPrerequisiteIndex([concept("A")]);
    expect(collectPrerequisiteClosure(index, "missing")).toBeNull();
  });
});

describe("buildConceptLearningSequence", () => {
  it("A → B → C で C を target にすると A, B, C", () => {
    const index = buildConceptPrerequisiteIndex([
      concept("A"),
      concept("B", { prerequisiteIds: ["A"] }),
      concept("C", { prerequisiteIds: ["B"] })
    ]);
    const result = buildConceptLearningSequence({
      targetConceptId: "C",
      prerequisiteIndex: index
    });
    expect(result.status).toBe("ok");
    expect(idsOf(result)).toEqual(["A", "B", "C"]);
    expect(depthOf(result, "A")).toBe(2);
    expect(depthOf(result, "B")).toBe(1);
    expect(depthOf(result, "C")).toBe(0);
    expect(result.items.at(-1)?.isTarget).toBe(true);
  });

  it("branching: A → C, B → C, C → D", () => {
    const index = buildConceptPrerequisiteIndex([
      concept("A"),
      concept("B"),
      concept("C", { prerequisiteIds: ["A", "B"] }),
      concept("D", { prerequisiteIds: ["C"] })
    ]);
    const result = buildConceptLearningSequence({
      targetConceptId: "D",
      prerequisiteIndex: index
    });
    expect(result.status).toBe("ok");
    const ids = idsOf(result);
    expect(ids.indexOf("A")).toBeLessThan(ids.indexOf("C"));
    expect(ids.indexOf("B")).toBeLessThan(ids.indexOf("C"));
    expect(ids.indexOf("C")).toBeLessThan(ids.indexOf("D"));
    expect(ids.at(-1)).toBe("D");
    expect(ids).toHaveLength(4);
  });

  it("diamond: A は1回だけ、A が B/C より前、D が最後", () => {
    const index = buildConceptPrerequisiteIndex([
      concept("A"),
      concept("B", { prerequisiteIds: ["A"] }),
      concept("C", { prerequisiteIds: ["A"] }),
      concept("D", { prerequisiteIds: ["B", "C"] })
    ]);
    const result = buildConceptLearningSequence({
      targetConceptId: "D",
      prerequisiteIndex: index
    });
    expect(result.status).toBe("ok");
    const ids = idsOf(result);
    expect(ids.filter((id) => id === "A")).toHaveLength(1);
    expect(ids.indexOf("A")).toBeLessThan(ids.indexOf("B"));
    expect(ids.indexOf("A")).toBeLessThan(ids.indexOf("C"));
    expect(ids.indexOf("B")).toBeLessThan(ids.indexOf("D"));
    expect(ids.indexOf("C")).toBeLessThan(ids.indexOf("D"));
    expect(ids.at(-1)).toBe("D");
  });

  it("multiple path: A depth は最短 1 で、A < B < D を満たす", () => {
    const index = buildConceptPrerequisiteIndex([
      concept("A"),
      concept("B", { prerequisiteIds: ["A"] }),
      concept("D", { prerequisiteIds: ["A", "B"] })
    ]);
    const result = buildConceptLearningSequence({
      targetConceptId: "D",
      prerequisiteIndex: index
    });
    expect(result.status).toBe("ok");
    const ids = idsOf(result);
    expect(ids.filter((id) => id === "A")).toHaveLength(1);
    expect(depthOf(result, "A")).toBe(1);
    expect(ids.indexOf("A")).toBeLessThan(ids.indexOf("B"));
    expect(ids.indexOf("B")).toBeLessThan(ids.indexOf("D"));
    expect(ids.at(-1)).toBe("D");
  });

  it("depth の単純 sort ではなく topological constraint が先", () => {
    const index = buildConceptPrerequisiteIndex([
      concept("B", { prerequisiteIds: ["A"] }),
      concept("A"),
      concept("D", { prerequisiteIds: ["A", "B"] })
    ]);
    const result = buildConceptLearningSequence({
      targetConceptId: "D",
      prerequisiteIndex: index
    });
    expect(result.status).toBe("ok");
    const ids = idsOf(result);
    expect(ids).toEqual(["A", "B", "D"]);
    expect(depthOf(result, "A")).toBe(1);
    expect(depthOf(result, "B")).toBe(1);
  });

  it("tie-break: depth が大きい zero-indegree を先にする", () => {
    const index = buildConceptPrerequisiteIndex([
      concept("A"),
      concept("B"),
      concept("C", { prerequisiteIds: ["B"] }),
      concept("Target", { prerequisiteIds: ["A", "C"] })
    ]);
    const result = buildConceptLearningSequence({
      targetConceptId: "Target",
      prerequisiteIndex: index
    });
    expect(result.status).toBe("ok");
    expect(idsOf(result)[0]).toBe("B");
    expect(depthOf(result, "B")).toBe(2);
    expect(depthOf(result, "A")).toBe(1);
  });

  it("tie-break: depth 同一なら originalIndex が小さい方", () => {
    const index = buildConceptPrerequisiteIndex([
      concept("A"),
      concept("B"),
      concept("Target", { prerequisiteIds: ["A", "B"] })
    ]);
    const result = buildConceptLearningSequence({
      targetConceptId: "Target",
      prerequisiteIndex: index
    });
    expect(result.status).toBe("ok");
    expect(idsOf(result)).toEqual(["A", "B", "Target"]);
  });

  it("同じ index / target なら何度実行しても同じ sequence", () => {
    const index = buildConceptPrerequisiteIndex([
      concept("A"),
      concept("B"),
      concept("C", { prerequisiteIds: ["A", "B"] }),
      concept("D", { prerequisiteIds: ["C"] })
    ]);
    const first = buildConceptLearningSequence({
      targetConceptId: "D",
      prerequisiteIndex: index
    });
    const second = buildConceptLearningSequence({
      targetConceptId: "D",
      prerequisiteIndex: index
    });
    expect(first).toEqual(second);
  });

  it("prerequisite なしなら target のみ", () => {
    const result = buildConceptLearningSequence({
      targetConceptId: "linear-regression",
      prerequisiteIndex: buildConceptPrerequisiteIndex([concept("linear-regression")])
    });
    expect(result).toEqual({
      status: "ok",
      targetConceptId: "linear-regression",
      items: [
        {
          conceptId: "linear-regression",
          prerequisiteDepth: 0,
          isTarget: true
        }
      ]
    });
  });

  it("target 不存在は throw せず target-not-found", () => {
    const result = buildConceptLearningSequence({
      targetConceptId: "missing",
      prerequisiteIndex: buildConceptPrerequisiteIndex([concept("A")])
    });
    expect(result).toEqual({
      status: "target-not-found",
      targetConceptId: "missing",
      items: []
    });
  });

  it("defensive cycle は cycle-detected で空 items", () => {
    const index = buildConceptPrerequisiteIndex([
      concept("A", { prerequisiteIds: ["C"] }),
      concept("B", { prerequisiteIds: ["A"] }),
      concept("C", { prerequisiteIds: ["B"] })
    ]);
    const result = buildConceptLearningSequence({
      targetConceptId: "C",
      prerequisiteIndex: index
    });
    expect(result).toEqual({
      status: "cycle-detected",
      targetConceptId: "C",
      items: []
    });
  });

  it("relatedIds は sequence に入れない", () => {
    const result = buildConceptLearningSequence({
      targetConceptId: "B",
      prerequisiteIndex: buildConceptPrerequisiteIndex([
        concept("A", { relatedIds: ["B"] }),
        concept("B", { relatedIds: ["A"] })
      ])
    });
    expect(result.status).toBe("ok");
    expect(idsOf(result)).toEqual(["B"]);
  });

  it("無関係な prerequisite graph は含めない", () => {
    const result = buildConceptLearningSequence({
      targetConceptId: "Target",
      prerequisiteIndex: buildConceptPrerequisiteIndex([
        concept("A"),
        concept("B", { prerequisiteIds: ["A"] }),
        concept("Target", { prerequisiteIds: ["B"] }),
        concept("X"),
        concept("Y", { prerequisiteIds: ["X"] }),
        concept("Z", { prerequisiteIds: ["Y"] })
      ])
    });
    expect(result.status).toBe("ok");
    expect(idsOf(result)).toEqual(["A", "B", "Target"]);
  });

  it("target 外の cycle では target sequence を失敗させない", () => {
    const result = buildConceptLearningSequence({
      targetConceptId: "Target",
      prerequisiteIndex: buildConceptPrerequisiteIndex([
        concept("A"),
        concept("Target", { prerequisiteIds: ["A"] }),
        concept("X", { prerequisiteIds: ["Y"] }),
        concept("Y", { prerequisiteIds: ["X"] })
      ])
    });
    expect(result.status).toBe("ok");
    expect(idsOf(result)).toEqual(["A", "Target"]);
  });

  it("A, C, B, Target の chain では target が最後", () => {
    const result = buildConceptLearningSequence({
      targetConceptId: "Target",
      prerequisiteIndex: buildConceptPrerequisiteIndex([
        concept("A"),
        concept("C"),
        concept("B", { prerequisiteIds: ["A", "C"] }),
        concept("Target", { prerequisiteIds: ["B"] })
      ])
    });
    expect(result.status).toBe("ok");
    expect(idsOf(result).at(-1)).toBe("Target");
    const ids = idsOf(result);
    expect(ids.indexOf("B")).toBeLessThan(ids.indexOf("Target"));
  });
});

describe("orderConceptLearningClosure (#121 reuse)", () => {
  it("full closure を再取得せず、渡された subset だけを順序付ける", () => {
    const index = buildConceptPrerequisiteIndex([
      concept("A"),
      concept("B", { prerequisiteIds: ["A"] }),
      concept("C", { prerequisiteIds: ["B"] })
    ]);
    const full = collectPrerequisiteClosure(index, "C");
    expect(full).not.toBeNull();
    const pruned = new Set(["B", "C"]);
    const result = orderConceptLearningClosure({
      prerequisiteIndex: index,
      includedConceptIds: pruned,
      depthByConceptId: full!.depthByConceptId,
      targetConceptId: "C"
    });
    expect(result.status).toBe("ok");
    expect(idsOf(result)).toEqual(["B", "C"]);
    expect(depthOf(result, "B")).toBe(1);
    expect(depthOf(result, "C")).toBe(0);
  });
});
