import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { Concept } from "../types/concept";
import { getDomainTagColor } from "../utils/domainColors";
import { OrnamentLine } from "./common/OrnamentLine";

type Props = {
  concepts: Concept[];
  domainColorMap: Record<string, string>;
  selectedId?: string;
  onSelectConcept: (id: string) => void;
};

type LayoutNode = {
  id: string;
  x: number;
  y: number;
  title: string;
  domainTag: string;
  favorite: boolean;
  width: number;
  height: number;
  isRoot: boolean;
};

type LayoutData = {
  nodes: LayoutNode[];
  mainEdges: [string, string][];
  extraEdges: [string, string][];
  rootId: string;
};

// 補助関数: 無向グラフの隣接リスト構築
const buildGraph = (concepts: Concept[]): Map<string, string[]> => {
  const graph = new Map<string, string[]>();
  concepts.forEach((concept) => graph.set(concept.id, []));

  concepts.forEach((concept) => {
    concept.relatedIds.forEach((relatedId) => {
      if (!graph.has(relatedId)) return;
      const neighbors = graph.get(concept.id)!;
      if (!neighbors.includes(relatedId)) neighbors.push(relatedId);
      const opposite = graph.get(relatedId)!;
      if (!opposite.includes(concept.id)) opposite.push(concept.id);
    });
  });

  return graph;
};

// 補助関数: degree 計算
const computeDegree = (graph: Map<string, string[]>): Map<string, number> => {
  const degrees = new Map<string, number>();
  graph.forEach((neighbors, node) => degrees.set(node, neighbors.length));
  return degrees;
};

// 補助関数: BFS でツリー構築
const buildBFSTree = (
  graph: Map<string, string[]>,
  root: string
): {
  tree: Map<string, string[]>;
  mainEdges: [string, string][];
  extraEdges: [string, string][];
} => {
  const tree = new Map<string, string[]>();
  const visited = new Set<string>();
  const queue: string[] = [root];
  visited.add(root);
  tree.set(root, []);
  const mainEdges: [string, string][] = [];

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

  const extraEdges: [string, string][] = [];
  allEdges.forEach((edgeKey) => {
    const [source, target] = edgeKey.split("-");
    const isMain = mainEdges.some(
      ([s, t]) => (s === source && t === target) || (s === target && t === source)
    );
    if (!isMain) extraEdges.push([source, target]);
  });

  return { tree, mainEdges, extraEdges };
};

const normalizeLabelLines = (title: string): string[] => {
  const maxChars = 18;
  if (title.length <= maxChars) return [title];
  const first = title.slice(0, maxChars);
  const rest = title.slice(maxChars, maxChars * 2);
  const second = rest.length > maxChars ? `${rest.slice(0, maxChars - 3)}...` : rest;
  return [first, second];
};

// ナビゲーションデータ
type NavigationData = {
  rootId: string;
  parentById: Map<string, string>;
  childrenById: Map<string, string[]>;
  depthById: Map<string, number>;
  nodesByDepth: Map<number, string[]>;
};

const buildNavigationData = (tree: Map<string, string[]>, rootId: string): NavigationData => {
  const parentById = new Map<string, string>();
  const childrenById = new Map<string, string[]>();
  const depthById = new Map<string, number>();
  const nodesByDepth = new Map<number, string[]>();

  const queue: { node: string; depth: number }[] = [{ node: rootId, depth: 0 }];
  depthById.set(rootId, 0);
  nodesByDepth.set(0, [rootId]);
  childrenById.set(rootId, tree.get(rootId) ?? []);

  while (queue.length > 0) {
    const { node, depth } = queue.shift()!;
    const children = tree.get(node) ?? [];
    childrenById.set(node, children);
    children.forEach((child) => {
      if (depthById.has(child)) return;
      depthById.set(child, depth + 1);
      parentById.set(child, node);
      const current = nodesByDepth.get(depth + 1) ?? [];
      nodesByDepth.set(depth + 1, [...current, child]);
      queue.push({ node: child, depth: depth + 1 });
    });
  }

  return { rootId, parentById, childrenById, depthById, nodesByDepth };
};

// 補助関数: ツリーレイアウト計算
const computeTreeLayout = (
  tree: Map<string, string[]>,
  concepts: Concept[],
  rootId: string,
  width: number,
  height: number
): LayoutData => {
  const conceptMap = new Map(concepts.map((c) => [c.id, c]));
  const depths = new Map<string, number>();
  const levelNodes = new Map<number, string[]>();

  const queue: { node: string; depth: number }[] = [{ node: rootId, depth: 0 }];
  depths.set(rootId, 0);
  levelNodes.set(0, [rootId]);

  while (queue.length > 0) {
    const { node, depth } = queue.shift()!;
    const children = tree.get(node) || [];
    children.forEach((child) => {
      if (depths.has(child)) return;
      depths.set(child, depth + 1);
      const current = levelNodes.get(depth + 1) ?? [];
      levelNodes.set(depth + 1, [...current, child]);
      queue.push({ node: child, depth: depth + 1 });
    });
  }

  const maxDepth = Math.max(...Array.from(depths.values()));
  const xMargin = 80;
  const yMargin = 40;
  const columnWidth = (width - xMargin * 2) / Math.max(maxDepth, 1);
  const cardWidth = 160;
  const cardHeight = 54;

  const nodes: LayoutNode[] = [];
  levelNodes.forEach((ids, depth) => {
    const columnX = xMargin + depth * columnWidth;
    const availableHeight = height - yMargin * 2;
    const rowStep = Math.max(cardHeight + 18, availableHeight / Math.max(ids.length, 1));
    ids.forEach((id, index) => {
      const concept = conceptMap.get(id)!;
      const centerY = yMargin + index * rowStep + cardHeight / 2;
      nodes.push({
        id,
        x: columnX,
        y: centerY,
        title: concept.title,
        domainTag: concept.domainTags[0] || "",
        favorite: concept.favorite,
        width: cardWidth,
        height: cardHeight,
        isRoot: id === rootId,
      });
    });
  });

  const { mainEdges, extraEdges } = buildBFSTree(buildGraph(concepts), rootId);

  return { nodes, mainEdges, extraEdges, rootId };
};

export const SkillTreeView = ({ concepts, domainColorMap, selectedId, onSelectConcept }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const layoutData = useMemo<LayoutData>(() => {
    if (concepts.length === 0) return { nodes: [], mainEdges: [], extraEdges: [], rootId: "" };

    const graph = buildGraph(concepts);
    const degrees = computeDegree(graph);
    const root = Array.from(degrees.entries()).reduce((a, b) => (a[1] > b[1] ? a : b))[0];
    const { tree, mainEdges, extraEdges } = buildBFSTree(graph, root);
    const data = computeTreeLayout(tree, concepts, root, 900, 640);

    return { ...data, mainEdges, extraEdges };
  }, [concepts]);

  const navigationData = useMemo(() => {
    if (layoutData.rootId === "") {
      return {
        rootId: "",
        parentById: new Map<string, string>(),
        childrenById: new Map<string, string[]>(),
        depthById: new Map<string, number>(),
        nodesByDepth: new Map<number, string[]>(),
      };
    }
    const graph = buildGraph(concepts);
    const root = layoutData.rootId;
    const { tree } = buildBFSTree(graph, root);
    return buildNavigationData(tree, root);
  }, [concepts, layoutData.rootId]);

  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panOrigin, setPanOrigin] = useState<{ x: number; y: number } | null>(null);
  const [pointerStart, setPointerStart] = useState<{ x: number; y: number } | null>(null);

  const handleNodeClick = (id: string) => {
    onSelectConcept(id);
  };

  const nodeById = new Map(layoutData.nodes.map((node) => [node.id, node]));

  const handleBackgroundPointerDown = (event: React.PointerEvent<SVGRectElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    setIsPanning(true);
    setPointerStart({ x: event.clientX, y: event.clientY });
    setPanOrigin(offset);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<any>) => {
    if (!isPanning || !pointerStart || !panOrigin) return;
    const dx = event.clientX - pointerStart.x;
    const dy = event.clientY - pointerStart.y;
    setOffset({ x: panOrigin.x + dx, y: panOrigin.y + dy });
  };

  const handlePointerUp = (event: React.PointerEvent<any>) => {
    if (!isPanning) return;
    setIsPanning(false);
    setPointerStart(null);
    setPanOrigin(null);
    if (event.currentTarget.releasePointerCapture) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const currentId = selectedId ?? navigationData.rootId;
    if (!currentId) return;

    let nextId: string | undefined;
    const currentDepth = navigationData.depthById.get(currentId);

    switch (event.key) {
      case "ArrowRight": {
        const children = navigationData.childrenById.get(currentId) ?? [];
        nextId = children[0];
        break;
      }
      case "ArrowLeft":
        nextId = navigationData.parentById.get(currentId);
        break;
      case "ArrowUp":
        if (currentDepth !== undefined) {
          const siblings = navigationData.nodesByDepth.get(currentDepth) ?? [];
          const index = siblings.indexOf(currentId);
          if (index > 0) nextId = siblings[index - 1];
        }
        break;
      case "ArrowDown":
        if (currentDepth !== undefined) {
          const siblings = navigationData.nodesByDepth.get(currentDepth) ?? [];
          const index = siblings.indexOf(currentId);
          if (index >= 0 && index < siblings.length - 1) nextId = siblings[index + 1];
        }
        break;
    }

    if (!selectedId && event.key.startsWith("Arrow") && navigationData.rootId) {
      event.preventDefault();
      onSelectConcept(navigationData.rootId);
      return;
    }

    if (nextId && nextId !== currentId) {
      event.preventDefault();
      onSelectConcept(nextId);
    }
  };

  useEffect(() => {
    if (!selectedId || !containerRef.current) return;
    const node = nodeById.get(selectedId);
    if (!node) return;

    const container = containerRef.current;
    const padding = 24;
    const targetLeft = Math.max(0, node.x - node.width / 2 - padding);
    const targetTop = Math.max(0, node.y - node.height / 2 - padding);
    const targetRight = node.x + node.width / 2 + padding;
    const targetBottom = node.y + node.height / 2 + padding;

    const visibleLeft = container.scrollLeft;
    const visibleTop = container.scrollTop;
    const visibleRight = visibleLeft + container.clientWidth;
    const visibleBottom = visibleTop + container.clientHeight;

    const scrollLeft =
      targetLeft < visibleLeft
        ? targetLeft
        : targetRight > visibleRight
        ? Math.min(targetLeft, container.scrollWidth - container.clientWidth)
        : visibleLeft;
    const scrollTop =
      targetTop < visibleTop
        ? targetTop
        : targetBottom > visibleBottom
        ? Math.min(targetTop, container.scrollHeight - container.clientHeight)
        : visibleTop;

    if (scrollLeft !== visibleLeft || scrollTop !== visibleTop) {
      container.scrollTo({ left: scrollLeft, top: scrollTop, behavior: "smooth" });
    }
  }, [selectedId, nodeById]);

  return (
    <section className="rounded-2xl border border-celestial-border bg-celestial-panel p-3 shadow-celestial decorated-card">
      <span className="card-corner card-corner-top-left" aria-hidden="true" />
      <span className="card-corner card-corner-top-right" aria-hidden="true" />
      <span className="card-corner card-corner-bottom-left" aria-hidden="true" />
      <span className="card-corner card-corner-bottom-right" aria-hidden="true" />
      <OrnamentLine variant="panel" />
      <header className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-celestial-textMain">スキルツリー</h3>
        <p className="text-xs text-celestial-textSub">
          ノード {layoutData.nodes.length} / 主エッジ {layoutData.mainEdges.length} / 追加エッジ {layoutData.extraEdges.length}
        </p>
      </header>

      <div
        ref={containerRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="w-full overflow-auto scrollbar-none rounded-lg border border-celestial-border bg-nordic-surface focus:outline-none focus:ring-2 focus:ring-celestial-softGold/40"
        style={{ cursor: isPanning ? "grabbing" : "grab" }}
      >
        <svg width="900" height="640" viewBox="0 0 900 640" onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}>
          <rect
            x="0"
            y="0"
            width="900"
            height="640"
            fill="transparent"
            onPointerDown={handleBackgroundPointerDown}
          />
          {layoutData.mainEdges.map(([source, target], index) => {
            const sourceNode = nodeById.get(source);
            const targetNode = nodeById.get(target);
            if (!sourceNode || !targetNode) return null;
            const x1 = sourceNode.x + sourceNode.width / 2 + offset.x;
            const y1 = sourceNode.y + offset.y;
            const x2 = targetNode.x - targetNode.width / 2 + offset.x;
            const y2 = targetNode.y + offset.y;
            return (
              <line
                key={`main-${index}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#8c6b1f"
                strokeWidth="2"
                opacity="0.9"
              />
            );
          })}

          {layoutData.extraEdges.map(([source, target], index) => {
            const sourceNode = nodeById.get(source);
            const targetNode = nodeById.get(target);
            if (!sourceNode || !targetNode) return null;
            const isSelectedRelated = selectedId === source || selectedId === target;
            const x1 = sourceNode.x + sourceNode.width / 2 + offset.x;
            const y1 = sourceNode.y + offset.y;
            const x2 = targetNode.x - targetNode.width / 2 + offset.x;
            const y2 = targetNode.y + offset.y;
            return (
              <line
                key={`extra-${index}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="rgba(56,189,248,0.42)"
                strokeWidth={isSelectedRelated ? 1.5 : 0.8}
                strokeDasharray="4,6"
                opacity={isSelectedRelated ? 0.55 : 0.14}
              />
            );
          })}

          {layoutData.nodes.map((node) => {
            const color = getDomainTagColor(node.domainTag, domainColorMap);
            const isSelected = selectedId === node.id;
            const cardFill = node.isRoot ? "#e7ecea" : isSelected ? "#edf1ef" : "rgba(255,255,255,0.88)";
            const borderColor = node.isRoot ? "#4d7c73" : isSelected ? "#2f5f57" : "rgba(77,124,115,0.45)";
            const textColor = "#1e293b";
            const labelLines = normalizeLabelLines(node.title);
            const x = node.x + offset.x - node.width / 2;
            const y = node.y + offset.y - node.height / 2;
            return (
              <g
                key={node.id}
                onClick={() => handleNodeClick(node.id)}
                style={{ cursor: "pointer" }}
              >
                <rect
                  x={x}
                  y={y}
                  width={node.width}
                  height={node.height}
                  rx="14"
                  ry="14"
                  fill={cardFill}
                  stroke={borderColor}
                  strokeWidth={node.isRoot || isSelected ? 2 : 1}
                  filter="drop-shadow(0 4px 12px rgba(47, 95, 87, 0.14))"
                />
                <rect
                  x={x + 8}
                  y={y + 10}
                  width={10}
                  height={10}
                  rx="2"
                  fill={color}
                />
                {labelLines.map((line, index) => (
                  <text
                    key={index}
                    x={node.x + offset.x}
                    y={y + 22 + index * 14}
                    textAnchor="middle"
                    fontSize="12"
                    fill={textColor}
                    style={{ fontWeight: 500 }}
                  >
                    {line}
                  </text>
                ))}
              </g>
            );
          })}
        </svg>
      </div>
      <p className="mt-2 text-xs text-celestial-textSub">
        研究テーマタグ・検索・状態・お気に入りフィルタの結果を対象に表示します。主線はツリー、点線は追加関係です。
      </p>
    </section>
  );
};