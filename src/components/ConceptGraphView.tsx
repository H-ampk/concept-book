import { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D, { type ForceGraphMethods } from "react-force-graph-2d";
import type { Concept } from "../types/concept";
import { collectUndirectedConceptEdges } from "../utils/conceptRelations";
import { getDomainTagColor, getDomainTagColors } from "../utils/domainColors";

const GRAPH_NODE_PAGE = 200;
const LINK_DISTANCE = 90;
const CHARGE_STRENGTH = -160;

const NODE_FILL_COLOR = "#e8eef1";
const DOMAIN_RING_WIDTH = 2.4;
const OUTER_RING_GAP = 1.6;
const MAX_VISIBLE_DOMAIN_COLORS = 4;

type GraphNode = {
  id: string;
  title: string;
  domainTags: string[];
  favorite: boolean;
};

type GraphLink = {
  source: string;
  target: string;
};

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

  const graphData = useMemo(() => {
    const nodes: GraphNode[] = conceptsWindow.map((concept) => ({
      id: concept.id,
      title: concept.title,
      domainTags: concept.domainTags,
      favorite: concept.favorite
    }));

    const links: GraphLink[] = collectUndirectedConceptEdges(conceptsWindow).map((edge) => ({
      source: edge.source,
      target: edge.target
    }));

    return { nodes, links };
  }, [conceptsWindow]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) {
      return;
    }

    const linkForce = graph.d3Force("link");
    if (linkForce && typeof linkForce.distance === "function") {
      linkForce.distance(LINK_DISTANCE);
    }

    const chargeForce = graph.d3Force("charge");
    if (chargeForce && typeof chargeForce.strength === "function") {
      chargeForce.strength(CHARGE_STRENGTH);
    }

    graph.d3ReheatSimulation();
  }, [graphData]);

  const canShowMoreGraph = concepts.length > conceptsWindow.length;

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
        <p className="text-xs text-celestial-textSub">
          ノード {graphData.nodes.length} / エッジ {graphData.links.length}
          {concepts.length > graphData.nodes.length ? `（対象 ${concepts.length} 件中）` : ""}
        </p>
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
        <ForceGraph2D
          ref={graphRef}
          width={size.width}
          height={size.height}
          graphData={graphData}
          nodeRelSize={6}
          linkWidth={0.8}
          linkColor={() => "rgba(117, 165, 188, 0.38)"}
          cooldownTicks={120}
          onNodeClick={(node) => onSelectConcept((node as GraphNode).id)}
          nodeCanvasObject={(nodeObject, context, globalScale) => {
            const node = nodeObject as GraphNode & { x: number; y: number };
            const domainColors = getDomainTagColors(
              node.domainTags,
              domainColorMap,
              MAX_VISIBLE_DOMAIN_COLORS
            );
            const ringColors =
              domainColors.length > 0 ? domainColors : [getDomainTagColor("", domainColorMap)];
            const radius = node.favorite ? 6.8 : 5.2;
            const isSelected = selectedId === node.id;
            const domainRadius = radius + DOMAIN_RING_WIDTH / 2;
            const outerLineWidth = isSelected ? 2.2 : 1.4;
            const outerRadius = domainRadius + DOMAIN_RING_WIDTH / 2 + OUTER_RING_GAP;
            const labelOffset =
              node.favorite || isSelected
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

            if (node.favorite || isSelected) {
              context.beginPath();
              context.arc(node.x, node.y, outerRadius, 0, Math.PI * 2, false);
              context.strokeStyle = isSelected ? "#446878" : "#7a9dad";
              context.lineWidth = outerLineWidth;
              context.stroke();
            }

            const fontSize = Math.max(10, 12 / globalScale);
            context.font = `${fontSize}px sans-serif`;
            context.fillStyle = "#1f2d34";
            context.textAlign = "center";
            context.textBaseline = "top";
            context.fillText(node.title, node.x, node.y + labelOffset + 2);
          }}
        />
      </div>
    </section>
  );
};
