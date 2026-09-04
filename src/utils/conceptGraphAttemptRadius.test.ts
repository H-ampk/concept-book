import { describe, expect, it } from "vitest";
import {
  GRAPH_ATTEMPT_RADIUS_MAX,
  GRAPH_ATTEMPT_RADIUS_MIN,
  getConceptGraphAttemptLabel,
  getConceptGraphAttemptRadius,
  getConceptGraphNodeRadius
} from "./conceptGraphAttemptRadius";

describe("getConceptGraphAttemptRadius", () => {
  it("0回は最小サイズになる", () => {
    expect(getConceptGraphAttemptRadius(0)).toBe(GRAPH_ATTEMPT_RADIUS_MIN);
  });

  it("学習回数に対して単調増加する", () => {
    expect(getConceptGraphAttemptRadius(1)).toBeGreaterThan(getConceptGraphAttemptRadius(0));
    expect(getConceptGraphAttemptRadius(5)).toBeGreaterThan(getConceptGraphAttemptRadius(1));
    expect(getConceptGraphAttemptRadius(20)).toBeGreaterThan(getConceptGraphAttemptRadius(5));
    expect(getConceptGraphAttemptRadius(100)).toBeGreaterThan(getConceptGraphAttemptRadius(20));
  });

  it("非常に大きな値でも最大 radius を超えない", () => {
    expect(getConceptGraphAttemptRadius(1_000_000)).toBeLessThanOrEqual(GRAPH_ATTEMPT_RADIUS_MAX);
  });

  it("負値と非有限値は 0 回として扱う", () => {
    expect(getConceptGraphAttemptRadius(-10)).toBe(GRAPH_ATTEMPT_RADIUS_MIN);
    expect(getConceptGraphAttemptRadius(Number.NaN)).toBe(GRAPH_ATTEMPT_RADIUS_MIN);
    expect(getConceptGraphAttemptRadius(Number.POSITIVE_INFINITY)).toBe(GRAPH_ATTEMPT_RADIUS_MIN);
  });
});

describe("getConceptGraphNodeRadius", () => {
  it("通常モードでは favorite がサイズに影響する", () => {
    expect(
      getConceptGraphNodeRadius({ metricMode: "normal", totalAttempts: 0, isFavorite: true })
    ).toBeGreaterThan(
      getConceptGraphNodeRadius({ metricMode: "normal", totalAttempts: 0, isFavorite: false })
    );
  });

  it("学習回数モードでは favorite がサイズに影響しない", () => {
    const favorite = getConceptGraphNodeRadius({
      metricMode: "attempts",
      totalAttempts: 8,
      isFavorite: true
    });
    const notFavorite = getConceptGraphNodeRadius({
      metricMode: "attempts",
      totalAttempts: 8,
      isFavorite: false
    });
    expect(favorite).toBe(notFavorite);
  });
});

describe("getConceptGraphAttemptLabel", () => {
  it("0回は未学習と表示する", () => {
    expect(getConceptGraphAttemptLabel(0)).toBe("未学習");
  });

  it("学習済みは N回 と表示する", () => {
    expect(getConceptGraphAttemptLabel(18)).toBe("18回");
  });
});
