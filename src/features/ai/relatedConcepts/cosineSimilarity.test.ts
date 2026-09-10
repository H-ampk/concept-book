import { describe, expect, it } from "vitest";
import { cosineSimilarity, isValidEmbeddingVector, vectorNorm } from "./cosineSimilarity";

describe("cosineSimilarity", () => {
  it("同一 vector は 1", () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1);
  });

  it("直交 vector は 0", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it("負方向 vector は -1", () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1);
  });

  it("zero vector は null", () => {
    expect(cosineSimilarity([0, 0], [1, 0])).toBeNull();
    expect(cosineSimilarity([1, 0], [0, 0])).toBeNull();
    expect(vectorNorm([0, 0])).toBeNull();
  });

  it("dimension mismatch は null", () => {
    expect(cosineSimilarity([1, 0], [1, 0, 0])).toBeNull();
    expect(cosineSimilarity([], [1])).toBeNull();
  });

  it("不正数値は null", () => {
    expect(cosineSimilarity([Number.NaN, 1], [1, 0])).toBeNull();
    expect(cosineSimilarity([1, Number.POSITIVE_INFINITY], [1, 0])).toBeNull();
    expect(isValidEmbeddingVector([1, Number.NaN])).toBe(false);
    expect(isValidEmbeddingVector([])).toBe(false);
  });
});
