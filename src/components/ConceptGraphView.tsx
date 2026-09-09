import { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D, { type ForceGraphMethods } from "react-force-graph-2d";
import type { Concept } from "../types/concept";
import type { ConceptQuizStats } from "../utils/quiz/getConceptQuizStats";
import {
  GRAPH_ACCURACY_LEGEND_ITEMS,
  getConceptGraphAccuracyFill,
  getConceptGraphAccuracyLabel
} from "../utils/conceptGraphAccuracy";
import {
  buildConfusionKnnEdges,
  buildConfusionProfiles,
  buildDirectConfusionEdges,
  CONFUSION_GRAPH_MODES,
  DEFAULT_CONFUSION_K,
  DIRECT_CONFUSION_DASH_LENGTH,
  DIRECT_CONFUSION_GAP_LENGTH,
  DIRECT_CONFUSION_STROKE,
  filterUndirectedEdgesByVisibleIds,
  getConfusionKnnLineWidth,
  getConfusionKnnOpacity,
  getDirectConfusionLineWidth,
  KNN_CONFUSION_DASH_LENGTH,
  KNN_CONFUSION_GAP_LENGTH,
  KNN_CONFUSION_STROKE,
  type ConfusionGraphMode,
  type ConfusionKnnEdge,
  type DirectConfusionEdge
} from "../utils/conceptGraphConfusion";
import type { ConfusionPairStat } from "../utils/quizStats";
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
import {
  getConceptGraphNodeGeometry,
  GRAPH_DOMAIN_RING_WIDTH,
  GRAPH_LABEL_NODE_GAP
} from "../utils/conceptGraphNodeGeometry";
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

type GraphSimNode = GraphNode & { x?: number; y?: number };

type Props = {
  concepts: Concept[];
  domainColorMap: Record<string, string>;
  selectedId?: string;
  onSelectConcept: (id: string) => void;
  conceptQuizStatsMap?: Map<string, ConceptQuizStats>;
  confusionPairs?: ConfusionPairStat[];
  confusionUniverseIds?: readonly string[];
};

export const ConceptGraphView = ({
  concepts,
  domainColorMap,
  selectedId,
  onSelectConcept,
  conceptQuizStatsMap,
  confusionPairs,
  confusionUniverseIds
}: Props) => {
  const frameRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<ForceGraphMethods<GraphNode, GraphLink> | undefined>(undefined);
  const hasAutoFittedRef = useRef(false);
  const [size, setSize] = useState({ width: 700, height: 520 });
  const [graphNodeLimit, setGraphNodeLimit] = useState(GRAPH_NODE_PAGE);
  const [viewMode, setViewMode] = useState<GraphViewMode>("all");
  const [metricMode, setMetricMode] = useState<GraphMetricMode>("normal");
  const [confusionMode, setConfusionMode] = useState<ConfusionGraphMode>("off");

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

  const validConceptIdSet = useMemo(() => {
    const ids =
      confusionUniverseIds && confusionUniverseIds.length > 0
        ? confusionUniverseIds
        : concepts.map((concept) => concept.id);
    return new Set(ids);
  }, [confusionUniverseIds, concepts]);

  const directConfusionEdgesAll = useMemo(
    () => buildDirectConfusionEdges(confusionPairs ?? [], validConceptIdSet),
    [confusionPairs, validConceptIdSet]
  );

  const confusionKnnEdgesAll = useMemo(() => {
    const profiles = buildConfusionProfiles(confusionPairs ?? [], validConceptIdSet);
    return buildConfusionKnnEdges(profiles, { k: DEFAULT_CONFUSION_K });
  }, [confusionPairs, validConceptIdSet]);

  const displayedConceptIds = useMemo(
    () => new Set(displayedConcepts.map((concept) => concept.id)),
    [displayedConcepts]
  );

  const visibleDirectConfusionEdges = useMemo(
    () => filterUndirectedEdgesByVisibleIds(directConfusionEdgesAll, displayedConceptIds),
    [directConfusionEdgesAll, displayedConceptIds]
  );

  const visibleConfusionKnnEdges = useMemo(
    () => filterUndirectedEdgesByVisibleIds(confusionKnnEdgesAll, displayedConceptIds),
    [confusionKnnEdgesAll, displayedConceptIds]
  );

  const confusionModeRef = useRef(confusionMode);
  confusionModeRef.current = confusionMode;
  const visibleDirectConfusionEdgesRef = useRef<DirectConfusionEdge[]>(visibleDirectConfusionEdges);
  visibleDirectConfusionEdgesRef.current = visibleDirectConfusionEdges;
  const visibleConfusionKnnEdgesRef = useRef<ConfusionKnnEdge[]>(visibleConfusionKnnEdges);
  visibleConfusionKnnEdgesRef.current = visibleConfusionKnnEdges;

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
          <div className="flex items-center gap-1" role="group" aria-label="混同表示">
            <span className="text-xs text-celestial-textSub">混同:</span>
            {CONFUSION_GRAPH_MODES.map(({ mode, label }) => (
              <button
                key={mode}
                type="button"
                aria-pressed={confusionMode === mode}
                className={`rounded-md border px-2 py-1 text-xs ${
                  confusionMode === mode
                    ? "border-celestial-softGold bg-celestial-gold/15 text-celestial-softGold"
                    : "border-celestial-border text-celestial-textSub hover:bg-celestial-gold/10"
                }`}
                onClick={() => setConfusionMode(mode)}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-xs text-celestial-textSub">{countLabel}</p>
          {confusionMode === "direct" && (
            <p
              className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-celestial-textSub"
              aria-label="直接混同の凡例"
            >
              <span
                className="inline-block w-7 border-t-2 border-dashed"
                style={{ borderColor: DIRECT_CONFUSION_STROKE }}
                aria-hidden="true"
              />
              直接混同 · 太いほど取り違え回数が多い · {visibleDirectConfusionEdges.length}組
            </p>
          )}
          {confusionMode === "knn" && (
            <p
              className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-celestial-textSub"
              aria-label="混同近傍の凡例"
            >
              <span
                className="inline-block w-7 border-t-2 border-dotted"
                style={{ borderColor: KNN_CONFUSION_STROKE }}
                aria-hidden="true"
              />
              混同近傍 · 誤答パターンが似ている概念 · 線が強いほど類似 · k = {DEFAULT_CONFUSION_K} ·{" "}
              {visibleConfusionKnnEdges.length}組
            </p>
          )}
          {metricMode === "accuracy" && (
            <ul
              className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px] text-celestial-textSub"
              aria-label="正答率の凡例"
            >
              {GRAPH_ACCURACY_LEGEND_ITEMS.map((item) => (
                <li key={item.band} className="flex items-center gap-1">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full border border-celestial-border"
                    style={{ backgroundColor: item.fill }}
                    aria-hidden="true"
                  />
                  {item.label}
                </li>
              ))}
            </ul>
          )}
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
          onRenderFramePre={(context, globalScale) => {
            const mode = confusionModeRef.current;
            if (mode === "off") {
              return;
            }

            const clampedScale = Math.min(Math.max(globalScale, 0.05), 40);
            const safeScale = Number.isFinite(clampedScale) ? clampedScale : 0.05;
            const nodeById = new Map<string, GraphSimNode>();
            for (const node of graphData.nodes as GraphSimNode[]) {
              nodeById.set(node.id, node);
            }

            const resolveEnds = (sourceId: string, targetId: string) => {
              const source = nodeById.get(sourceId);
              const target = nodeById.get(targetId);
              if (!source || !target) {
                return null;
              }
              const sx = source.x;
              const sy = source.y;
              const tx = target.x;
              const ty = target.y;
              if (
                sx == null ||
                sy == null ||
                tx == null ||
                ty == null ||
                !Number.isFinite(sx) ||
                !Number.isFinite(sy) ||
                !Number.isFinite(tx) ||
                !Number.isFinite(ty)
              ) {
                return null;
              }
              return { sx, sy, tx, ty };
            };

            context.save();
            context.lineCap = "round";

            if (mode === "direct") {
              context.strokeStyle = DIRECT_CONFUSION_STROKE;
              context.setLineDash([
                DIRECT_CONFUSION_DASH_LENGTH / safeScale,
                DIRECT_CONFUSION_GAP_LENGTH / safeScale
              ]);
              for (const edge of visibleDirectConfusionEdgesRef.current) {
                const ends = resolveEnds(edge.source, edge.target);
                if (!ends) {
                  continue;
                }
                context.lineWidth = getDirectConfusionLineWidth(edge.count) / safeScale;
                context.beginPath();
                context.moveTo(ends.sx, ends.sy);
                context.lineTo(ends.tx, ends.ty);
                context.stroke();
              }
            } else {
              context.strokeStyle = KNN_CONFUSION_STROKE;
              context.setLineDash([
                KNN_CONFUSION_DASH_LENGTH / safeScale,
                KNN_CONFUSION_GAP_LENGTH / safeScale
              ]);
              for (const edge of visibleConfusionKnnEdgesRef.current) {
                const ends = resolveEnds(edge.source, edge.target);
                if (!ends) {
                  continue;
                }
                context.globalAlpha = getConfusionKnnOpacity(edge.similarity);
                context.lineWidth = getConfusionKnnLineWidth(edge.similarity) / safeScale;
                context.beginPath();
                context.moveTo(ends.sx, ends.sy);
                context.lineTo(ends.tx, ends.ty);
                context.stroke();
              }
            }

            context.restore();
          }}
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
            const quizStats = conceptQuizStatsMap?.get(concept.id);
            const totalAttempts = quizStats?.totalAttempts ?? 0;
            const accuracy = quizStats?.accuracy ?? null;
            const radius = getConceptGraphNodeRadius({
              metricMode,
              totalAttempts,
              isFavorite: concept.favorite
            });
            const isSelected = selectedId === node.id;
            const {
              domainRadius,
              outerLineWidth,
              outerRadius,
              labelOffset
            } = getConceptGraphNodeGeometry({
              nodeRadius: radius,
              isSelected,
              isFavorite: concept.favorite
            });

            context.beginPath();
            context.arc(node.x, node.y, radius, 0, Math.PI * 2, false);
            context.fillStyle =
              metricMode === "accuracy" ? getConceptGraphAccuracyFill(accuracy) : NODE_FILL_COLOR;
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
              context.lineWidth = GRAPH_DOMAIN_RING_WIDTH;
              context.stroke();
            }

            if (concept.favorite || isSelected) {
              context.beginPath();
              context.arc(node.x, node.y, outerRadius, 0, Math.PI * 2, false);
              context.strokeStyle = isSelected ? "#446878" : "#7a9dad";
              context.lineWidth = outerLineWidth;
              context.stroke();
            }

            const clampedScale = Math.min(Math.max(globalScale, 0.05), 40);
            const safeScale = Number.isFinite(clampedScale) ? clampedScale : 0.05;
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
            const labelY = node.y + labelOffset + GRAPH_LABEL_NODE_GAP;

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

            if (metricMode === "attempts" || metricMode === "accuracy") {
              const showMetricLabel = isSelected || globalScale >= MEDIUM_LABEL_SCALE;
              if (showMetricLabel) {
                const metricLabel =
                  metricMode === "attempts"
                    ? getConceptGraphAttemptLabel(totalAttempts)
                    : getConceptGraphAccuracyLabel(accuracy);
                const metricFontSize = (isSelected ? 10 : 8) / safeScale;
                const metricY = labelY + fontSize + 2 / safeScale;
                context.font = `400 ${metricFontSize}px sans-serif`;
                context.lineWidth = haloWidth;
                context.globalAlpha = Math.min(1, labelStyle.opacity + 0.2);
                context.strokeText(metricLabel, labelX, metricY);
                context.globalAlpha = labelStyle.opacity;
                context.fillText(metricLabel, labelX, metricY);
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
