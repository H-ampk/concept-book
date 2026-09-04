import { describe, expect, it } from "vitest";
import type { Concept } from "../types/concept";
import { collectUndirectedConceptEdges } from "./conceptRelations";
import { createGraphTestConcepts, GRAPH_TEST_DEFAULT_SEED } from "./conceptGraphTestData";

const connectedComponents = (concepts: Concept[]): string[][] => {
  const byId = new Map(concepts.map((concept) => [concept.id, concept]));
  const seen = new Set<string>();
  const components: string[][] = [];

  for (const concept of concepts) {
    if (seen.has(concept.id)) {
      continue;
    }
    const queue = [concept.id];
    seen.add(concept.id);
    const members: string[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      members.push(current);
      const node = byId.get(current);
      for (const relatedId of node?.relatedIds ?? []) {
        if (!seen.has(relatedId) && byId.has(relatedId)) {
          seen.add(relatedId);
          queue.push(relatedId);
        }
      }
    }
    components.push(members);
  }

  return components;
};

const meanDegree = (concepts: Concept[]): number => {
  if (concepts.length === 0) {
    return 0;
  }
  const total = concepts.reduce((sum, concept) => sum + concept.relatedIds.length, 0);
  return total / concepts.length;
};

describe("createGraphTestConcepts", () => {
  it.each([200, 500, 1000])("指定件数 %i と生成件数が一致する", (conceptCount) => {
    const concepts = createGraphTestConcepts({ conceptCount });
    expect(concepts).toHaveLength(conceptCount);
  });

  it("同じ options から生成した結果が完全一致する", () => {
    const options = { conceptCount: 500, averageRelations: 4, seed: 103 };
    expect(createGraphTestConcepts(options)).toEqual(createGraphTestConcepts(options));
  });

  it("seed を変えると topology の一部が変わる", () => {
    const a = createGraphTestConcepts({ conceptCount: 200, seed: 103 });
    const b = createGraphTestConcepts({ conceptCount: 200, seed: 104 });
    expect(a.map((c) => c.relatedIds)).not.toEqual(b.map((c) => c.relatedIds));
  });

  it("全 ID が一意で、自己参照・存在しない relatedId・重複 relatedIds がない", () => {
    const concepts = createGraphTestConcepts({ conceptCount: 1000, seed: GRAPH_TEST_DEFAULT_SEED });
    const ids = concepts.map((concept) => concept.id);
    expect(new Set(ids).size).toBe(ids.length);

    const idSet = new Set(ids);
    for (const concept of concepts) {
      expect(concept.relatedIds).not.toContain(concept.id);
      expect(new Set(concept.relatedIds).size).toBe(concept.relatedIds.length);
      for (const relatedId of concept.relatedIds) {
        expect(idSet.has(relatedId)).toBe(true);
      }
    }
  });

  it("関係は無向である", () => {
    const concepts = createGraphTestConcepts({ conceptCount: 1000 });
    const byId = new Map(concepts.map((concept) => [concept.id, concept]));
    for (const concept of concepts) {
      for (const relatedId of concept.relatedIds) {
        expect(byId.get(relatedId)?.relatedIds).toContain(concept.id);
      }
    }
  });

  it("1000件 fixture の topology を満たす", () => {
    const concepts = createGraphTestConcepts({ conceptCount: 1000, averageRelations: 4, seed: 103 });
    const components = connectedComponents(concepts).sort((a, b) => b.length - a.length);

    expect(concepts.some((concept) => concept.relatedIds.length === 0)).toBe(true);
    expect(Math.max(...concepts.map((concept) => concept.relatedIds.length))).toBeGreaterThan(8);
    expect(components.length).toBeGreaterThan(1);
    expect(components[0].length).toBeGreaterThan(700);
    expect(components.some((component) => component.length >= 5 && component.length <= 10)).toBe(true);
  });

  it("favorite と domainTags のバリエーションがある", () => {
    const concepts = createGraphTestConcepts({ conceptCount: 200 });
    expect(concepts.some((concept) => concept.favorite)).toBe(true);
    expect(concepts.some((concept) => !concept.favorite)).toBe(true);
    expect(concepts.some((concept) => concept.domainTags.length === 1)).toBe(true);
    expect(concepts.some((concept) => concept.domainTags.length >= 2)).toBe(true);
  });

  it("平均次数が目標から極端に外れない", () => {
    const concepts = createGraphTestConcepts({
      conceptCount: 1000,
      averageRelations: 4,
      seed: 103
    });
    const degree = meanDegree(concepts);
    expect(degree).toBeGreaterThanOrEqual(2.5);
    expect(degree).toBeLessThanOrEqual(6);
    expect(collectUndirectedConceptEdges(concepts).length).toBeGreaterThan(1000);
  });

  it("10,000件 smoke: 生成でき、IDが一意で自己参照・不正 relatedId がない", () => {
    const concepts = createGraphTestConcepts({
      conceptCount: 10_000,
      averageRelations: 4,
      seed: GRAPH_TEST_DEFAULT_SEED
    });
    expect(concepts).toHaveLength(10_000);
    const ids = concepts.map((concept) => concept.id);
    const idSet = new Set(ids);
    expect(idSet.size).toBe(10_000);
    for (const concept of concepts) {
      expect(concept.relatedIds).not.toContain(concept.id);
      for (const relatedId of concept.relatedIds) {
        expect(idSet.has(relatedId)).toBe(true);
      }
    }
  });

  it("異常な件数でも無限ループせず空配列または有限件になる", () => {
    expect(createGraphTestConcepts({ conceptCount: Number.NaN })).toEqual([]);
    expect(createGraphTestConcepts({ conceptCount: -10 })).toEqual([]);
    expect(createGraphTestConcepts({ conceptCount: Number.POSITIVE_INFINITY })).toEqual([]);
    expect(createGraphTestConcepts({ conceptCount: 2.9 })).toHaveLength(2);
  });
});
