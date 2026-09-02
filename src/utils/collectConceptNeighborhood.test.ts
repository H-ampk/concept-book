import { describe, expect, it } from "vitest";
import { createEmptyConceptInput, type Concept } from "../types/concept";
import { collectConceptNeighborhood } from "./conceptRelations";

const concept = (id: string, relatedIds: string[]): Concept => ({
  ...createEmptyConceptInput(),
  id,
  title: id,
  relatedIds,
  createdAt: "t",
  updatedAt: "t"
});

describe("collectConceptNeighborhood", () => {
  it("1-hop は中心と直接隣接のみを含む", () => {
    const concepts = [
      concept("A", ["B", "C"]),
      concept("B", ["A"]),
      concept("C", ["A", "D"]),
      concept("D", ["C"])
    ];
    const ids = collectConceptNeighborhood(concepts, "A", 1).map((item) => item.id);
    expect(ids.sort()).toEqual(["A", "B", "C"]);
  });

  it("2-hop は最大2辺先まで含む", () => {
    const concepts = [
      concept("A", ["B", "C"]),
      concept("B", ["A"]),
      concept("C", ["A", "D"]),
      concept("D", ["C"])
    ];
    const ids = collectConceptNeighborhood(concepts, "A", 2).map((item) => item.id);
    expect(ids.sort()).toEqual(["A", "B", "C", "D"]);
  });

  it("孤立ノードは自身のみ", () => {
    const concepts = [concept("A", [])];
    expect(collectConceptNeighborhood(concepts, "A", 1).map((item) => item.id)).toEqual(["A"]);
    expect(collectConceptNeighborhood(concepts, "A", 2).map((item) => item.id)).toEqual(["A"]);
  });

  it("循環グラフでも各 Concept を一度だけ取得する", () => {
    const concepts = [
      concept("A", ["B"]),
      concept("B", ["C"]),
      concept("C", ["A"])
    ];
    const ids = collectConceptNeighborhood(concepts, "A", 2).map((item) => item.id);
    expect(ids.sort()).toEqual(["A", "B", "C"]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("中心が対象集合に無い場合は空配列", () => {
    const concepts = [concept("A", ["B"]), concept("B", ["A"])];
    expect(collectConceptNeighborhood(concepts, "Z", 1)).toEqual([]);
    expect(collectConceptNeighborhood(concepts, undefined, 1)).toEqual([]);
  });

  it("フィルタ外 Concept を経由せず到達できない", () => {
    const filtered = [concept("A", ["B"]), concept("C", ["B"])];
    const ids = collectConceptNeighborhood(filtered, "A", 2).map((item) => item.id);
    expect(ids).toEqual(["A"]);
  });

  it("無向関係として A→B だけでも隣接する", () => {
    const concepts = [concept("A", ["B"]), concept("B", [])];
    const ids = collectConceptNeighborhood(concepts, "A", 1).map((item) => item.id);
    expect(ids.sort()).toEqual(["A", "B"]);
  });
});
