import { describe, expect, it } from "vitest";
import {
  CONCEPT_GRAPH_UNCLASSIFIED_KEY,
  canOpenConceptInGraph
} from "./quizConceptGraphStats";

describe("canOpenConceptInGraph", () => {
  const conceptById = new Map([["real-id", { id: "real-id" }]]);

  it("実在する Concept ID は遷移できる", () => {
    expect(canOpenConceptInGraph("real-id", conceptById)).toBe(true);
  });

  it("未分類キーは遷移できない", () => {
    expect(canOpenConceptInGraph(CONCEPT_GRAPH_UNCLASSIFIED_KEY, conceptById)).toBe(false);
  });

  it("削除済み Concept ID は遷移できない", () => {
    expect(canOpenConceptInGraph("deleted-id", conceptById)).toBe(false);
  });
});
