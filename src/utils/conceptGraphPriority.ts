import type { Concept } from "../types/concept";
import {
  createConceptRelationIndex,
  type ConceptRelationIndex
} from "./conceptRelations";

/**
 * hop ごとの spreading activation 減衰率。
 * selected の activation 1.0 が、weight 1 の隣接へ渡るとき 0.65 になる。
 * 1-hop を 2-hop より明確に優先しつつ、数 hop 先まで到達可能に残すための初期値。
 */
export const GRAPH_PRIORITY_HOP_DECAY = 0.65;

export type GraphPriorityReason = {
  hopDistance: number | null;
  activation: number;
  reachable: boolean;
  favoriteBonus: number;
  originalIndex: number;
};

export type RankedGraphConcept = {
  concept: Concept;
  reason: GraphPriorityReason;
};

export type ConceptGraphPriorityOptions = {
  getRelationWeight?: (sourceId: string, targetId: string) => number;
  hopDecay?: number;
};

const FAVORITE_BONUS = 1;

const clampUnitInterval = (value: number, fallback: number): number => {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(1, Math.max(0, value));
};

const relationWeight = (
  sourceId: string,
  targetId: string,
  getRelationWeight?: (sourceId: string, targetId: string) => number
): number => {
  if (!getRelationWeight) {
    return 1;
  }
  return clampUnitInterval(getRelationWeight(sourceId, targetId), 1);
};

const fallbackRanked = (concepts: readonly Concept[]): RankedGraphConcept[] =>
  concepts.map((concept, originalIndex) => ({
    concept,
    reason: {
      hopDistance: null,
      activation: 0,
      reachable: false,
      favoriteBonus: 0,
      originalIndex
    }
  }));

const compareRanked = (left: RankedGraphConcept, right: RankedGraphConcept): number => {
  const a = left.reason;
  const b = right.reason;
  if (a.reachable !== b.reachable) {
    return a.reachable ? -1 : 1;
  }
  const hopA = a.hopDistance ?? Number.POSITIVE_INFINITY;
  const hopB = b.hopDistance ?? Number.POSITIVE_INFINITY;
  if (hopA !== hopB) {
    return hopA - hopB;
  }
  if (a.activation !== b.activation) {
    return b.activation - a.activation;
  }
  if (a.favoriteBonus !== b.favoriteBonus) {
    return b.favoriteBonus - a.favoriteBonus;
  }
  return a.originalIndex - b.originalIndex;
};

/**
 * selected を起点に層単位 BFS で hopDistance / activation を付け、lexicographic に並べる。
 * selected が無い、または index に無い場合は concepts の既存順を返す。
 */
export const rankConceptsForGraphFromIndex = (
  index: ConceptRelationIndex,
  selectedId: string | undefined,
  options?: ConceptGraphPriorityOptions
): RankedGraphConcept[] => {
  const concepts = index.concepts;
  if (!selectedId || !index.conceptById.has(selectedId)) {
    return fallbackRanked(concepts);
  }

  const hopDecay = clampUnitInterval(options?.hopDecay ?? GRAPH_PRIORITY_HOP_DECAY, GRAPH_PRIORITY_HOP_DECAY);
  const getRelationWeight = options?.getRelationWeight;
  const reasons = new Map<string, GraphPriorityReason>();

  for (let originalIndex = 0; originalIndex < concepts.length; originalIndex += 1) {
    const concept = concepts[originalIndex];
    reasons.set(concept.id, {
      hopDistance: null,
      activation: 0,
      reachable: false,
      favoriteBonus: concept.favorite ? FAVORITE_BONUS : 0,
      originalIndex
    });
  }

  const selectedReason = reasons.get(selectedId);
  if (!selectedReason) {
    return fallbackRanked(concepts);
  }
  selectedReason.hopDistance = 0;
  selectedReason.activation = 1;
  selectedReason.reachable = true;

  let frontier: string[] = [selectedId];
  let hop = 0;

  while (frontier.length > 0) {
    const nextFrontier: string[] = [];
    const nextSeen = new Set<string>();

    for (const parentId of frontier) {
      const parentReason = reasons.get(parentId);
      if (!parentReason) {
        continue;
      }
      const parentActivation = parentReason.activation;
      for (const neighborId of index.adjacency.get(parentId) ?? []) {
        const neighborReason = reasons.get(neighborId);
        if (!neighborReason) {
          continue;
        }
        if (neighborReason.reachable && neighborReason.hopDistance !== null && neighborReason.hopDistance <= hop) {
          continue;
        }

        const candidateActivation =
          parentActivation * relationWeight(parentId, neighborId, getRelationWeight) * hopDecay;
        const candidateHop = hop + 1;

        if (!neighborReason.reachable) {
          neighborReason.reachable = true;
          neighborReason.hopDistance = candidateHop;
          neighborReason.activation = candidateActivation;
          nextFrontier.push(neighborId);
          nextSeen.add(neighborId);
          continue;
        }

        if (neighborReason.hopDistance === candidateHop) {
          neighborReason.activation = Math.max(neighborReason.activation, candidateActivation);
          if (!nextSeen.has(neighborId)) {
            nextFrontier.push(neighborId);
            nextSeen.add(neighborId);
          }
        }
      }
    }

    frontier = nextFrontier;
    hop += 1;
  }

  const ranked: RankedGraphConcept[] = [];
  for (const concept of concepts) {
    const reason = reasons.get(concept.id);
    if (reason) {
      ranked.push({ concept, reason });
    }
  }
  ranked.sort(compareRanked);
  return ranked;
};

export const rankConceptsForGraph = (
  concepts: readonly Concept[],
  selectedId: string | undefined,
  options?: ConceptGraphPriorityOptions
): RankedGraphConcept[] =>
  rankConceptsForGraphFromIndex(createConceptRelationIndex(concepts), selectedId, options);
