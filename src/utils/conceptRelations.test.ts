import { describe, expect, it } from "vitest";
import type { Concept } from "../types/concept";
import { repairUndirectedRelatedIds } from "./conceptRelations";

const stub = (id: string, relatedIds: string[], updatedAt = "2020-01-01T00:00:00.000Z"): Concept => ({
  id,
  title: id,
  definition: "",
  myInterpretation: "",
  domainTags: [],
  researchTags: [],
  relatedIds,
  source: { book: "", page: "", author: null },
  notes: "",
  status: "draft",
  favorite: false,
  createdAt: updatedAt,
  updatedAt
});

describe("repairUndirectedRelatedIds", () => {
  it("片方向関係の補完で updatedAt を書き換えない", () => {
    const { concepts, changedIds } = repairUndirectedRelatedIds([
      stub("A", ["B"], "2020-01-01T00:00:00.000Z"),
      stub("B", [], "2020-02-02T00:00:00.000Z")
    ]);
    expect(changedIds).toEqual(["B"]);
    expect(concepts.find((concept) => concept.id === "A")?.updatedAt).toBe("2020-01-01T00:00:00.000Z");
    expect(concepts.find((concept) => concept.id === "B")?.updatedAt).toBe("2020-02-02T00:00:00.000Z");
    expect(concepts.find((concept) => concept.id === "A")?.relatedIds).toEqual(["B"]);
    expect(concepts.find((concept) => concept.id === "B")?.relatedIds).toEqual(["A"]);
  });
});
