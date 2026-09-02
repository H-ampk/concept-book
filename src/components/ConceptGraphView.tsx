import { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D, { type ForceGraphMethods } from "react-force-graph-2d";
import type { Concept } from "../types/concept";
import { shouldShowConceptGraphLabel } from "../utils/conceptGraphLod";
import { getConceptGraphSimulationConfig } from "../utils/conceptGraphSimulation";
import { createConceptGraphTopologySignature } from "../utils/conceptGraphTopology";
import { collectConceptNeighborhood, collectUndirectedConceptEdges } from "../utils/conceptRelations";
import { getDomainTagColor, getDomainTagColors } from "../utils/domainColors";

const GRAPH_NODE_PAGE = 200;

const NODE_FILL_COLOR = "#e8eef1";
const DOMAIN_RING_WIDTH = 2.4;
const OUTER_RING_GAP = 1.6;
const MAX_VISIBLE_DOMAIN_COLORS = 4;

type GraphNode = {
  id: string;
};

type GraphLink = {
  source: string;
  target: string;
};

type GraphViewMode = "all" | "1-hop" | "2-hop";

const GRAPH_VIEW_MODES: { mode: GraphViewMode; label: string }[] = [
  { mode: "all", label: "全体" },
  { mode: "1-hop", label: "1-hop" },
  { mode: "2-hop", label: "2-hop" }
];

type Props = {
  concepts: Concept[];
  domainColorMap: Record<string, string>;
  selectedId?: string;
  onSelectConcept: (id: string) => void;
};

export const ConceptGraphView = ({ concepts, domainColorMap, selectedId, onSelectConcept }: Props) => {
  const frameRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<ForceGraphMethods<GraphNode, GraphLink> | undefined>(undefined);
  const [size, setSize] = useState({ width: 700, height: 520 });
  const [graphNodeLimit, setGraphNodeLimit] = useState(GRAPH_NODE_PAGE);
  const [viewMode, setViewMode] = useState<GraphViewMode>("all");

  useEffect(() => {
    setGraphNodeLimit((lim) => {
      if (concepts.length === 0) {
        return GRAPH_NODE_PAGE;
      }
      const capped = Math.min(lim, concepts.length);
      if (capped === 0) {
        return Math.min(GRAPH_NODE_PAGE, concepts.length);
      }
      return capped;
    });
  }, [concepts]);

  const conceptsWindow = useMemo(
    () => concepts.slice(0, Math.min(graphNodeLimit, concepts.length)),
    [concepts, graphNodeLimit]
  );

  useEffect(() => {
    const root = frameRef.current;
    if (!root) {
      return;
    }

    const updateSize = () => {
      setSize({
        width: Math.max(1, root.clientWidth),
        height: Math.max(320, root.clientHeight)
      });
    };

    updateSize();
    const observer = new ResizeObserver(() => {
      updateSize();
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  const neighborhoodEmptyReason = useMemo((): "no-selection" | "filtered-out" | null => {
    if (viewMode === "all") {
      return null;
    }
    if (!selectedId) {
      return "no-selection";
    }
    if (!concepts.some((concept) => concept.id === selectedId)) {
      return "filtered-out";
    }
    return null;
  }, [viewMode, selectedId, concepts]);

  const displayedConcepts = useMemo(() => {
    if (viewMode === "all") {
      return conceptsWindow;
    }
    if (neighborhoodEmptyReason) {
      return [];
    }
    const maxHops = viewMode === "1-hop" ? 1 : 2;
    return collectConceptNeighborhood(concepts, selectedId, maxHops);
  }, [viewMode, conceptsWindow, concepts, selectedId, neighborhoodEmptyReason]);

  const displayedConceptById = useMemo(
    () => new Map(displayedConcepts.map((concept) => [concept.id, concept])),
    [displayedConcepts]
  );

  const topologySignature = useMemo(
    () => createConceptGraphTopologySignature(displayedConcepts),
    [displayedConcepts]
  );

  const graphData = useMemo(() => {
    const nodes: GraphNode[] = displayedConcepts.map((concept) => ({
      id: concept.id
    }));

    const links: GraphLink[] = collectUndirectedConceptEdges(displayedConcepts).map((edge) => ({
      source: edge.source,
      target: edge.target
    }));

    return { nodes, links };
    // topologySignature が同じなら graphData の identity を維持する
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topologySignature]);

  const simulationConfig = useMemo(
    () => getConceptGraphSimulationConfig(graphData.nodes.length),
    [graphData.nodes.length]
  );

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) {
      return;
    }

    const linkForce = graph.d3Force("link");
    if (linkForce && typeof linkForce.distance === "function") {
      linkForce.distance(simulationConfig.linkDistance);
    }

    const chargeForce = graph.d3Force("charge");
    if (chargeForce && typeof chargeForce.strength === "function") {
      chargeForce.strength(simulationConfig.chargeStrength);
    }
  }, [topologySignature, simulationConfig.linkDistance, simulationConfig.chargeStrength]);

  const canShowMoreGraph = viewMode === "all" && concepts.length > conceptsWindow.length;

  const countLabel =
    viewMode === "all"
      ? `ノード ${graphData.nodes.length} / エッジ ${graphData.links.length}${
          concepts.length > graphData.nodes.length ? `（対象 ${concepts.length} 件中）` : ""
        }`
      : `${viewMode} / ノード ${graphData.nodes.length} / エッジ ${graphData.links.length}`;

  const handleFit = () => {
    graphRef.current?.zoomToFit(400, 48);
  };

  const handleResetView = () => {
    const graph = graphRef.current;
    if (!graph) {
      return;
    }
    graph.centerAt(0, 0, 300);
    graph.zoom(1, 300);
  };

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-celestial-border bg-nordic-surface">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-celestial-border px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1" role="group" aria-label="グラフ表示モード">
            {GRAPH_VIEW_MODES.map(({ mode, label }) => (
              <button
                key={mode}
                type="button"
                aria-pressed={viewMode === mode}
                className={`rounded-md border px-2 py-1 text-xs ${
                  viewMode === mode
                    ? "border-celestial-softGold bg-celestial-gold/15 text-celestial-softGold"
                    : "border-celestial-border text-celestial-textSub hover:bg-celestial-gold/10"
                }`}
                onClick={() => setViewMode(mode)}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-xs text-celestial-textSub">{countLabel}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded-md border border-celestial-border px-2 py-1 text-xs text-celestial-softGold hover:bg-celestial-gold/10"
            onClick={handleFit}
          >
            全体を収める
          </button>
          <button
            type="button"
            className="rounded-md border border-celestial-border px-2 py-1 text-xs text-celestial-softGold hover:bg-celestial-gold/10"
            onClick={handleResetView}
          >
            表示をリセット
          </button>
          {canShowMoreGraph && (
            <button
              type="button"
              className="rounded-md border border-celestial-border px-2 py-1 text-xs text-celestial-softGold hover:bg-celestial-gold/10"
              onClick={() => setGraphNodeLimit((n) => Math.min(n + GRAPH_NODE_PAGE, concepts.length))}
            >
              さらに表示（+{GRAPH_NODE_PAGE}）
            </button>
          )}
        </div>
      </header>

      <div ref={frameRef} className="min-h-0 w-full flex-1 overflow-hidden">
        {neighborhoodEmptyReason ? (
          <div className="flex h-full min-h-[320px] items-center justify-center px-4">
            <p className="text-sm text-celestial-textSub">
              {neighborhoodEmptyReason === "no-selection"
                ? "近傍表示する概念を選択してください"
                : "表示対象の概念を選択してください"}
            </p>
          </div>
        ) : (
        <ForceGraph2D
          ref={graphRef}
          width={size.width}
          height={size.height}
          graphData={graphData}
          nodeRelSize={6}
          linkWidth={0.8}
          linkColor={() => "rgba(117, 165, 188, 0.38)"}
          cooldownTicks={simulationConfig.cooldownTicks}
          cooldownTime={simulationConfig.cooldownTime}
          d3AlphaDecay={simulationConfig.alphaDecay}
          d3VelocityDecay={simulationConfig.velocityDecay}
          onNodeClick={(node) => onSelectConcept((node as GraphNode).id)}
          nodeCanvasObject={(nodeObject, context, globalScale) => {
            const node = nodeObject as GraphNode & { x: number; y: number };
            const concept = displayedConceptById.get(node.id);
            if (!concept) {
              return;
            }
            const domainColors = getDomainTagColors(
              concept.domainTags,
              domainColorMap,
              MAX_VISIBLE_DOMAIN_COLORS
            );
            const ringColors =
              domainColors.length > 0 ? domainColors : [getDomainTagColor("", domainColorMap)];
            const radius = concept.favorite ? 6.8 : 5.2;
            const isSelected = selectedId === node.id;
            const domainRadius = radius + DOMAIN_RING_WIDTH / 2;
            const outerLineWidth = isSelected ? 2.2 : 1.4;
            const outerRadius = domainRadius + DOMAIN_RING_WIDTH / 2 + OUTER_RING_GAP;
            const labelOffset =
              concept.favorite || isSelected
                ? outerRadius + outerLineWidth / 2
                : domainRadius + DOMAIN_RING_WIDTH / 2;

            context.beginPath();
            context.arc(node.x, node.y, radius, 0, Math.PI * 2, false);
            context.fillStyle = NODE_FILL_COLOR;
            context.fill();

            const displayedDomainCount = ringColors.length;
            const segmentAngle = (Math.PI * 2) / displayedDomainCount;
            for (let i = 0; i < displayedDomainCount; i += 1) {
              context.beginPath();
              context.arc(
                node.x,
                node.y,
                domainRadius,
                -Math.PI / 2 + i * segmentAngle,
                -Math.PI / 2 + (i + 1) * segmentAngle,
                false
              );
              context.strokeStyle = ringColors[i];
              context.lineWidth = DOMAIN_RING_WIDTH;
              context.stroke();
            }

            if (concept.favorite || isSelected) {
              context.beginPath();
              context.arc(node.x, node.y, outerRadius, 0, Math.PI * 2, false);
              context.strokeStyle = isSelected ? "#446878" : "#7a9dad";
              context.lineWidth = outerLineWidth;
              context.stroke();
            }

            const shouldShowLabel = shouldShowConceptGraphLabel({
              globalScale,
              nodeCount: graphData.nodes.length,
              isSelected,
              isFavorite: concept.favorite
            });
            if (!shouldShowLabel) {
              return;
            }

            const safeScale = Math.min(Math.max(globalScale, 0.05), 40);
            const fontSize = 12 / safeScale;
            context.font = `${fontSize}px sans-serif`;
            context.fillStyle = "#1f2d34";
            context.textAlign = "center";
            context.textBaseline = "top";
            context.fillText(concept.title, node.x, node.y + labelOffset + 2);
          }}
        />
        )}
      </div>
    </section>
  );
};
