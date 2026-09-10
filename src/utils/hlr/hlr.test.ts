import { describe, expect, it } from "vitest";
import { DEFAULT_HLR_PARAMETERS } from "./constants";
import { calculateHlrHalfLifeDays, calculateHlrRetentionProbability } from "./hlr";
import type { HlrParameters } from "./types";

describe("calculateHlrRetentionProbability", () => {
  it("elapsedDays = 0 なら retention = 1", () => {
    expect(calculateHlrRetentionProbability(0, 1)).toBe(1);
    expect(calculateHlrRetentionProbability(0, 8)).toBe(1);
    expect(calculateHlrRetentionProbability(0, 0.25)).toBe(1);
  });

  it("elapsedDays = halfLifeDays なら retention = 0.5", () => {
    expect(calculateHlrRetentionProbability(1, 1)).toBeCloseTo(0.5);
    expect(calculateHlrRetentionProbability(4, 4)).toBeCloseTo(0.5);
    expect(calculateHlrRetentionProbability(0.5, 0.5)).toBeCloseTo(0.5);
  });

  it("elapsedDays が長くなるほど retention が低下する", () => {
    const halfLifeDays = 4;
    const short = calculateHlrRetentionProbability(1, halfLifeDays);
    const medium = calculateHlrRetentionProbability(4, halfLifeDays);
    const long = calculateHlrRetentionProbability(12, halfLifeDays);
    expect(short).toBeGreaterThan(medium);
    expect(medium).toBeGreaterThan(long);
    expect(medium).toBeCloseTo(0.5);
  });

  it("retention は常に 0〜1", () => {
    const cases: Array<[number, number]> = [
      [0, 1],
      [1, 1],
      [100, 1],
      [1, 0.001],
      [0, 1e10],
      [1e10, 1],
      [-3, 2],
      [Number.NaN, 2],
      [2, Number.NaN],
      [2, 0],
      [2, -1],
      [2, Number.POSITIVE_INFINITY],
      [Number.POSITIVE_INFINITY, 2]
    ];
    for (const [elapsedDays, halfLifeDays] of cases) {
      const retention = calculateHlrRetentionProbability(elapsedDays, halfLifeDays);
      expect(retention).toBeGreaterThanOrEqual(0);
      expect(retention).toBeLessThanOrEqual(1);
      expect(Number.isFinite(retention)).toBe(true);
    }
  });

  it("負の経過時間は 0 へ clamp し retention が 1 を超えない", () => {
    expect(calculateHlrRetentionProbability(-1, 2)).toBe(1);
    expect(calculateHlrRetentionProbability(-100, 0.5)).toBe(1);
  });
});

describe("calculateHlrHalfLifeDays", () => {
  it("default parameters で正答が増えると halfLife が増える", () => {
    const none = calculateHlrHalfLifeDays(0, 0);
    const one = calculateHlrHalfLifeDays(1, 0);
    const two = calculateHlrHalfLifeDays(2, 0);
    expect(none).toBe(1);
    expect(one).toBe(2);
    expect(two).toBe(4);
    expect(two).toBeGreaterThan(one);
    expect(one).toBeGreaterThan(none);
  });

  it("default parameters で誤答が増えると halfLife が減る", () => {
    const none = calculateHlrHalfLifeDays(0, 0);
    const one = calculateHlrHalfLifeDays(0, 1);
    const two = calculateHlrHalfLifeDays(0, 2);
    expect(none).toBe(1);
    expect(one).toBe(0.5);
    expect(two).toBe(0.25);
    expect(two).toBeLessThan(one);
    expect(one).toBeLessThan(none);
  });

  it("custom parameters を渡すと結果が変化する", () => {
    const custom: HlrParameters = { intercept: 1, successWeight: 0.5, failureWeight: -0.25 };
    const defaultHalfLife = calculateHlrHalfLifeDays(3, 1);
    const customHalfLife = calculateHlrHalfLifeDays(3, 1, custom);
    expect(customHalfLife).not.toBe(defaultHalfLife);
    expect(customHalfLife).toBeCloseTo(2 ** (1 + 0.5 * 3 + -0.25 * 1));
  });

  it("異常値で NaN / Infinity を不用意に返さない", () => {
    const cases: Array<[number, number, HlrParameters?]> = [
      [Number.NaN, 0],
      [0, Number.NaN],
      [Number.POSITIVE_INFINITY, 0],
      [0, Number.NEGATIVE_INFINITY],
      [1e9, 0],
      [0, 1e9],
      [0, 0, { intercept: Number.NaN, successWeight: 1, failureWeight: -1 }],
      [0, 0, { intercept: Number.POSITIVE_INFINITY, successWeight: 1, failureWeight: -1 }],
      [10, 0, { intercept: 1000, successWeight: 1000, failureWeight: -1000 }],
      [0, 10, { intercept: -1000, successWeight: 1, failureWeight: -1000 }]
    ];
    for (const [successCount, failureCount, parameters] of cases) {
      const halfLifeDays = calculateHlrHalfLifeDays(successCount, failureCount, parameters);
      expect(Number.isFinite(halfLifeDays)).toBe(true);
      expect(halfLifeDays).toBeGreaterThan(0);
      const retention = calculateHlrRetentionProbability(3, halfLifeDays);
      expect(Number.isFinite(retention)).toBe(true);
      expect(retention).toBeGreaterThanOrEqual(0);
      expect(retention).toBeLessThanOrEqual(1);
    }
  });
});

describe("DEFAULT_HLR_PARAMETERS", () => {
  it("provisional な Leitner-derived baseline を持つ", () => {
    expect(DEFAULT_HLR_PARAMETERS).toEqual({
      intercept: 0,
      successWeight: 1,
      failureWeight: -1
    });
  });
});
