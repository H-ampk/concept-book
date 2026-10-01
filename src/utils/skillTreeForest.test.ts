import { describe, expect, it } from "vitest";
import type { Concept } from "../types/concept";
import {
  buildSkillTreeForest,
  chooseComponentRoot,
  findConnectedComponents,
} from "./skillTreeForest";

const concept = (id: string, relatedIds: string[] = []): Concept => ({
  id,
  title: id,
  definition: "",
  myInterpretation: "",
  domainTags: [],
  researchTags: [],
  relatedIds,
  source: { book: "", page: "", author: null },
  notes: "",
  status: "active",
  favorite: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

describe("skillTreeForest", () => {
  it("複数成分と孤立ノードを漏れなく分ける", () => {
    const graph = new Map<string, string[]>([
      ["A", ["B"]],
      ["B", ["A"]],
      ["C", ["D"]],
      ["D", ["C"]],
      ["E", []],
    ]);
    expect(findConnectedComponents(graph)).toEqual([["A", "B"], ["C", "D"], ["E"]]);
  });

  it("同一ノードを複数成分に入れない", () => {
    const graph = new Map<string, string[]>([
      ["A", ["B"]],
      ["B", ["A", "C"]],
      ["C", ["B"]],
    ]);
    const flat = findConnectedComponents(graph).flat();
    expect(flat).toEqual(["A", "B", "C"]);
    expect(new Set(flat).size).toBe(flat.length);
  });

  it("degree 同率なら window のより後ろを root にする", () => {
    const order = new Map([
      ["A", 0],
      ["B", 1],
    ]);
    const degrees = new Map([
      ["A", 1],
      ["B", 1],
    ]);
    expect(chooseComponentRoot(["A", "B"], degrees, order)).toBe("B");
  });

  it("成分をまたぐ extra edge を作らない", () => {
    const forest = buildSkillTreeForest([
      concept("A", ["B", "C", "D"]),
      concept("B", ["A", "C", "D"]),
      concept("C", ["A", "B", "D"]),
      concept("D", ["A", "B", "C"]),
      concept("E", ["F"]),
      concept("F", ["E"]),
    ]);
    expect(forest.components).toHaveLength(2);
    const [cluster, pair] = forest.components;
    const clusterNodes = new Set(cluster.nodeIds);
    for (const [source, target] of [...cluster.mainEdges, ...cluster.extraEdges]) {
      expect(clusterNodes.has(source)).toBe(true);
      expect(clusterNodes.has(target)).toBe(true);
    }
    expect(pair.mainEdges).toEqual([[pair.rootId, pair.rootId === "E" ? "F" : "E"]]);
    expect(pair.extraEdges).toEqual([]);
    expect(cluster.extraEdges.length).toBeGreaterThan(0);
  });

  it("孤立 Concept は自身が root の 1 ノード成分になる", () => {
    const forest = buildSkillTreeForest([
      concept("A", ["B"]),
      concept("B", ["A"]),
      concept("C"),
    ]);
    expect(forest.components.map((component) => component.rootId)).toEqual(["B", "C"]);
    expect(forest.components[1].nodeIds).toEqual(["C"]);
    expect(forest.components[1].tree.get("C")).toEqual([]);
  });
});
