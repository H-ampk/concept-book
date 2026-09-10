import { describe, expect, it } from "vitest";
import { retrieveRelatedConceptCandidates } from "./retrieveRelatedConceptCandidates";

describe("retrieveRelatedConceptCandidates", () => {
  const embeddings = new Map<string, number[]>([
    ["self", [1, 0]],
    ["related", [0.99, 0.01]],
    ["top", [0.9, 0.1]],
    ["mid", [0.5, 0.5]],
    ["low", [0.1, 0.9]],
    ["bad", []]
  ]);

  it("similarity 降順で self / 既関連 / 不正 vector を除外する", () => {
    const result = retrieveRelatedConceptCandidates({
      query: [1, 0],
      embeddings,
      selfId: "self",
      relatedIds: new Set(["related"]),
      limit: 20
    });
    expect(result.map((item) => item.conceptId)).toEqual(["top", "mid", "low"]);
    expect(result[0]?.similarity ?? 0).toBeGreaterThan(result[1]?.similarity ?? 0);
  });

  it("上限 20 件に切る", () => {
    const many = new Map<string, number[]>();
    for (let i = 0; i < 30; i += 1) {
      many.set(`c${i}`, [1, i / 100]);
    }
    const result = retrieveRelatedConceptCandidates({
      query: [1, 0],
      embeddings: many,
      relatedIds: new Set(),
      limit: 20
    });
    expect(result).toHaveLength(20);
  });
});
