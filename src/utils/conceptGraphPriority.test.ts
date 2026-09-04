import { describe, expect, it } from "vitest";
import { createEmptyConceptInput, type Concept } from "../types/concept";
import {
  GRAPH_PRIORITY_HOP_DECAY,
  rankConceptsForGraph,
  rankConceptsForGraphFromIndex
} from "./conceptGraphPriority";
import { createConceptRelationIndex } from "./conceptRelations";

const concept = (id: string, relatedIds: string[], favorite = false): Concept => ({
  ...createEmptyConceptInput(),
  id,
  title: id,
  relatedIds,
  favorite,
  createdAt: "t",
  updatedAt: "t"
});

const ids = (ranked: { concept: Concept }[]): string[] => ranked.map((entry) => entry.concept.id);

describe("rankConceptsForGraph", () => {
  it("selected が先頭で hopDistance 0・activation 1", () => {
    const concepts = [concept("B", ["A"]), concept("A", ["B"]), concept("C", [])];
    const ranked = rankConceptsForGraph(concepts, "A");
    expect(ids(ranked)[0]).toBe("A");
    expect(ranked[0].reason).toMatchObject({
      hopDistance: 0,
      activation: 1,
      reachable: true
    });
  });

  it("selected - A - B - C は hop 順になる", () => {
    const concepts = [
      concept("C", ["B"]),
      concept("selected", ["A"]),
      concept("B", ["A", "C"]),
      concept("A", ["selected", "B"])
    ];
    expect(ids(rankConceptsForGraph(concepts, "selected"))).toEqual(["selected", "A", "B", "C"]);
  });

  it("1-hop は 2-hop より前、2-hop は 3-hop より前", () => {
    const concepts = [
      concept("S", ["H1"]),
      concept("H1", ["S", "H2"]),
      concept("H2", ["H1", "H3"]),
      concept("H3", ["H2"])
    ];
    const ranked = rankConceptsForGraph(concepts, "S");
    const hop = (id: string) => ranked.find((entry) => entry.concept.id === id)?.reason.hopDistance;
    expect(hop("H1")).toBe(1);
    expect(hop("H2")).toBe(2);
    expect(hop("H3")).toBe(3);
    expect(ids(ranked)).toEqual(["S", "H1", "H2", "H3"]);
  });

  it("同一 hop では relation weight が大きい方を先にする", () => {
    const concepts = [concept("S", ["A", "B"]), concept("A", ["S"]), concept("B", ["S"])];
    const ranked = rankConceptsForGraph(concepts, "S", {
      getRelationWeight: (_source, target) => (target === "A" ? 0.9 : target === "B" ? 0.4 : 1)
    });
    expect(ids(ranked)).toEqual(["S", "A", "B"]);
    expect(ranked[1].reason.activation).toBeCloseTo(0.9 * GRAPH_PRIORITY_HOP_DECAY);
    expect(ranked[2].reason.activation).toBeCloseTo(0.4 * GRAPH_PRIORITY_HOP_DECAY);
  });

  it("weight callback 未指定時は全 edge を 1 として動く", () => {
    const concepts = [concept("S", ["A"]), concept("A", ["S", "B"]), concept("B", ["A"])];
    const ranked = rankConceptsForGraph(concepts, "S");
    expect(ranked[1].reason.activation).toBeCloseTo(GRAPH_PRIORITY_HOP_DECAY);
    expect(ranked[2].reason.activation).toBeCloseTo(GRAPH_PRIORITY_HOP_DECAY ** 2);
  });

  it("weight の異常値を [0, 1] へ安全に落とす", () => {
    const concepts = [
      concept("S", ["A", "B", "C", "D"]),
      concept("A", ["S"]),
      concept("B", ["S"]),
      concept("C", ["S"]),
      concept("D", ["S"])
    ];
    const weights: Record<string, number> = { A: 2, B: -1, C: Number.NaN, D: 0.5 };
    const ranked = rankConceptsForGraph(concepts, "S", {
      getRelationWeight: (_source, target) => weights[target] ?? 1
    });
    const activation = (id: string) =>
      ranked.find((entry) => entry.concept.id === id)?.reason.activation ?? -1;
    expect(activation("A")).toBeCloseTo(GRAPH_PRIORITY_HOP_DECAY);
    expect(activation("B")).toBe(0);
    expect(activation("C")).toBeCloseTo(GRAPH_PRIORITY_HOP_DECAY);
    expect(activation("D")).toBeCloseTo(0.5 * GRAPH_PRIORITY_HOP_DECAY);
  });

  it("hop が増えると activation が減衰する", () => {
    const concepts = [
      concept("S", ["A"]),
      concept("A", ["S", "B"]),
      concept("B", ["A"])
    ];
    const ranked = rankConceptsForGraph(concepts, "S");
    expect(ranked[0].reason.activation).toBe(1);
    expect(ranked[1].reason.activation).toBeGreaterThan(ranked[2].reason.activation);
    expect(ranked[2].reason.activation).toBeCloseTo(GRAPH_PRIORITY_HOP_DECAY ** 2);
  });

  it("同一 hop の複数経路では最大 activation を採用する", () => {
    const concepts = [
      concept("S", ["A", "B"]),
      concept("A", ["S", "T"]),
      concept("B", ["S", "T"]),
      concept("T", ["A", "B"])
    ];
    const ranked = rankConceptsForGraph(concepts, "S", {
      getRelationWeight: (source, target) => {
        if (source === "S" && target === "A") {
          return 1;
        }
        if (source === "A" && target === "T") {
          return 1;
        }
        if (source === "S" && target === "B") {
          return 0.2;
        }
        if (source === "B" && target === "T") {
          return 1;
        }
        return 1;
      }
    });
    const t = ranked.find((entry) => entry.concept.id === "T");
    expect(t?.reason.hopDistance).toBe(2);
    expect(t?.reason.activation).toBeCloseTo(GRAPH_PRIORITY_HOP_DECAY ** 2);
  });

  it("循環グラフでも終了し各 Concept は一度だけ", () => {
    const concepts = [
      concept("A", ["B", "D"]),
      concept("B", ["A", "C"]),
      concept("C", ["B", "D"]),
      concept("D", ["A", "C"])
    ];
    const ranked = rankConceptsForGraph(concepts, "A");
    expect(ids(ranked).sort()).toEqual(["A", "B", "C", "D"]);
    expect(new Set(ids(ranked)).size).toBe(4);
    expect(ranked.find((entry) => entry.concept.id === "C")?.reason.hopDistance).toBe(2);
  });

  it("同一 structural relevance では favorite を優先する", () => {
    const concepts = [
      concept("S", ["A", "B"]),
      concept("A", ["S"], false),
      concept("B", ["S"], true)
    ];
    expect(ids(rankConceptsForGraph(concepts, "S"))).toEqual(["S", "B", "A"]);
  });

  it("2-hop favorite は 1-hop non-favorite を追い越さない", () => {
    const concepts = [
      concept("S", ["A"]),
      concept("A", ["S", "F"], false),
      concept("F", ["A"], true)
    ];
    expect(ids(rankConceptsForGraph(concepts, "S"))).toEqual(["S", "A", "F"]);
  });

  it("disconnected favorite は reachable を追い越さない", () => {
    const concepts = [
      concept("Fav", [], true),
      concept("S", ["A"]),
      concept("A", ["S"])
    ];
    const ranked = rankConceptsForGraph(concepts, "S");
    expect(ids(ranked)).toEqual(["S", "A", "Fav"]);
    expect(ranked[2].reason.reachable).toBe(false);
    expect(ranked[2].reason.hopDistance).toBeNull();
    expect(ranked[2].reason.activation).toBe(0);
  });

  it("selected が undefined なら元の順を維持する", () => {
    const concepts = [concept("C", []), concept("A", []), concept("B", ["A"])];
    expect(ids(rankConceptsForGraph(concepts, undefined))).toEqual(["C", "A", "B"]);
  });

  it("selected が filtered set 外なら元の順を維持する", () => {
    const concepts = [concept("C", []), concept("A", []), concept("B", [])];
    expect(ids(rankConceptsForGraph(concepts, "missing"))).toEqual(["C", "A", "B"]);
  });

  it("渡していない Concept は結果にも traversal 中継にも出ない", () => {
    const filtered = [concept("S", ["Bridge"]), concept("Leaf", ["Bridge"])];
    const ranked = rankConceptsForGraph(filtered, "S");
    expect(ids(ranked)).toEqual(["S", "Leaf"]);
    expect(ranked[1].reason.reachable).toBe(false);
  });

  it("limit を増やしても先頭の順位は変わらない", () => {
    const concepts = Array.from({ length: 40 }, (_, index) => {
      const id = `n${index}`;
      const related =
        index === 0 ? ["n1"] : index === 39 ? [`n${index - 1}`] : [`n${index - 1}`, `n${index + 1}`];
      return concept(id, related);
    });
    const ranked = rankConceptsForGraph(concepts, "n0");
    expect(ids(ranked).slice(0, 20)).toEqual(ids(ranked).slice(0, 40).slice(0, 20));
  });

  it("空・1件・関係なし・自己参照でもクラッシュしない", () => {
    expect(rankConceptsForGraph([], "A")).toEqual([]);
    const single = [concept("A", [])];
    expect(ids(rankConceptsForGraph(single, "A"))).toEqual(["A"]);
    const isolated = [concept("A", []), concept("B", [])];
    expect(ids(rankConceptsForGraph(isolated, "A"))).toEqual(["A", "B"]);
    const self = [concept("A", ["A"]), concept("B", ["A"])];
    expect(ids(rankConceptsForGraph(self, "A")).sort()).toEqual(["A", "B"]);
    expect(ids(rankConceptsForGraph(self, "Z"))).toEqual(["A", "B"]);
  });

  it("ConceptGraphView 向けに既存 relation index を再利用できる", () => {
    const concepts = [concept("S", ["A"]), concept("A", ["S"])];
    const index = createConceptRelationIndex(concepts);
    const ranked = rankConceptsForGraphFromIndex(index, "S");
    expect(ids(ranked)).toEqual(["S", "A"]);
  });
});
