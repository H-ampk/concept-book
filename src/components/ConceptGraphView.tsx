import { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D from "react-force-graph-2d";
import type { Concept } from "../types/concept";
import { getDomainTagColor } from "../utils/domainColors";
import { OrnamentLine } from "./common/OrnamentLine";

const GRAPH_NODE_PAGE = 200;

type GraphNode = {
  id: string;
  title: string;
  domainTag: string;
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

    const observer = new ResizeObserver(() => {
      const width = root.clientWidth;
      const isMobile = width < 768;
      setSize({
        width,
        height: isMobile ? 420 : 520
      });
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  const graphData = useMemo(() => {
    const idSet = new Set(conceptsWindow.map((concept) => concept.id));
    const nodes: GraphNode[] = conceptsWindow.map((concept) => ({
      id: concept.id,
      title: concept.title,
      domainTag: concept.domainTags[0] ?? "",
      favorite: concept.favorite
    }));

    const edgeKeys = new Set<string>();
    const links: GraphLink[] = [];
    conceptsWindow.forEach((concept) => {
      concept.relatedIds.forEach((relatedId) => {
        if (!idSet.has(relatedId)) {
          return;
        }
        if (relatedId === concept.id) {
          return;
        }
        const key = `${concept.id}->${relatedId}`;
        if (edgeKeys.has(key)) {
          return;
        }
        edgeKeys.add(key);
        links.push({
          source: concept.id,
          target: relatedId
        });
      });
    });

    return { nodes, links };
  }, [conceptsWindow]);

  const canShowMoreGraph = concepts.length > conceptsWindow.length;

  return (
    <section className="rounded-2xl border border-celestial-border bg-celestial-panel p-3 shadow-celestial decorated-card">
      <span className="card-corner card-corner-top-left" aria-hidden="true" />
      <span className="card-corner card-corner-top-right" aria-hidden="true" />
      <span className="card-corner card-corner-bottom-left" aria-hidden="true" />
      <span className="card-corner card-corner-bottom-right" aria-hidden="true" />
      <OrnamentLine variant="panel" />
      <header className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-celestial-textMain">概念グラフ</h3>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs text-celestial-textSub">
            ノード {graphData.nodes.length} / エッジ {graphData.links.length}
            {concepts.length > graphData.nodes.length ? `（対象 ${concepts.length} 件中）` : ""}
          </p>
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

      <div ref={frameRef} className="w-full overflow-x-auto scrollbar-none rounded-lg border border-celestial-border bg-nordic-surface">
        <ForceGraph2D
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
            const color = getDomainTagColor(node.domainTag, domainColorMap);
            const radius = node.favorite ? 6.8 : 5.2;
            const isSelected = selectedId === node.id;

            context.beginPath();
            context.arc(node.x, node.y, radius, 0, Math.PI * 2, false);
            context.fillStyle = color;
            context.fill();

            if (node.favorite || isSelected) {
              context.beginPath();
              context.arc(node.x, node.y, radius + 1.8, 0, Math.PI * 2, false);
              context.strokeStyle = isSelected ? "#446878" : "#7a9dad";
              context.lineWidth = isSelected ? 2.2 : 1.4;
              context.stroke();
            }

            const fontSize = Math.max(10, 12 / globalScale);
            context.font = `${fontSize}px sans-serif`;
            context.fillStyle = "#1f2d34";
            context.textAlign = "center";
            context.textBaseline = "top";
            context.fillText(node.title, node.x, node.y + radius + 2);
          }}
        />
      </div>
      <p className="mt-2 text-xs text-celestial-textSub">
        研究テーマタグ・検索・状態・お気に入りフィルタの結果を対象に表示します。
      </p>
    </section>
  );
};
