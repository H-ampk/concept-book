import { describe, expect, it } from "vitest";
import { formatConceptMasteryProbability, toConceptMasteryScore } from "./formatConceptMastery";

describe("formatConceptMasteryProbability", () => {
  it("masteryScore と同じ丸めで百分率にする", () => {
    expect(toConceptMasteryScore(0.821)).toBe(82);
    expect(formatConceptMasteryProbability(0.821)).toBe("82%");
    expect(formatConceptMasteryProbability(0)).toBe("0%");
  });

  it("null は 0% にせず null を返す", () => {
    expect(formatConceptMasteryProbability(null)).toBeNull();
  });
});
