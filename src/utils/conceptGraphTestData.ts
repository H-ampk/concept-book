import { conceptStatusList, type Concept } from "../types/concept";

export type ConceptGraphTestDataOptions = {
  conceptCount: number;
  averageRelations?: number;
  seed?: number;
};

export const GRAPH_TEST_DOMAIN_TAGS = [
  "人工知能",
  "哲学",
  "心理学",
  "教育工学",
  "HCI",
  "情報科学",
  "社会科学",
  "認知科学"
] as const;

export const GRAPH_TEST_DEFAULT_AVERAGE_RELATIONS = 4;
export const GRAPH_TEST_DEFAULT_SEED = 103;
export const GRAPH_TEST_TIMESTAMP = "2026-01-01T00:00:00.000Z";

const MAX_CONCEPT_COUNT = 50_000;

type Rng = () => number;

const createSeededRng = (seed: number): Rng => {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const toNonNegativeInt = (value: number, fallback: number, max: number): number => {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(0, Math.floor(value)));
};

const graphTestConceptId = (index: number, width: number): string =>
  `graph-test-${String(index + 1).padStart(width, "0")}`;

const randInt = (rng: Rng, minInclusive: number, maxInclusive: number): number => {
  if (maxInclusive <= minInclusive) {
    return minInclusive;
  }
  return minInclusive + Math.floor(rng() * (maxInclusive - minInclusive + 1));
};

const addUndirectedEdge = (adj: Set<string>[], a: number, b: number, ids: string[]): boolean => {
  if (a === b) {
    return false;
  }
  const idA = ids[a];
  const idB = ids[b];
  if (!idA || !idB || adj[a].has(idB)) {
    return false;
  }
  adj[a].add(idB);
  adj[b].add(idA);
  return true;
};

const domainTagsForIndex = (index: number): string[] => {
  const tagCount = index % 17 === 0 ? 3 : index % 5 === 0 ? 2 : 1;
  const tags: string[] = [];
  for (let offset = 0; offset < tagCount; offset += 1) {
    tags.push(GRAPH_TEST_DOMAIN_TAGS[(index + offset) % GRAPH_TEST_DOMAIN_TAGS.length]);
  }
  return tags;
};

const allocatePartition = (
  n: number,
  rng: Rng
): { large: number[]; clusters: number[][]; isolates: number[] } => {
  if (n === 0) {
    return { large: [], clusters: [], isolates: [] };
  }

  let isolatedCount = n >= 3 ? Math.max(1, Math.round(n * 0.03)) : 0;
  isolatedCount = Math.min(isolatedCount, Math.max(0, n - 1));

  let smallBudget = Math.round(n * 0.12);
  if (smallBudget < 5) {
    smallBudget = 0;
  }
  smallBudget = Math.min(smallBudget, Math.max(0, n - isolatedCount));

  let largeCount = n - isolatedCount - smallBudget;
  if (n >= 20 && largeCount < Math.floor(n * 0.8)) {
    const needed = Math.floor(n * 0.8) - largeCount;
    const fromSmall = Math.min(needed, Math.max(0, smallBudget - 5));
    smallBudget -= fromSmall;
    largeCount += fromSmall;
  }

  const leftoverSmall = smallBudget % 5 < 5 && smallBudget < 5 ? smallBudget : 0;
  if (leftoverSmall > 0 && leftoverSmall < 5) {
    largeCount += leftoverSmall;
    smallBudget -= leftoverSmall;
  }

  const indices = Array.from({ length: n }, (_, i) => i);
  let cursor = 0;
  const large = indices.slice(cursor, cursor + largeCount);
  cursor += largeCount;

  const clusters: number[][] = [];
  let remainingSmall = smallBudget;
  while (remainingSmall >= 5) {
    const maxSize = Math.min(10, remainingSmall);
    const size = remainingSmall >= 10 ? randInt(rng, 5, maxSize) : remainingSmall;
    if (size < 5) {
      break;
    }
    clusters.push(indices.slice(cursor, cursor + size));
    cursor += size;
    remainingSmall -= size;
  }
  if (remainingSmall > 0) {
    large.push(...indices.slice(cursor, cursor + remainingSmall));
    cursor += remainingSmall;
  }

  const isolates = indices.slice(cursor);
  return { large, clusters, isolates };
};

const connectRing = (adj: Set<string>[], nodes: number[], ids: string[]): number => {
  if (nodes.length < 2) {
    return 0;
  }
  let edges = 0;
  for (let i = 0; i < nodes.length - 1; i += 1) {
    if (addUndirectedEdge(adj, nodes[i], nodes[i + 1], ids)) {
      edges += 1;
    }
  }
  if (nodes.length >= 3 && addUndirectedEdge(adj, nodes[nodes.length - 1], nodes[0], ids)) {
    edges += 1;
  }
  return edges;
};

const addRandomEdgesInGroup = (
  adj: Set<string>[],
  nodes: number[],
  ids: string[],
  rng: Rng,
  wanted: number
): number => {
  if (wanted <= 0 || nodes.length < 2) {
    return 0;
  }
  let added = 0;
  const maxAttempts = wanted * 40 + 80;
  for (let attempt = 0; attempt < maxAttempts && added < wanted; attempt += 1) {
    const a = nodes[randInt(rng, 0, nodes.length - 1)];
    const b = nodes[randInt(rng, 0, nodes.length - 1)];
    if (addUndirectedEdge(adj, a, b, ids)) {
      added += 1;
    }
  }
  return added;
};

/**
 * 決定的な疑似 Concept 配列を生成する。IndexedDB には書き込まない。
 */
export const createGraphTestConcepts = (options: ConceptGraphTestDataOptions): Concept[] => {
  const conceptCount = toNonNegativeInt(options.conceptCount, 0, MAX_CONCEPT_COUNT);
  const seed = toNonNegativeInt(
    options.seed ?? GRAPH_TEST_DEFAULT_SEED,
    GRAPH_TEST_DEFAULT_SEED,
    0xffffffff
  );
  const averageRelations = Number.isFinite(options.averageRelations)
    ? Math.max(0, options.averageRelations as number)
    : GRAPH_TEST_DEFAULT_AVERAGE_RELATIONS;

  if (conceptCount === 0) {
    return [];
  }

  const rng = createSeededRng(seed);
  const idWidth = Math.max(5, String(conceptCount).length);
  const ids = Array.from({ length: conceptCount }, (_, index) => graphTestConceptId(index, idWidth));
  const adj = Array.from({ length: conceptCount }, () => new Set<string>());
  const { large, clusters } = allocatePartition(conceptCount, rng);

  let edgeCount = connectRing(adj, large, ids);
  for (const cluster of clusters) {
    edgeCount += connectRing(adj, cluster, ids);
    if (cluster.length >= 4) {
      edgeCount += addRandomEdgesInGroup(adj, cluster, ids, rng, Math.ceil(cluster.length / 3));
    }
  }

  const hubCount = large.length >= 8 ? Math.min(12, Math.max(1, Math.round(large.length * 0.02))) : 0;
  const hubDegreeTarget = large.length >= 8 ? Math.min(36, Math.max(8, Math.floor(large.length * 0.04))) : 0;
  for (let h = 0; h < hubCount; h += 1) {
    const hub = large[h];
    let extra = 0;
    const maxAttempts = hubDegreeTarget * 20 + 20;
    for (let attempt = 0; attempt < maxAttempts && extra < hubDegreeTarget; attempt += 1) {
      const peer = large[randInt(rng, 0, large.length - 1)];
      if (addUndirectedEdge(adj, hub, peer, ids)) {
        extra += 1;
        edgeCount += 1;
      }
    }
  }

  const targetEdges = Math.round((conceptCount * averageRelations) / 2);
  const remaining = targetEdges - edgeCount;
  edgeCount += addRandomEdgesInGroup(adj, large, ids, rng, remaining);

  return ids.map((id, index) => {
    const relatedIds = [...adj[index]].sort((a, b) => a.localeCompare(b));
    const padded = String(index + 1).padStart(idWidth, "0");
    return {
      id,
      title: `Performance Concept ${padded}`,
      definition: `Performance test definition ${padded}`,
      myInterpretation: `Performance interpretation ${padded}`,
      domainTags: domainTagsForIndex(index),
      researchTags: [],
      relatedIds,
      media: [],
      source: {
        book: "Performance Fixture",
        page: String(index + 1),
        author: null
      },
      notes: "",
      status: conceptStatusList[index % conceptStatusList.length],
      favorite: index % 13 === 0,
      createdAt: GRAPH_TEST_TIMESTAMP,
      updatedAt: GRAPH_TEST_TIMESTAMP,
      contextDefinitions: []
    };
  });
};
