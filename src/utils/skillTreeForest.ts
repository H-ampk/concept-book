import type { Concept } from "../types/concept";
import { buildUndirectedAdjacency } from "./conceptRelations";

export type SkillTreeComponent = {
  rootId: string;
  nodeIds: string[];
  tree: Map<string, string[]>;
  mainEdges: [string, string][];
  extraEdges: [string, string][];
};

export type SkillTreeForest = {
  components: SkillTreeComponent[];
};

const edgeKey = (left: string, right: string): string =>
  left < right ? `${left}::${right}` : `${right}::${left}`;

/** graph の挿入順で未訪問ノードを起点に、反復 BFS で連結成分を列挙する。 */
export const findConnectedComponents = (graph: Map<string, string[]>): string[][] => {
  const visited = new Set<string>();
  const components: string[][] = [];

  for (const start of graph.keys()) {
    if (visited.has(start)) continue;
    const component: string[] = [];
    const queue = [start];
    visited.add(start);
    while (queue.length > 0) {
      const node = queue.shift()!;
      component.push(node);
      for (const neighbor of graph.get(node) ?? []) {
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
    components.push(component);
  }

  return components;
};

/**
 * 成分内で degree 最大の Concept を root にする。
 * 同率なら concepts 配列のより後ろを選ぶ（従来の単一 root reduce と同じ）。
 */
export const chooseComponentRoot = (
  nodeIds: readonly string[],
  degrees: ReadonlyMap<string, number>,
  orderById: ReadonlyMap<string, number>
): string => {
  let best = nodeIds[0] ?? "";
  for (const id of nodeIds) {
    const degree = degrees.get(id) ?? 0;
    const bestDegree = degrees.get(best) ?? 0;
    if (degree > bestDegree) {
      best = id;
      continue;
    }
    if (degree === bestDegree && (orderById.get(id) ?? -1) > (orderById.get(best) ?? -1)) {
      best = id;
    }
  }
  return best;
};

export const buildComponentBFSTree = (
  graph: Map<string, string[]>,
  rootId: string,
  nodeIds: ReadonlySet<string>
): Pick<SkillTreeComponent, "tree" | "mainEdges" | "extraEdges"> => {
  const tree = new Map<string, string[]>();
  const visited = new Set<string>();
  const queue: string[] = [];
  const mainEdges: [string, string][] = [];

  if (nodeIds.has(rootId)) {
    queue.push(rootId);
    visited.add(rootId);
    tree.set(rootId, []);
  }

  const allEdges = new Map<string, [string, string]>();
  for (const node of nodeIds) {
    for (const neighbor of graph.get(node) ?? []) {
      if (!nodeIds.has(neighbor)) continue;
      const [left, right] = node < neighbor ? [node, neighbor] : [neighbor, node];
      allEdges.set(edgeKey(left, right), [left, right]);
    }
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const neighbor of graph.get(current) ?? []) {
      if (!nodeIds.has(neighbor) || visited.has(neighbor)) continue;
      visited.add(neighbor);
      queue.push(neighbor);
      tree.get(current)!.push(neighbor);
      tree.set(neighbor, []);
      mainEdges.push([current, neighbor]);
    }
  }

  const mainKeys = new Set(mainEdges.map(([source, target]) => edgeKey(source, target)));
  const extraEdges: [string, string][] = [];
  allEdges.forEach(([source, target], key) => {
    if (!mainKeys.has(key)) extraEdges.push([source, target]);
  });

  return { tree, mainEdges, extraEdges };
};

export const buildSkillTreeForest = (concepts: readonly Concept[]): SkillTreeForest => {
  const graph = buildUndirectedAdjacency(concepts);
  const degrees = new Map<string, number>();
  graph.forEach((neighbors, node) => degrees.set(node, neighbors.length));
  const orderById = new Map(concepts.map((concept, index) => [concept.id, index]));

  const components = findConnectedComponents(graph).map((nodeIds) => {
    const nodeSet = new Set(nodeIds);
    const rootId = chooseComponentRoot(nodeIds, degrees, orderById);
    const built = buildComponentBFSTree(graph, rootId, nodeSet);
    return { rootId, nodeIds, ...built };
  });

  return { components };
};
