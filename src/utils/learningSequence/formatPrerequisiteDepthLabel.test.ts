import { describe, expect, it } from "vitest";
import { formatPrerequisiteDepthLabel } from "./formatPrerequisiteDepthLabel";

describe("formatPrerequisiteDepthLabel", () => {
  it("target は学習対象", () => {
    expect(formatPrerequisiteDepthLabel({ prerequisiteDepth: 0, isTarget: true })).toBe(
      "学習対象"
    );
  });

  it("直接の前提と n 段階前の前提を内部 depth のまま出さない", () => {
    expect(formatPrerequisiteDepthLabel({ prerequisiteDepth: 1, isTarget: false })).toBe(
      "直接の前提"
    );
    expect(formatPrerequisiteDepthLabel({ prerequisiteDepth: 2, isTarget: false })).toBe(
      "2段階前の前提"
    );
  });
});
