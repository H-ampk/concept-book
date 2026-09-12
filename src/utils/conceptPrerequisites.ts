import type { Concept } from "../types/concept";

export const PREREQUISITE_CYCLE_SAVE_ERROR =
  "この前提概念を設定すると循環するため保存できません。";

export type PrerequisiteGraphNode = {
  id: string;
  prerequisiteIds?: readonly string[];
};

export type ConceptPrerequisiteIndex = {
  conceptById: Map<string, Concept>;
  orderById: Map<string, number>;
  /**
   * dependent → その前提 Concept ID。
   * edge は常に prerequisite → dependent。
   */
  prerequisitesByConceptId: Map<string, string[]>;
  /**
   * prerequisite → それを前提とする Concept ID。
   * edge は常に prerequisite → dependent。
   */
  dependentsByConceptId: Map<string, string[]>;
};

const sameIdList = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((id, index) => id === b[index]);

/**
 * prerequisite ID 配列を保存前に正規化する。
 * trim・空除去・重複除去・自己参照除去・（指定時）存在しない ID 除去。
 * 元配列順は維持する。
 */
export const normalizePrerequisiteIdList = (
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

const buildPrerequisiteAdjacency = (
  nodes: readonly PrerequisiteGraphNode[]
): {
  existingIds: Set<string>;
  prerequisitesByConceptId: Map<string, string[]>;
  dependentsByConceptId: Map<string, string[]>;
} => {
  const existingIds = new Set<string>();
  const prerequisitesByConceptId = new Map<string, string[]>();
  const dependentsByConceptId = new Map<string, string[]>();

  for (const node of nodes) {
    existingIds.add(node.id);
    prerequisitesByConceptId.set(node.id, []);
    dependentsByConceptId.set(node.id, []);
  }

  for (const node of nodes) {
    const prerequisites = normalizePrerequisiteIdList(node.prerequisiteIds, {
      selfId: node.id,
      existingIds
    });
    prerequisitesByConceptId.set(node.id, prerequisites);
    for (const prerequisiteId of prerequisites) {
      dependentsByConceptId.get(prerequisiteId)?.push(node.id);
    }
  }

  return { existingIds, prerequisitesByConceptId, dependentsByConceptId };
};

/** Concept[] から有向 prerequisite index を O(V + E) で構築する。 */
export const buildConceptPrerequisiteIndex = (
  concepts: readonly Concept[]
): ConceptPrerequisiteIndex => {
  const conceptById = new Map<string, Concept>();
  const orderById = new Map<string, number>();
  for (let index = 0; index < concepts.length; index += 1) {
    const concept = concepts[index];
    conceptById.set(concept.id, concept);
    orderById.set(concept.id, index);
  }

  const { prerequisitesByConceptId, dependentsByConceptId } = buildPrerequisiteAdjacency(concepts);

  return {
    conceptById,
    orderById,
    prerequisitesByConceptId,
    dependentsByConceptId
  };
};

/**
 * startId から dependents 方向（prerequisite → dependent）へ到達可能な ID。
 * startId 自身を含む。
 */
export const collectReachableDependentIds = (
  index: ConceptPrerequisiteIndex,
  startId: string
): Set<string> => {
  const reachable = new Set<string>([startId]);
  const queue = [startId];
  for (let i = 0; i < queue.length; i += 1) {
    const currentId = queue[i];
    const dependents = index.dependentsByConceptId.get(currentId);
    if (!dependents) {
      continue;
    }
    for (const dependentId of dependents) {
      if (reachable.has(dependentId)) {
        continue;
      }
      reachable.add(dependentId);
      queue.push(dependentId);
    }
  }
  return reachable;
};

/**
 * P → D を追加すると cycle になるか。
 * D から dependents を辿って P に到達可能なら cycle。
 */
export const wouldCreatePrerequisiteCycle = (
  index: ConceptPrerequisiteIndex,
  prerequisiteId: string,
  dependentId: string
): boolean => {
  if (!prerequisiteId || !dependentId) {
    return false;
  }
  if (prerequisiteId === dependentId) {
    return true;
  }
  return collectReachableDependentIds(index, dependentId).has(prerequisiteId);
};

/**
 * 有向辺 prerequisite → dependent の cycle を1つ返す。
 * 例: ["A", "B", "C", "A"]。無ければ null。
 * DFS、O(V + E)。
 */
export const findPrerequisiteCycle = (
  nodes: readonly PrerequisiteGraphNode[]
): string[] | null => {
  const { dependentsByConceptId } = buildPrerequisiteAdjacency(nodes);
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];

  const dfs = (id: string): string[] | null => {
    visiting.add(id);
    stack.push(id);
    const dependents = dependentsByConceptId.get(id) ?? [];
    for (const nextId of dependents) {
      if (visiting.has(nextId)) {
        const cycleStart = stack.indexOf(nextId);
        return [...stack.slice(cycleStart), nextId];
      }
      if (visited.has(nextId)) {
        continue;
      }
      const found = dfs(nextId);
      if (found) {
        return found;
      }
    }
    stack.pop();
    visiting.delete(id);
    visited.add(id);
    return null;
  };

  for (const node of nodes) {
    if (visited.has(node.id) || visiting.has(node.id)) {
      continue;
    }
    const found = dfs(node.id);
    if (found) {
      return found;
    }
  }
  return null;
};

export const formatPrerequisiteCycleImportError = (cyclePath: readonly string[]): string =>
  `前提概念に循環があるためインポートできません:\n${cyclePath.join(" → ")}`;

export const assertAcyclicPrerequisiteGraph = (
  nodes: readonly PrerequisiteGraphNode[]
): void => {
  const cycle = findPrerequisiteCycle(nodes);
  if (cycle) {
    throw new Error(PREREQUISITE_CYCLE_SAVE_ERROR);
  }
};

/**
 * 対象 Concept の prerequisiteIds を proposed に置換した prospective graph を検証し、
 * 正規化済み配列を返す。cycle なら保存用エラーを throw する。
 */
export const resolvePrerequisiteIdsForUpdate = (
  concepts: readonly PrerequisiteGraphNode[],
  conceptId: string,
  proposedIds: readonly string[] | undefined
): string[] => {
  const existingIds = new Set(concepts.map((concept) => concept.id));
  const prerequisiteIds = normalizePrerequisiteIdList(proposedIds, {
    selfId: conceptId,
    existingIds
  });
  const prospective = concepts.map((concept) =>
    concept.id === conceptId ? { ...concept, prerequisiteIds } : concept
  );
  assertAcyclicPrerequisiteGraph(prospective);
  return prerequisiteIds;
};

/** 新規 Concept 用。通常 cycle は起きないが invariant は維持する。 */
export const resolvePrerequisiteIdsForCreate = (
  existingConcepts: readonly PrerequisiteGraphNode[],
  newId: string,
  proposedIds: readonly string[] | undefined
): string[] => {
  const existingIds = new Set(existingConcepts.map((concept) => concept.id));
  existingIds.add(newId);
  const prerequisiteIds = normalizePrerequisiteIdList(proposedIds, {
    selfId: newId,
    existingIds
  });
  assertAcyclicPrerequisiteGraph([
    ...existingConcepts,
    { id: newId, prerequisiteIds }
  ]);
  return prerequisiteIds;
};

/**
 * import の最終 Concept 集合をメモリ上で構築し、orphan 除去と cycle 検証を行う。
 * 保存前に呼ぶこと。cycle なら throw し、呼び出し側は一切書き込まない。
 */
export const planConceptPrerequisiteImport = (
  existing: readonly Concept[],
  incoming: readonly Concept[],
  mode: "replace" | "merge"
): Concept[] => {
  let merged: Concept[];
  if (mode === "replace") {
    merged = incoming.map((concept) => ({ ...concept }));
  } else {
    const byId = new Map(existing.map((concept) => [concept.id, concept]));
    for (const concept of incoming) {
      const current = byId.get(concept.id);
      if (!current) {
        byId.set(concept.id, concept);
        continue;
      }
      byId.set(
        concept.id,
        current.updatedAt.localeCompare(concept.updatedAt) >= 0 ? current : concept
      );
    }
    merged = [...byId.values()];
  }

  const existingIds = new Set(merged.map((concept) => concept.id));
  const normalized = merged.map((concept) => ({
    ...concept,
    prerequisiteIds: normalizePrerequisiteIdList(concept.prerequisiteIds, {
      selfId: concept.id,
      existingIds
    })
  }));

  const cycle = findPrerequisiteCycle(normalized);
  if (cycle) {
    throw new Error(formatPrerequisiteCycleImportError(cycle));
  }
  return normalized;
};

export const prerequisiteIdsEqual = (a: readonly string[] | undefined, b: readonly string[] | undefined): boolean =>
  sameIdList(a ?? [], b ?? []);
