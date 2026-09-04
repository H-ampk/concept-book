import { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D, { type ForceGraphMethods } from "react-force-graph-2d";
import type { Concept } from "../types/concept";
import type { ConceptQuizStats } from "../utils/quiz/getConceptQuizStats";
import {
  GRAPH_METRIC_MODES,
  getConceptGraphAttemptLabel,
  getConceptGraphNodeRadius,
  type GraphMetricMode
} from "../utils/conceptGraphAttemptRadius";
import {
  getConceptGraphLabelHaloScreenWidth,
  getConceptGraphLabelStyle,
  getConceptGraphLabelText,
  LABEL_HALO_COLOR,
  MEDIUM_LABEL_SCALE
} from "../utils/conceptGraphLod";
import { getConceptGraphSimulationConfig } from "../utils/conceptGraphSimulation";
import { createConceptGraphTopologySnapshot } from "../utils/conceptGraphTopology";
import { rankConceptsForGraphFromIndex } from "../utils/conceptGraphPriority";
import {
  collectConceptNeighborhoodFromIndex,
  createConceptRelationIndex,
  type ConceptRelationIndex
} from "../utils/conceptRelations";
import { getDomainTagColor, getDomainTagColors } from "../utils/domainColors";
import {
  GRAPH_FIT_DURATION_MS,
  GRAPH_FIT_PADDING_PX,
  GRAPH_NODE_PAGE,
  getVisibleGraphNodeCount,
  nextGraphNodeLimit,
  shouldAutoFitConceptGraph
} from "../utils/conceptGraphViewState";

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
  conceptQuizStatsMap?: Map<string, ConceptQuizStats>;
};

export const ConceptGraphView = ({
  concepts,
  domainColorMap,
  selectedId,
  onSelectConcept,
  conceptQuizStatsMap
}: Props) => {
  const frameRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<ForceGraphMethods<GraphNode, GraphLink> | undefined>(undefined);
  const hasAutoFittedRef = useRef(false);
  const [size, setSize] = useState({ width: 700, height: 520 });
  const [graphNodeLimit, setGraphNodeLimit] = useState(GRAPH_NODE_PAGE);
  const [viewMode, setViewMode] = useState<GraphViewMode>("all");
  const [metricMode, setMetricMode] = useState<GraphMetricMode>("normal");

  const relationIndexCacheRef = useRef<{
    source: readonly Concept[];
    index: ConceptRelationIndex;
  } | null>(null);

  const getCachedRelationIndex = (source: readonly Concept[]): ConceptRelationIndex => {
    const cached = relationIndexCacheRef.current;
    if (cached && cached.source === source) {
      return cached.index;
    }
    const index = createConceptRelationIndex(source);
    relationIndexCacheRef.current = { source, index };
    return index;
  };

  const rankedConcepts = useMemo(() => {
    if (viewMode !== "all" || !selectedId) {
      return concepts;
    }
    const index = getCachedRelationIndex(concepts);
    if (!index.conceptById.has(selectedId)) {
      return concepts;
    }
    return rankConceptsForGraphFromIndex(index, selectedId).map((entry) => entry.concept);
  }, [concepts, selectedId, viewMode]);

  const conceptsWindow = useMemo(
    () => rankedConcepts.slice(0, getVisibleGraphNodeCount(graphNodeLimit, rankedConcepts.length)),
    [graphNodeLimit, rankedConcepts]
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
    const index = getCachedRelationIndex(concepts);
    const maxHops = viewMode === "1-hop" ? 1 : 2;
    return collectConceptNeighborhoodFromIndex(index, selectedId, maxHops);
  }, [viewMode, conceptsWindow, concepts, selectedId, neighborhoodEmptyReason]);

  const displayedConceptById = useMemo(
    () => new Map(displayedConcepts.map((concept) => [concept.id, concept])),
    [displayedConcepts]
  );

  const topologySnapshot = useMemo(
    () => createConceptGraphTopologySnapshot(displayedConcepts),
    [displayedConcepts]
  );

  const graphData = useMemo(
    () => ({
      nodes: topologySnapshot.nodes,
      links: topologySnapshot.links
    }),
    // signature が同じなら graphData の identity を維持する
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [topologySnapshot.signature]
  );

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
  }, [topologySnapshot.signature, simulationConfig.linkDistance, simulationConfig.chargeStrength]);

  const canShowMoreGraph = viewMode === "all" && concepts.length > conceptsWindow.length;

  const countLabel =
    viewMode === "all"
      ? `ノード ${graphData.nodes.length} / エッジ ${graphData.links.length}${
          concepts.length > graphData.nodes.length ? `（対象 ${concepts.length} 件中）` : ""
        }`
      : `${viewMode} / ノード ${graphData.nodes.length} / エッジ ${graphData.links.length}`;

  const handleFit = () => {
    graphRef.current?.zoomToFit(GRAPH_FIT_DURATION_MS, GRAPH_FIT_PADDING_PX);
  };

  const handleEngineStop = () => {
    if (!shouldAutoFitConceptGraph(hasAutoFittedRef.current, graphData.nodes.length)) {
      return;
    }

    const graph = graphRef.current;
    if (!graph) {
      return;
    }

    hasAutoFittedRef.current = true;
    graph.zoomToFit(GRAPH_FIT_DURATION_MS, GRAPH_FIT_PADDING_PX);
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
          <div className="flex items-center gap-1" role="group" aria-label="グラフ表示範囲">
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
          <div className="flex items-center gap-1" role="group" aria-label="グラフ指標表示">
            {GRAPH_METRIC_MODES.map(({ mode, label }) => (
              <button
                key={mode}
                type="button"
                aria-pressed={metricMode === mode}
                className={`rounded-md border px-2 py-1 text-xs ${
                  metricMode === mode
                    ? "border-celestial-softGold bg-celestial-gold/15 text-celestial-softGold"
                    : "border-celestial-border text-celestial-textSub hover:bg-celestial-gold/10"
                }`}
                onClick={() => setMetricMode(mode)}
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
              onClick={() => setGraphNodeLimit((n) => nextGraphNodeLimit(n, concepts.length))}
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
          onEngineStop={handleEngineStop}
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
            const totalAttempts = conceptQuizStatsMap?.get(concept.id)?.totalAttempts ?? 0;
            const radius = getConceptGraphNodeRadius({
              metricMode,
              totalAttempts,
              isFavorite: concept.favorite
            });
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

            const safeScale = Math.min(Math.max(globalScale, 0.05), 40);
            const labelStyle = getConceptGraphLabelStyle({
              globalScale,
              isSelected,
              isFavorite: concept.favorite
            });
            const labelText = getConceptGraphLabelText({
              title: concept.title,
              globalScale,
              isSelected,
              isFavorite: concept.favorite
            });
            const fontSize = labelStyle.screenFontSize / safeScale;
            const haloWidth = getConceptGraphLabelHaloScreenWidth({
              isSelected,
              isFavorite: concept.favorite
            }) / safeScale;
            const labelX = node.x;
            const labelY = node.y + labelOffset + 2;

            context.save();
            context.font = `${labelStyle.fontWeight} ${fontSize}px sans-serif`;
            context.textAlign = "center";
            context.textBaseline = "top";
            context.lineJoin = "round";
            context.miterLimit = 2;
            context.lineWidth = haloWidth;
            context.strokeStyle = LABEL_HALO_COLOR;
            context.fillStyle = "#1f2d34";
            context.globalAlpha = Math.min(1, labelStyle.opacity + 0.2);
            context.strokeText(labelText, labelX, labelY);
            context.globalAlpha = labelStyle.opacity;
            context.fillText(labelText, labelX, labelY);

            if (metricMode === "attempts") {
              const showAttemptLabel = isSelected || globalScale >= MEDIUM_LABEL_SCALE;
              if (showAttemptLabel) {
                const attemptLabel = getConceptGraphAttemptLabel(totalAttempts);
                const attemptFontSize = (isSelected ? 10 : 8) / safeScale;
                const attemptY = labelY + fontSize + 2 / safeScale;
                context.font = `400 ${attemptFontSize}px sans-serif`;
                context.lineWidth = haloWidth;
                context.globalAlpha = Math.min(1, labelStyle.opacity + 0.2);
                context.strokeText(attemptLabel, labelX, attemptY);
                context.globalAlpha = labelStyle.opacity;
                context.fillText(attemptLabel, labelX, attemptY);
              }
            }

            context.restore();
          }}
        />
        )}
      </div>
    </section>
  );
};
