import { useMemo } from "react";
import type { Concept } from "../types/concept";
import { getDomainTagColor } from "../utils/domainColors";

type Props = {
  concepts: Concept[];
  domainColorMap: Record<string, string>;
  selectedId?: string;
  onSelectConcept: (id: string) => void;
};

// 補助関数: 無向グラフの隣接リスト構築
const buildGraph = (concepts: Concept[]): Map<string, string[]> => {
  const graph = new Map<string, string[]>();
  concepts.forEach((concept) => {
    graph.set(concept.id, []);
  });
  concepts.forEach((concept) => {
    concept.relatedIds.forEach((relatedId) => {
      if (graph.has(relatedId)) {
        // 無向なので両方向に追加
        if (!graph.get(concept.id)!.includes(relatedId)) {
          graph.get(concept.id)!.push(relatedId);
        }
        if (!graph.get(relatedId)!.includes(concept.id)) {
          graph.get(relatedId)!.push(concept.id);
        }
      }
    });
  });
  return graph;
};

// 補助関数: degree 計算
const computeDegree = (graph: Map<string, string[]>): Map<string, number> => {
  const degrees = new Map<string, number>();
  graph.forEach((neighbors, node) => {
    degrees.set(node, neighbors.length);
  });
  return degrees;
};

// 補助関数: BFS でツリー構築
const buildBFSTree = (
  graph: Map<string, string[]>,
  root: string
): {
  tree: Map<string, string[]>;
  visited: Set<string>;
  mainEdges: [string, string][];
  extraEdges: [string, string][];
} => {
  const tree = new Map<string, string[]>();
  const visited = new Set<string>();
  const queue: string[] = [root];
  visited.add(root);
  tree.set(root, []);
  const mainEdges: [string, string][] = [];
  const extraEdges: [string, string][] = [];

  // 全エッジを収集（重複除去のため Set）
  const allEdges = new Set<string>();
  graph.forEach((neighbors, node) => {
    neighbors.forEach((neighbor) => {
      const edgeKey = node < neighbor ? `${node}-${neighbor}` : `${neighbor}-${node}`;
      allEdges.add(edgeKey);
    });
  });

  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighbors = graph.get(current) || [];
    neighbors.forEach((neighbor) => {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
        tree.get(current)!.push(neighbor);
        tree.set(neighbor, []);
        mainEdges.push([current, neighbor]);
      }
    });
  }

  // extraEdges: BFS で使われなかったエッジ
  allEdges.forEach((edgeKey) => {
    const [source, target] = edgeKey.split('-');
    const isMain = mainEdges.some(([s, t]) => (s === source && t === target) || (s === target && t === source));
    if (!isMain) {
      extraEdges.push([source, target]);
    }
  });

  return { tree, visited, mainEdges, extraEdges };
};

// 補助関数: ツリーレイアウト計算
const computeTreeLayout = (
  tree: Map<string, string[]>,
  concepts: Concept[],
  width: number,
  height: number
): {
  nodes: { id: string; x: number; y: number; title: string; domainTag: string; favorite: boolean }[];
  mainEdges: [string, string][];
  extraEdges: [string, string][];
} => {
  const conceptMap = new Map(concepts.map((c) => [c.id, c]));
  const depths = new Map<string, number>();
  const levelNodes = new Map<number, string[]>();

  // BFS で depth 計算
  const queue: { node: string; depth: number }[] = [{ node: Array.from(tree.keys())[0], depth: 0 }];
  depths.set(queue[0].node, 0);
  if (!levelNodes.has(0)) levelNodes.set(0, []);
  levelNodes.get(0)!.push(queue[0].node);

  while (queue.length > 0) {
    const { node, depth } = queue.shift()!;
    const children = tree.get(node) || [];
    children.forEach((child) => {
      if (!depths.has(child)) {
        depths.set(child, depth + 1);
        if (!levelNodes.has(depth + 1)) levelNodes.set(depth + 1, []);
        levelNodes.get(depth + 1)!.push(child);
        queue.push({ node: child, depth: depth + 1 });
      }
    });
  }

  // レイアウト: x = depth * 200, y = 同じ depth 内で均等
  const maxDepth = Math.max(...Array.from(depths.values()));
  const nodes: { id: string; x: number; y: number; title: string; domainTag: string; favorite: boolean }[] = [];
  const xStep = width / (maxDepth + 1);
  const yMargin = 50;

  levelNodes.forEach((nodesAtDepth, depth) => {
    const yStep = (height - yMargin * 2) / Math.max(nodesAtDepth.length, 1);
    nodesAtDepth.forEach((nodeId, index) => {
      const concept = conceptMap.get(nodeId)!;
      nodes.push({
        id: nodeId,
        x: (depth + 1) * xStep,
        y: yMargin + index * yStep,
        title: concept.title,
        domainTag: concept.domainTags[0] || '',
        favorite: concept.favorite,
      });
    });
  });

  // mainEdges と extraEdges は buildBFSTree から取得済み
  const { mainEdges, extraEdges } = buildBFSTree(buildGraph(concepts), Array.from(tree.keys())[0]);

  return { nodes, mainEdges, extraEdges };
};

export const SkillTreeView = ({ concepts, domainColorMap, selectedId, onSelectConcept }: Props) => {
  const layoutData = useMemo(() => {
    if (concepts.length === 0) return { nodes: [], mainEdges: [], extraEdges: [] };

    const graph = buildGraph(concepts);
    const degrees = computeDegree(graph);
    const root = Array.from(degrees.entries()).reduce((a, b) => (a[1] > b[1] ? a : b))[0];
    const { tree } = buildBFSTree(graph, root);

    return computeTreeLayout(tree, concepts, 800, 600); // 仮のサイズ
  }, [concepts]);

  const handleNodeClick = (id: string) => {
    onSelectConcept(id);
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-quiet">
      <header className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">スキルツリー</h3>
        <p className="text-xs text-slate-500">
          ノード {layoutData.nodes.length} / 主エッジ {layoutData.mainEdges.length} / 追加エッジ {layoutData.extraEdges.length}
        </p>
      </header>

      <div className="w-full overflow-auto rounded-lg border border-slate-100 bg-slate-50">
        <svg width="800" height="600" viewBox="0 0 800 600">
          {/* 主エッジ */}
          {layoutData.mainEdges.map(([source, target], index) => {
            const sourceNode = layoutData.nodes.find((n) => n.id === source);
            const targetNode = layoutData.nodes.find((n) => n.id === target);
            if (!sourceNode || !targetNode) return null;
            return (
              <line
                key={`main-${index}`}
                x1={sourceNode.x}
                y1={sourceNode.y}
                x2={targetNode.x}
                y2={targetNode.y}
                stroke="#374151"
                strokeWidth="2"
              />
            );
          })}
          {/* 追加エッジ（点線） */}
          {layoutData.extraEdges.map(([source, target], index) => {
            const sourceNode = layoutData.nodes.find((n) => n.id === source);
            const targetNode = layoutData.nodes.find((n) => n.id === target);
            if (!sourceNode || !targetNode) return null;
            return (
              <line
                key={`extra-${index}`}
                x1={sourceNode.x}
                y1={sourceNode.y}
                x2={targetNode.x}
                y2={targetNode.y}
                stroke="#9ca3af"
                strokeWidth="1"
                strokeDasharray="5,5"
              />
            );
          })}
          {/* ノード */}
          {layoutData.nodes.map((node) => {
            const color = getDomainTagColor(node.domainTag, domainColorMap);
            const radius = node.favorite ? 8 : 6;
            const isSelected = selectedId === node.id;
            const displayTitle = node.title.length > 10 ? node.title.slice(0, 10) + '...' : node.title;
            return (
              <g key={node.id} onClick={() => handleNodeClick(node.id)} style={{ cursor: 'pointer' }}>
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={radius}
                  fill={color}
                  stroke={isSelected ? "#0f172a" : node.favorite ? "#f59e0b" : "none"}
                  strokeWidth={isSelected ? 2 : node.favorite ? 1 : 0}
                />
                <text
                  x={node.x}
                  y={node.y + radius + 10}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#334155"
                >
                  {displayTitle}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        研究テーマタグ・検索・状態・お気に入りフィルタの結果を対象に表示します。実線は主ツリー、点線は追加関係。
      </p>
    </section>
  );
};