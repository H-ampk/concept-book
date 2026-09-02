import { describe, expect, it } from "vitest";
import type { Concept } from "../types/concept";
import { collectUndirectedConceptEdges } from "./conceptRelations";
import { createConceptGraphTopologySignature } from "./conceptGraphTopology";

const stub = (id: string, relatedIds: string[], extras?: Partial<Concept>): Concept => ({
  id,
  title: extras?.title ?? id,
  definition: "",
  myInterpretation: "",
  domainTags: extras?.domainTags ?? [],
  researchTags: [],
  relatedIds,
  source: { book: "", page: "", author: null },
  notes: "",
  status: "draft",
  favorite: extras?.favorite ?? false,
  createdAt: "t",
  updatedAt: "t"
});

describe("createConceptGraphTopologySignature", () => {
  it("title 変更では署名が変わらない", () => {
    const before = [stub("A", ["B"], { title: "alpha" }), stub("B", ["A"])];
    const after = [stub("A", ["B"], { title: "beta" }), stub("B", ["A"])];
    expect(createConceptGraphTopologySignature(before)).toBe(
      createConceptGraphTopologySignature(after)
    );
  });

  it("favorite 変更では署名が変わらない", () => {
    const before = [stub("A", ["B"]), stub("B", ["A"])];
    const after = [stub("A", ["B"], { favorite: true }), stub("B", ["A"])];
    expect(createConceptGraphTopologySignature(before)).toBe(
      createConceptGraphTopologySignature(after)
    );
  });

  it("domainTags 変更では署名が変わらない", () => {
    const before = [stub("A", ["B"]), stub("B", ["A"])];
    const after = [stub("A", ["B"], { domainTags: ["math"] }), stub("B", ["A"])];
    expect(createConceptGraphTopologySignature(before)).toBe(
      createConceptGraphTopologySignature(after)
    );
  });

  it("Concept 配列の順序変更では署名が変わらない", () => {
    const forward = [stub("A", ["B"]), stub("B", ["A"]), stub("C", [])];
    const reversed = [stub("C", []), stub("B", ["A"]), stub("A", ["B"])];
    expect(createConceptGraphTopologySignature(forward)).toBe(
      createConceptGraphTopologySignature(reversed)
    );
  });

  it("node 追加で署名が変わる", () => {
    const before = [stub("A", ["B"]), stub("B", ["A"])];
    const after = [stub("A", ["B"]), stub("B", ["A"]), stub("C", [])];
    expect(createConceptGraphTopologySignature(before)).not.toBe(
      createConceptGraphTopologySignature(after)
    );
  });

  it("node 削除で署名が変わる", () => {
    const before = [stub("A", ["B"]), stub("B", ["A"]), stub("C", [])];
    const after = [stub("A", ["B"]), stub("B", ["A"])];
    expect(createConceptGraphTopologySignature(before)).not.toBe(
      createConceptGraphTopologySignature(after)
    );
  });

  it("edge 追加で署名が変わる", () => {
    const before = [stub("A", []), stub("B", []), stub("C", [])];
    const after = [stub("A", ["B"]), stub("B", ["A"]), stub("C", [])];
    expect(createConceptGraphTopologySignature(before)).not.toBe(
      createConceptGraphTopologySignature(after)
    );
  });

  it("edge 削除で署名が変わる", () => {
    const before = [stub("A", ["B"]), stub("B", ["A"]), stub("C", [])];
    const after = [stub("A", []), stub("B", []), stub("C", [])];
    expect(createConceptGraphTopologySignature(before)).not.toBe(
      createConceptGraphTopologySignature(after)
    );
  });

  it("無向辺は source/target の向きに依存せず、collectUndirectedConceptEdges と一致する", () => {
    const ab = [stub("A", ["B"]), stub("B", [])];
    const ba = [stub("A", []), stub("B", ["A"])];
    expect(createConceptGraphTopologySignature(ab)).toBe(createConceptGraphTopologySignature(ba));

    const parsed = JSON.parse(createConceptGraphTopologySignature(ab)) as {
      nodes: string[];
      links: [string, string][];
    };
    const edges = collectUndirectedConceptEdges(ab);
    expect(parsed.links).toEqual(edges.map((edge) => [edge.source, edge.target]));
  });

  it("JSON 配列で決定的な署名を返す", () => {
    const signature = createConceptGraphTopologySignature([
      stub("B", ["A"]),
      stub("A", ["B"])
    ]);
    expect(JSON.parse(signature)).toEqual({
      nodes: ["A", "B"],
      links: [["A", "B"]]
    });
  });
});
