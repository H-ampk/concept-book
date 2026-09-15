import type { Concept } from "../types/concept";
import { createConceptRelationIndex } from "./conceptRelations";

const compareSkillTreeOrderIds = (
  a: string,
  b: string,
  degrees: Map<string, number>,
  orderById: Map<string, number>
): number => {
  const degreeDiff = (degrees.get(b) ?? 0) - (degrees.get(a) ?? 0);
  if (degreeDiff !== 0) return degreeDiff;
  const indexDiff = (orderById.get(a) ?? 0) - (orderById.get(b) ?? 0);
  if (indexDiff !== 0) return indexDiff;
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
};

/**
 * SkillTree 段階表示用の、limit に依存しない全体順序。
 * 無向 graph の degree が高い hub を seed にし、そこから BFS で近傍をまとめる。
 */
export const buildSkillTreeConceptOrder = (concepts: readonly Concept[]): Concept[] => {
  if (concepts.length === 0) return [];
  if (concepts.length === 1) return [concepts[0]];

  const index = createConceptRelationIndex(concepts);
  const degrees = new Map<string, number>();
  for (const concept of concepts) {
    degrees.set(concept.id, index.adjacency.get(concept.id)?.length ?? 0);
  }

  const compareIds = (a: string, b: string) =>
    compareSkillTreeOrderIds(a, b, degrees, index.orderById);

  const seedCandidates = concepts.map((concept) => concept.id).sort(compareIds);
  const sortedAdjacency = new Map<string, string[]>();
  index.adjacency.forEach((neighbors, id) => {
    sortedAdjacency.set(id, [...neighbors].sort(compareIds));
  });

  const visited = new Set<string>();
  const ordered: Concept[] = [];

  for (const seed of seedCandidates) {
    if (visited.has(seed)) continue;
    const queue = [seed];
    visited.add(seed);

    while (queue.length > 0) {
      const current = queue.shift()!;
      const concept = index.conceptById.get(current);
      if (concept) ordered.push(concept);

      for (const neighbor of sortedAdjacency.get(current) ?? []) {
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }

  return ordered;
};
