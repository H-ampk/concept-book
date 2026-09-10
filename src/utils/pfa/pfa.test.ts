import { describe, expect, it } from "vitest";
import { DEFAULT_PFA_PARAMETERS } from "./constants";
import { calculatePfaNextCorrectProbability } from "./pfa";
import type { PfaParameters } from "./types";

const sigmoid = (logit: number): number => 1 / (1 + Math.exp(-logit));

const expectedProbability = (
  successCount: number,
  failureCount: number,
  parameters: PfaParameters = DEFAULT_PFA_PARAMETERS
): number =>
  sigmoid(
    parameters.intercept + parameters.successWeight * successCount + parameters.failureWeight * failureCount
  );

describe("calculatePfaNextCorrectProbability", () => {
  it("ログ0件相当（成功0・失敗0）は sigmoid(intercept) を返す", () => {
    expect(calculatePfaNextCorrectProbability(0, 0)).toBeCloseTo(expectedProbability(0, 0));
    expect(calculatePfaNextCorrectProbability(0, 0)).toBeCloseTo(0.5);
  });

  it("成功のみでは正の successWeight により確率が上昇する", () => {
    const none = calculatePfaNextCorrectProbability(0, 0);
    const one = calculatePfaNextCorrectProbability(1, 0);
    const two = calculatePfaNextCorrectProbability(2, 0);
    expect(one).toBeGreaterThan(none);
    expect(two).toBeGreaterThan(one);
    expect(two).toBeCloseTo(expectedProbability(2, 0));
  });

  it("失敗のみでは負の failureWeight により確率が低下する", () => {
    const none = calculatePfaNextCorrectProbability(0, 0);
    const one = calculatePfaNextCorrectProbability(0, 1);
    const two = calculatePfaNextCorrectProbability(0, 2);
    expect(one).toBeLessThan(none);
    expect(two).toBeLessThan(one);
    expect(two).toBeCloseTo(expectedProbability(0, 2));
  });

  it("成功・失敗混在では counts と parameters から決定的に同じ確率になる", () => {
    const mixed = calculatePfaNextCorrectProbability(4, 2);
    expect(mixed).toBeCloseTo(expectedProbability(4, 2));
    expect(calculatePfaNextCorrectProbability(4, 2)).toBe(mixed);
  });

  it("successCount が増えると、正の successWeight では probability が上昇する", () => {
    const p1 = calculatePfaNextCorrectProbability(1, 1);
    const p2 = calculatePfaNextCorrectProbability(2, 1);
    const p3 = calculatePfaNextCorrectProbability(3, 1);
    expect(p2).toBeGreaterThan(p1);
    expect(p3).toBeGreaterThan(p2);
  });

  it("failureCount が増えると、負の failureWeight では probability が低下する", () => {
    const p1 = calculatePfaNextCorrectProbability(2, 1);
    const p2 = calculatePfaNextCorrectProbability(2, 2);
    const p3 = calculatePfaNextCorrectProbability(2, 3);
    expect(p2).toBeLessThan(p1);
    expect(p3).toBeLessThan(p2);
  });

  it("probability は常に 0〜1", () => {
    const cases: Array<[number, number, PfaParameters?]> = [
      [0, 0],
      [1, 0],
      [0, 1],
      [4, 2],
      [1000, 0],
      [0, 1000],
      [50, 50],
      [0, 0, { intercept: 20, successWeight: 5, failureWeight: -5 }],
      [0, 0, { intercept: -20, successWeight: 5, failureWeight: -5 }]
    ];
    for (const [successCount, failureCount, parameters] of cases) {
      const probability = calculatePfaNextCorrectProbability(successCount, failureCount, parameters);
      expect(probability).toBeGreaterThanOrEqual(0);
      expect(probability).toBeLessThanOrEqual(1);
      expect(Number.isFinite(probability)).toBe(true);
    }
  });

  it("異なる PfaParameters を渡すと結果が変わる", () => {
    const mild: PfaParameters = { intercept: 0, successWeight: 0.2, failureWeight: -0.2 };
    const strong: PfaParameters = { intercept: 0, successWeight: 1, failureWeight: -1 };
    const mildP = calculatePfaNextCorrectProbability(3, 1, mild);
    const strongP = calculatePfaNextCorrectProbability(3, 1, strong);
    expect(mildP).not.toBe(strongP);
    expect(strongP).toBeGreaterThan(mildP);
  });

  it("intercept が異なればログ0件相当の prior も変わる", () => {
    const zero = calculatePfaNextCorrectProbability(0, 0, { intercept: 0, successWeight: 0.4, failureWeight: -0.4 });
    const shifted = calculatePfaNextCorrectProbability(0, 0, {
      intercept: 1,
      successWeight: 0.4,
      failureWeight: -0.4
    });
    expect(zero).toBeCloseTo(0.5);
    expect(shifted).toBeCloseTo(sigmoid(1));
    expect(shifted).toBeGreaterThan(zero);
  });
});
