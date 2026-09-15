import { describe, expect, it } from "vitest";
import { createEmptyConceptInput, type Concept } from "../types/concept";
import { buildSkillTreeConceptOrder } from "./skillTreeWindow";

const concept = (id: string, relatedIds: string[] = []): Concept => ({
  ...createEmptyConceptInput(),
  id,
  title: id,
  relatedIds,
  createdAt: "t",
  updatedAt: "t"
});

const ids = (concepts: Concept[]): string[] => concepts.map((item) => item.id);

const windowAt = (concepts: readonly Concept[], limit: number): Concept[] =>
  buildSkillTreeConceptOrder(concepts).slice(0, Math.min(limit, concepts.length));

describe("buildSkillTreeConceptOrder", () => {
  it("0件なら空配列", () => {
    expect(buildSkillTreeConceptOrder([])).toEqual([]);
  });

  it("1件はそのまま返す", () => {
    const solo = concept("only");
    expect(buildSkillTreeConceptOrder([solo])).toEqual([solo]);
  });

  it("少数Conceptでは全件返す", () => {
    const concepts = [concept("a", ["b"]), concept("b", ["a"]), concept("c")];
    const ordered = buildSkillTreeConceptOrder(concepts);
    expect(ordered).toHaveLength(3);
    expect(new Set(ids(ordered))).toEqual(new Set(["a", "b", "c"]));
  });

  it("配列後方の高degree hubが初期windowへ入る", () => {
    const leaves = Array.from({ length: 250 }, (_, index) => concept(`leaf-${index}`));
    const hub = concept(
      "hub",
      leaves.slice(0, 249).map((leaf) => leaf.id)
    );
    const concepts = [...leaves, hub];
    const firstWindow = windowAt(concepts, 250);
    const firstIds = ids(firstWindow);

    expect(firstWindow).toHaveLength(250);
    expect(firstIds).toContain("hub");
    expect(firstIds).not.toEqual(ids(leaves));
    expect(firstIds[0]).toBe("hub");
  });

  it("hubと直接neighborが元配列順より近くにまとまる", () => {
    const unrelated = Array.from({ length: 10 }, (_, index) => concept(`u-${index}`));
    const hub = concept("hub", ["n-a", "n-b", "n-c"]);
    const neighbors = [concept("n-a", ["hub"]), concept("n-b", ["hub"]), concept("n-c", ["hub"])];
    const concepts = [...unrelated, ...neighbors, hub];
    const orderedIds = ids(buildSkillTreeConceptOrder(concepts));
    const hubIndex = orderedIds.indexOf("hub");
    const neighborIndexes = ["n-a", "n-b", "n-c"].map((id) => orderedIds.indexOf(id));

    expect(hubIndex).toBe(0);
    neighborIndexes.forEach((index) => {
      expect(index).toBeGreaterThan(hubIndex);
      expect(index).toBeLessThanOrEqual(3);
    });
  });

  it("同じ入力なら毎回同じ順序", () => {
    const concepts = [
      concept("c", ["a"]),
      concept("a", ["b", "c"]),
      concept("b", ["a"]),
      concept("d")
    ];
    expect(ids(buildSkillTreeConceptOrder(concepts))).toEqual(
      ids(buildSkillTreeConceptOrder(concepts))
    );
  });

  it("同degreeなら元配列index、必要ならidで安定する", () => {
    const concepts = [concept("b"), concept("a"), concept("c")];
    expect(ids(buildSkillTreeConceptOrder(concepts))).toEqual(["b", "a", "c"]);
  });

  it("同一Conceptが複数回入らない", () => {
    const concepts = [
      concept("a", ["b", "b"]),
      concept("b", ["a", "a"]),
      concept("c", ["missing"])
    ];
    const ordered = buildSkillTreeConceptOrder(concepts);
    expect(ordered).toHaveLength(new Set(ids(ordered)).size);
  });

  it("Concept数 > limit なら window は limit を超えない", () => {
    const concepts = Array.from({ length: 40 }, (_, index) => concept(`c-${index}`));
    expect(windowAt(concepts, 10)).toHaveLength(10);
    expect(windowAt(concepts, 25)).toHaveLength(25);
  });

  it("250→500で最初の250件が維持される", () => {
    const leaves = Array.from({ length: 600 }, (_, index) => concept(`leaf-${index}`));
    const hub = concept(
      "hub",
      leaves.slice(0, 80).map((leaf) => leaf.id)
    );
    const concepts = [...leaves, hub];
    const ordered = buildSkillTreeConceptOrder(concepts);
    const first = ordered.slice(0, 250);
    const second = ordered.slice(0, 500);
    expect(ids(first)).toEqual(ids(second).slice(0, 250));
  });

  it("存在しない relatedIds があっても壊れない", () => {
    const concepts = [concept("a", ["ghost", "b"]), concept("b", ["a", "nope"])];
    expect(() => buildSkillTreeConceptOrder(concepts)).not.toThrow();
    expect(ids(buildSkillTreeConceptOrder(concepts)).sort()).toEqual(["a", "b"]);
  });
});
