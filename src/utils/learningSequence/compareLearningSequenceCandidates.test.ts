import { describe, expect, it } from "vitest";
import { compareLearningSequenceCandidates } from "./compareLearningSequenceCandidates";

describe("compareLearningSequenceCandidates", () => {
  const orderById = new Map<string, number>([
    ["A", 0],
    ["B", 1],
    ["C", 2]
  ]);

  it("prerequisiteDepth が大きい候補を先にする", () => {
    expect(
      compareLearningSequenceCandidates(
        { conceptId: "A", prerequisiteDepth: 2 },
        { conceptId: "B", prerequisiteDepth: 1 },
        orderById
      )
    ).toBeLessThan(0);
  });

  it("depth が同じなら originalIndex が小さい方を先にする", () => {
    expect(
      compareLearningSequenceCandidates(
        { conceptId: "A", prerequisiteDepth: 1 },
        { conceptId: "B", prerequisiteDepth: 1 },
        orderById
      )
    ).toBeLessThan(0);
  });

  it("depth と originalIndex が同じなら Concept ID 昇順", () => {
    const sameIndex = new Map<string, number>([
      ["zeta", 4],
      ["alpha", 4]
    ]);
    expect(
      compareLearningSequenceCandidates(
        { conceptId: "alpha", prerequisiteDepth: 1 },
        { conceptId: "zeta", prerequisiteDepth: 1 },
        sameIndex
      )
    ).toBeLessThan(0);
  });
});
