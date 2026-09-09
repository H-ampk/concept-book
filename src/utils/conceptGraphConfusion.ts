import type { ConfusionPairStat } from "./quizStats";

export type ConfusionGraphMode = "off" | "direct" | "knn";

export type DirectConfusionEdge = {
  source: string;
  target: string;
  count: number;
};

export type ConfusionKnnEdge = {
  source: string;
  target: string;
  similarity: number;
};

export type ConfusionProfile = ReadonlyMap<string, ReadonlyMap<string, number>>;

export const DEFAULT_CONFUSION_K = 3;

export const CONFUSION_GRAPH_MODES: { mode: ConfusionGraphMode; label: string }[] = [
  { mode: "off", label: "OFF" },
  { mode: "direct", label: "直接混同" },
  { mode: "knn", label: "混同近傍" }
];

export const DIRECT_CONFUSION_LINE_WIDTH_MIN = 1.5;
export const DIRECT_CONFUSION_LINE_WIDTH_MAX = 3.8;
export const DIRECT_CONFUSION_LINE_WIDTH_SCALE = 0.7;
export const DIRECT_CONFUSION_STROKE = "rgba(196, 112, 72, 0.72)";
export const DIRECT_CONFUSION_DASH_LENGTH = 6;
export const DIRECT_CONFUSION_GAP_LENGTH = 4;

export const KNN_CONFUSION_LINE_WIDTH_MIN = 1.2;
export const KNN_CONFUSION_LINE_WIDTH_RANGE = 2.0;
export const KNN_CONFUSION_OPACITY_MIN = 0.35;
export const KNN_CONFUSION_OPACITY_RANGE = 0.5;
export const KNN_CONFUSION_STROKE = "rgba(118, 86, 168, 1)";
export const KNN_CONFUSION_DASH_LENGTH = 1.6;
export const KNN_CONFUSION_GAP_LENGTH = 3.6;

const pairKey = (source: string, target: string): string => `${source}\u0000${target}`;

const isUsableConceptId = (id: string | null): id is string =>
  typeof id === "string" && id.length > 0;

const usableCount = (count: number): number =>
  Number.isFinite(count) && count > 0 ? count : 0;

const lexicalPair = (a: string, b: string): readonly [string, string] => (a < b ? [a, b] : [b, a]);

const sortUndirectedEdges = <T extends { source: string; target: string }>(edges: T[]): T[] =>
  edges.sort((left, right) => {
    const sourceCmp = left.source.localeCompare(right.source);
    if (sourceCmp !== 0) {
      return sourceCmp;
    }
    return left.target.localeCompare(right.target);
  });

const clamp01 = (value: number): number => {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.min(1, value);
};

/**
 * 方向付き混同ペアを無向の直接混同エッジへ変換する。入力は変更しない。
 */
export const buildDirectConfusionEdges = (
  pairs: readonly ConfusionPairStat[],
  validConceptIds: ReadonlySet<string>
): DirectConfusionEdge[] => {
  const merged = new Map<string, DirectConfusionEdge>();

  for (const pair of pairs) {
    const a = pair.selectedConceptId;
    const b = pair.correctConceptId;
    if (!isUsableConceptId(a) || !isUsableConceptId(b)) {
      continue;
    }
    if (a === b) {
      continue;
    }
    if (!validConceptIds.has(a) || !validConceptIds.has(b)) {
      continue;
    }

    const count = usableCount(pair.count);
    if (count <= 0) {
      continue;
    }

    const [source, target] = lexicalPair(a, b);
    const key = pairKey(source, target);
    const existing = merged.get(key);
    if (existing) {
      existing.count += count;
    } else {
      merged.set(key, { source, target, count });
    }
  }

  return sortUndirectedEdges([...merged.values()]);
};

/**
 * v_i[j] = 正解 Concept i を Concept j として誤答した回数。
 * 行 = correctConceptId、列 = selectedConceptId。
 */
export const buildConfusionProfiles = (
  pairs: readonly ConfusionPairStat[],
  validConceptIds: ReadonlySet<string>
): Map<string, Map<string, number>> => {
  const profiles = new Map<string, Map<string, number>>();

  for (const pair of pairs) {
    const selected = pair.selectedConceptId;
    const correct = pair.correctConceptId;
    if (!isUsableConceptId(selected) || !isUsableConceptId(correct)) {
      continue;
    }
    if (selected === correct) {
      continue;
    }
    if (!validConceptIds.has(selected) || !validConceptIds.has(correct)) {
      continue;
    }

    const count = usableCount(pair.count);
    if (count <= 0) {
      continue;
    }

    let row = profiles.get(correct);
    if (!row) {
      row = new Map();
      profiles.set(correct, row);
    }
    row.set(selected, (row.get(selected) ?? 0) + count);
  }

  return profiles;
};

const sparseNorm = (vector: ReadonlyMap<string, number>): number => {
  let sumSquares = 0;
  for (const value of vector.values()) {
    if (Number.isFinite(value)) {
      sumSquares += value * value;
    }
  }
  return Math.sqrt(sumSquares);
};

export const cosineSimilaritySparse = (
  a: ReadonlyMap<string, number>,
  b: ReadonlyMap<string, number>
): number => {
  if (a.size === 0 || b.size === 0) {
    return 0;
  }

  const [smaller, larger] = a.size <= b.size ? [a, b] : [b, a];
  let dot = 0;
  for (const [key, left] of smaller) {
    const right = larger.get(key);
    if (right === undefined || !Number.isFinite(left) || !Number.isFinite(right)) {
      continue;
    }
    dot += left * right;
  }

  if (dot <= 0) {
    return 0;
  }

  const normA = sparseNorm(a);
  const normB = sparseNorm(b);
  if (normA === 0 || normB === 0) {
    return 0;
  }

  const cosine = dot / (normA * normB);
  if (!Number.isFinite(cosine) || cosine <= 0) {
    return 0;
  }
  if (cosine >= 1 - 1e-12) {
    return 1;
  }
  return Math.min(1, cosine);
};

const buildSelectedToCorrectIndex = (
  profiles: ConfusionProfile
): Map<string, Set<string>> => {
  const index = new Map<string, Set<string>>();
  for (const [correctId, features] of profiles) {
    for (const selectedId of features.keys()) {
      let owners = index.get(selectedId);
      if (!owners) {
        owners = new Set();
        index.set(selectedId, owners);
      }
      owners.add(correctId);
    }
  }
  return index;
};

const collectCandidates = (
  correctId: string,
  features: ReadonlyMap<string, number>,
  inverted: Map<string, Set<string>>
): Set<string> => {
  const candidates = new Set<string>();
  for (const selectedId of features.keys()) {
    const owners = inverted.get(selectedId);
    if (!owners) {
      continue;
    }
    for (const other of owners) {
      if (other !== correctId) {
        candidates.add(other);
      }
    }
  }
  return candidates;
};

export const buildConfusionKnnEdges = (
  profiles: ConfusionProfile,
  options?: { k?: number }
): ConfusionKnnEdge[] => {
  const k = options?.k ?? DEFAULT_CONFUSION_K;
  if (!Number.isFinite(k) || k <= 0) {
    return [];
  }

  const inverted = buildSelectedToCorrectIndex(profiles);
  const merged = new Map<string, ConfusionKnnEdge>();

  for (const [correctId, features] of profiles) {
    if (features.size === 0) {
      continue;
    }
    const candidates = collectCandidates(correctId, features, inverted);
    if (candidates.size === 0) {
      continue;
    }

    const ranked: { id: string; similarity: number }[] = [];
    for (const otherId of candidates) {
      const otherFeatures = profiles.get(otherId);
      if (!otherFeatures || otherFeatures.size === 0) {
        continue;
      }
      const similarity = cosineSimilaritySparse(features, otherFeatures);
      if (similarity <= 0) {
        continue;
      }
      ranked.push({ id: otherId, similarity });
    }

    ranked.sort((left, right) => {
      if (right.similarity !== left.similarity) {
        return right.similarity - left.similarity;
      }
      return left.id.localeCompare(right.id);
    });

    const neighbors = ranked.slice(0, k);
    for (const neighbor of neighbors) {
      const [source, target] = lexicalPair(correctId, neighbor.id);
      const key = pairKey(source, target);
      const existing = merged.get(key);
      if (!existing || neighbor.similarity > existing.similarity) {
        merged.set(key, { source, target, similarity: neighbor.similarity });
      }
    }
  }

  return sortUndirectedEdges([...merged.values()]);
};

export const filterUndirectedEdgesByVisibleIds = <T extends { source: string; target: string }>(
  edges: readonly T[],
  visibleConceptIds: ReadonlySet<string>
): T[] =>
  edges.filter(
    (edge) => visibleConceptIds.has(edge.source) && visibleConceptIds.has(edge.target)
  );

export const getDirectConfusionLineWidth = (count: number): number => {
  const safeCount = usableCount(count);
  if (safeCount <= 0) {
    return DIRECT_CONFUSION_LINE_WIDTH_MIN;
  }
  const width =
    DIRECT_CONFUSION_LINE_WIDTH_MIN + Math.log1p(safeCount) * DIRECT_CONFUSION_LINE_WIDTH_SCALE;
  return Math.min(DIRECT_CONFUSION_LINE_WIDTH_MAX, width);
};

export const getConfusionKnnLineWidth = (similarity: number): number => {
  const s = clamp01(similarity);
  return KNN_CONFUSION_LINE_WIDTH_MIN + s * KNN_CONFUSION_LINE_WIDTH_RANGE;
};

export const getConfusionKnnOpacity = (similarity: number): number => {
  const s = clamp01(similarity);
  return KNN_CONFUSION_OPACITY_MIN + s * KNN_CONFUSION_OPACITY_RANGE;
};
