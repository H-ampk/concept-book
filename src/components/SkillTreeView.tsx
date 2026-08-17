import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { Concept } from "../types/concept";
import { getDomainTagColor } from "../utils/domainColors";
import { OrnamentLine } from "./common/OrnamentLine";

const TREE_NODE_PAGE = 250;
const CARD_WIDTH = 240;
const CARD_HEIGHT = 64;
const HORIZONTAL_GAP = 130;
const VERTICAL_GAP = 80;
const CANVAS_MARGIN_X = 48;
const CANVAS_MARGIN_Y = 48;
const LABEL_MAX_CHARS = 12;

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
  if (title.length <= LABEL_MAX_CHARS) return [title];
  const first = title.slice(0, LABEL_MAX_CHARS);
  const rest = title.slice(LABEL_MAX_CHARS);
  if (rest.length <= LABEL_MAX_CHARS) return [first, rest];
  return [first, `${rest.slice(0, LABEL_MAX_CHARS - 1)}…`];
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
type LayoutData = {
  nodes: LayoutNode[];
  mainEdges: [string, string][];
  extraEdges: [string, string][];
  rootId: string;
  canvasWidth: number;
  canvasHeight: number;
};

const computeTreeLayout = (
  tree: Map<string, string[]>,
  concepts: Concept[],
  rootId: string
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

  const maxDepth = Math.max(...Array.from(depths.values()), 0);
  const maxLevelCount = Math.max(...Array.from(levelNodes.values()).map((ids) => ids.length), 1);
  const columnStep = CARD_WIDTH + HORIZONTAL_GAP;
  const rowStep = CARD_HEIGHT + VERTICAL_GAP;
  const canvasWidth = CANVAS_MARGIN_X * 2 + (maxDepth + 1) * CARD_WIDTH + maxDepth * HORIZONTAL_GAP;
  const canvasHeight = CANVAS_MARGIN_Y * 2 + maxLevelCount * CARD_HEIGHT + (maxLevelCount - 1) * VERTICAL_GAP;

  const nodes: LayoutNode[] = [];
  levelNodes.forEach((ids, depth) => {
    const columnX = CANVAS_MARGIN_X + CARD_WIDTH / 2 + depth * columnStep;
    ids.forEach((id, index) => {
      const concept = conceptMap.get(id)!;
      const centerY = CANVAS_MARGIN_Y + CARD_HEIGHT / 2 + index * rowStep;
      nodes.push({
        id,
        x: columnX,
        y: centerY,
        title: concept.title,
        domainTag: concept.domainTags[0] || "",
        favorite: concept.favorite,
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        isRoot: id === rootId,
      });
    });
  });

  const { mainEdges, extraEdges } = buildBFSTree(buildGraph(concepts), rootId);

  return { nodes, mainEdges, extraEdges, rootId, canvasWidth, canvasHeight };
};

export const SkillTreeView = ({ concepts, domainColorMap, selectedId, onSelectConcept }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [treeNodeLimit, setTreeNodeLimit] = useState(TREE_NODE_PAGE);

  useEffect(() => {
    setTreeNodeLimit((lim) => {
      if (concepts.length === 0) {
        return TREE_NODE_PAGE;
      }
      const capped = Math.min(lim, concepts.length);
      if (capped === 0) {
        return Math.min(TREE_NODE_PAGE, concepts.length);
      }
      return capped;
    });
  }, [concepts]);

  const conceptsWindow = useMemo(
    () => concepts.slice(0, Math.min(treeNodeLimit, concepts.length)),
    [concepts, treeNodeLimit]
  );

  const layoutData = useMemo<LayoutData>(() => {
    if (conceptsWindow.length === 0) {
      return { nodes: [], mainEdges: [], extraEdges: [], rootId: "", canvasWidth: 900, canvasHeight: 640 };
    }

    const graph = buildGraph(conceptsWindow);
    const degrees = computeDegree(graph);
    const root = Array.from(degrees.entries()).reduce((a, b) => (a[1] > b[1] ? a : b))[0];
    const { tree, mainEdges, extraEdges } = buildBFSTree(graph, root);
    const data = computeTreeLayout(tree, conceptsWindow, root);

    return { ...data, mainEdges, extraEdges };
  }, [conceptsWindow]);

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
    const graph = buildGraph(conceptsWindow);
    const root = layoutData.rootId;
    const { tree } = buildBFSTree(graph, root);
    return buildNavigationData(tree, root);
  }, [conceptsWindow, layoutData.rootId]);

  const [isPanning, setIsPanning] = useState(false);
  const [panOrigin, setPanOrigin] = useState<{ x: number; y: number } | null>(null);
  const [pointerStart, setPointerStart] = useState<{ x: number; y: number } | null>(null);

  const handleNodeClick = (id: string) => {
    onSelectConcept(id);
  };

  const nodeById = new Map(layoutData.nodes.map((node) => [node.id, node]));
  const canShowMoreTree = concepts.length > conceptsWindow.length;
  const visibleExtraEdges = selectedId
    ? layoutData.extraEdges.filter(([source, target]) => source === selectedId || target === selectedId)
    : [];

  const handleBackgroundPointerDown = (event: React.PointerEvent<SVGRectElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const container = containerRef.current;
    if (!container) return;
    setIsPanning(true);
    setPointerStart({ x: event.clientX, y: event.clientY });
    setPanOrigin({ x: container.scrollLeft, y: container.scrollTop });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement | HTMLDivElement>) => {
    if (!isPanning || !pointerStart || !panOrigin) return;
    const container = containerRef.current;
    if (!container) return;
    const dx = event.clientX - pointerStart.x;
    const dy = event.clientY - pointerStart.y;
    container.scrollLeft = panOrigin.x - dx;
    container.scrollTop = panOrigin.y - dy;
  };

  const handlePointerUp = (event: React.PointerEvent<SVGSVGElement | HTMLDivElement | SVGRectElement>) => {
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
      <header className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-celestial-textMain">スキルツリー</h3>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs text-celestial-textSub">
            ノード {layoutData.nodes.length} / 主エッジ {layoutData.mainEdges.length} / 追加エッジ {layoutData.extraEdges.length}
            {concepts.length > layoutData.nodes.length ? `（対象 ${concepts.length} 件中）` : ""}
          </p>
          {canShowMoreTree && (
            <button
              type="button"
              className="rounded-md border border-celestial-border px-2 py-1 text-xs text-celestial-softGold hover:bg-celestial-gold/10"
              onClick={() => setTreeNodeLimit((n) => Math.min(n + TREE_NODE_PAGE, concepts.length))}
            >
              さらに表示（+{TREE_NODE_PAGE}）
            </button>
          )}
        </div>
      </header>

      <div
        ref={containerRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="h-[min(70vh,720px)] min-h-[420px] w-full overflow-auto scrollbar-none rounded-lg border border-celestial-border bg-nordic-surface focus:outline-none focus:ring-2 focus:ring-celestial-softGold/40"
        style={{ cursor: isPanning ? "grabbing" : "grab" }}
      >
        <svg
          width={layoutData.canvasWidth}
          height={layoutData.canvasHeight}
          viewBox={`0 0 ${layoutData.canvasWidth} ${layoutData.canvasHeight}`}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <rect
            x="0"
            y="0"
            width={layoutData.canvasWidth}
            height={layoutData.canvasHeight}
            fill="transparent"
            onPointerDown={handleBackgroundPointerDown}
          />
          {layoutData.mainEdges.map(([source, target], index) => {
            const sourceNode = nodeById.get(source);
            const targetNode = nodeById.get(target);
            if (!sourceNode || !targetNode) return null;
            const x1 = sourceNode.x + sourceNode.width / 2;
            const y1 = sourceNode.y;
            const x2 = targetNode.x - targetNode.width / 2;
            const y2 = targetNode.y;
            const midX = (x1 + x2) / 2;
            return (
              <path
                key={`main-${index}`}
                d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
                fill="none"
                stroke="#8c6b1f"
                strokeWidth="2"
                opacity="0.9"
              />
            );
          })}

          {visibleExtraEdges.map(([source, target], index) => {
            const sourceNode = nodeById.get(source);
            const targetNode = nodeById.get(target);
            if (!sourceNode || !targetNode) return null;
            const x1 = sourceNode.x;
            const y1 = sourceNode.y;
            const x2 = targetNode.x;
            const y2 = targetNode.y;
            const midX = (x1 + x2) / 2;
            return (
              <path
                key={`extra-${index}`}
                d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
                fill="none"
                stroke="rgba(117, 165, 188, 0.7)"
                strokeWidth={1.5}
                strokeDasharray="4,6"
                opacity={0.7}
              />
            );
          })}

          {layoutData.nodes.map((node) => {
            const color = getDomainTagColor(node.domainTag, domainColorMap);
            const isSelected = selectedId === node.id;
            const cardFill = node.isRoot ? "#f2f7f9" : isSelected ? "#d8e8ee" : "rgba(255,255,255,0.9)";
            const borderColor = node.isRoot ? "#7a9dad" : isSelected ? "#537b8e" : "rgba(92,126,145,0.38)";
            const textColor = "#1f2d34";
            const labelLines = normalizeLabelLines(node.title);
            const x = node.x - node.width / 2;
            const y = node.y - node.height / 2;
            const titleY = labelLines.length === 1 ? y + 38 : y + 30;
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
                  filter="drop-shadow(0 4px 12px rgba(73, 101, 114, 0.12))"
                />
                <rect
                  x={x + 12}
                  y={y + 12}
                  width={10}
                  height={10}
                  rx="2"
                  fill={color}
                />
                {labelLines.map((line, index) => (
                  <text
                    key={index}
                    x={node.x + 6}
                    y={titleY + index * 16}
                    textAnchor="middle"
                    fontSize="13"
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
        研究テーマタグ・検索・状態・お気に入りフィルタの結果を対象に表示します。主線はツリー、点線は選択中ノードの追加関係です。背景ドラッグまたはスクロールで移動できます。
      </p>
    </section>
  );
};