import type { Concept } from "../types/concept";

export type UndirectedConceptEdge = {
  source: string;
  target: string;
};

export type RelatedIdsDiff = {
  added: string[];
  removed: string[];
};

/** 無向辺の正規化キー。ID を split して復元する用途には使わない */
export const undirectedEdgeKey = (a: string, b: string): string => {
  const [left, right] = a < b ? [a, b] : [b, a];
  return `${left}::${right}`;
};

export const canonicalUndirectedPair = (a: string, b: string): [string, string] =>
  a < b ? [a, b] : [b, a];

/**
 * relatedIds を保存前に正規化する。
 * trim・空除去・重複除去・自己参照除去・（指定時）存在しない ID 除去。
 */
export const normalizeRelatedIdList = (
  ids: readonly string[] | undefined,
  options?: {
    selfId?: string;
    existingIds?: ReadonlySet<string>;
  }
): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of ids ?? []) {
    const id = raw.trim();
    if (!id) {
      continue;
    }
    if (options?.selfId && id === options.selfId) {
      continue;
    }
    if (options?.existingIds && !options.existingIds.has(id)) {
      continue;
    }
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    out.push(id);
  }
  return out;
};

export const diffRelatedIds = (oldIds: readonly string[], newIds: readonly string[]): RelatedIdsDiff => {
  const oldSet = new Set(oldIds);
  const newSet = new Set(newIds);
  const added: string[] = [];
  const removed: string[] = [];
  for (const id of newSet) {
    if (!oldSet.has(id)) {
      added.push(id);
    }
  }
  for (const id of oldSet) {
    if (!newSet.has(id)) {
      removed.push(id);
    }
  }
  return { added, removed };
};

export const withRelatedIdAdded = (
  relatedIds: readonly string[],
  peerId: string,
  selfId: string
): string[] => normalizeRelatedIdList([...relatedIds, peerId], { selfId });

export const withRelatedIdRemoved = (relatedIds: readonly string[], peerId: string): string[] =>
  relatedIds.filter((id) => id !== peerId);

const relatedIdsEqual = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((id, index) => id === b[index]);

/**
 * 既存データ / import 後の relatedIds を無向関係として修復する。
 * A→B または B→A があれば A↔B に補完する。
 */
export const repairUndirectedRelatedIds = (
  concepts: readonly Concept[]
): { concepts: Concept[]; changedIds: string[] } => {
  const existingIds = new Set(concepts.map((concept) => concept.id));
  const cleaned = concepts.map((concept) => ({
    ...concept,
    relatedIds: normalizeRelatedIdList(concept.relatedIds, {
      selfId: concept.id,
      existingIds
    })
  }));

  const neighbors = new Map<string, Set<string>>();
  for (const concept of cleaned) {
    neighbors.set(concept.id, new Set(concept.relatedIds));
  }
  for (const concept of cleaned) {
    for (const otherId of concept.relatedIds) {
      neighbors.get(otherId)?.add(concept.id);
    }
  }

  const changedIds: string[] = [];
  const next = cleaned.map((concept) => {
    const union = neighbors.get(concept.id) ?? new Set<string>();
    const seen = new Set(concept.relatedIds);
    const appended: string[] = [];
    for (const id of union) {
      if (!seen.has(id)) {
        seen.add(id);
        appended.push(id);
      }
    }
    appended.sort((a, b) => a.localeCompare(b));
    const relatedIds = [...concept.relatedIds, ...appended];
    if (!relatedIdsEqual(relatedIds, concept.relatedIds)) {
      changedIds.push(concept.id);
    }
    return { ...concept, relatedIds };
  });

  return { concepts: next, changedIds };
};

/**
 * Concept 配列から一意な無向辺を生成する。
 * source / target の向きに意味はなく、A—B は必ず1本。
 */
export const collectUndirectedConceptEdges = (
  concepts: readonly Concept[]
): UndirectedConceptEdge[] => {
  const idSet = new Set(concepts.map((concept) => concept.id));
  const seen = new Set<string>();
  const edges: UndirectedConceptEdge[] = [];

  for (const concept of concepts) {
    for (const relatedId of concept.relatedIds) {
      const peer = relatedId.trim();
      if (!peer || peer === concept.id || !idSet.has(peer)) {
        continue;
      }
      const [left, right] = canonicalUndirectedPair(concept.id, peer);
      const key = `${left}::${right}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      edges.push({ source: left, target: right });
    }
  }

  return edges;
};

/** 無向辺から隣接リストを構築する */
export const buildUndirectedAdjacency = (
  concepts: readonly Concept[]
): Map<string, string[]> => {
  const graph = new Map<string, string[]>();
  for (const concept of concepts) {
    graph.set(concept.id, []);
  }
  for (const { source, target } of collectUndirectedConceptEdges(concepts)) {
    graph.get(source)?.push(target);
    graph.get(target)?.push(source);
  }
  return graph;
};
