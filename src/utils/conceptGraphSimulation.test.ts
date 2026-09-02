import { describe, expect, it } from "vitest";
import {
  getConceptGraphSimulationConfig,
  getConceptGraphSimulationProfile
} from "./conceptGraphSimulation";

describe("getConceptGraphSimulationProfile", () => {
  it.each([
    [0, "small"],
    [200, "small"],
    [201, "medium"],
    [500, "medium"],
    [501, "large"],
    [1000, "large"]
  ] as const)("nodes %i -> %s", (nodes, expected) => {
    expect(getConceptGraphSimulationProfile(nodes)).toBe(expected);
  });
});

describe("getConceptGraphSimulationConfig", () => {
  const small = getConceptGraphSimulationConfig(0);
  const medium = getConceptGraphSimulationConfig(201);
  const large = getConceptGraphSimulationConfig(501);

  it("small は従来値を維持する", () => {
    expect(small).toEqual({
      cooldownTicks: 120,
      cooldownTime: 15000,
      alphaDecay: 0.0228,
      velocityDecay: 0.4,
      linkDistance: 90,
      chargeStrength: -160
    });
  });

  it("規模が大きいほど cooldown を短くし alphaDecay を上げる", () => {
    expect(medium.cooldownTicks).toBeLessThan(small.cooldownTicks);
    expect(large.cooldownTicks).toBeLessThan(medium.cooldownTicks);
    expect(medium.cooldownTime).toBeLessThan(small.cooldownTime);
    expect(large.cooldownTime).toBeLessThan(medium.cooldownTime);
    expect(small.alphaDecay).toBeLessThan(medium.alphaDecay);
    expect(medium.alphaDecay).toBeLessThan(large.alphaDecay);
  });

  it("全規模で force の平衡値は変えない", () => {
    for (const config of [small, medium, large]) {
      expect(config.linkDistance).toBe(90);
      expect(config.chargeStrength).toBe(-160);
      expect(config.velocityDecay).toBe(0.4);
    }
  });
});
