import { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D from "react-force-graph-2d";
import type { Concept } from "../types/concept";
import { getDomainTagColor } from "../utils/domainColors";

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
    const idSet = new Set(concepts.map((concept) => concept.id));
    const nodes: GraphNode[] = concepts.map((concept) => ({
      id: concept.id,
      title: concept.title,
      domainTag: concept.domainTags[0] ?? "",
      favorite: concept.favorite
    }));

    const edgeKeys = new Set<string>();
    const links: GraphLink[] = [];
    concepts.forEach((concept) => {
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
  }, [concepts]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-quiet">
      <header className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">概念グラフ</h3>
        <p className="text-xs text-slate-500">
          ノード {graphData.nodes.length} / エッジ {graphData.links.length}
        </p>
      </header>

      <div ref={frameRef} className="w-full overflow-x-auto rounded-lg border border-slate-100 bg-slate-50">
        <ForceGraph2D
          width={size.width}
          height={size.height}
          graphData={graphData}
          nodeRelSize={6}
          linkWidth={0.8}
          linkColor={() => "#cbd5e1"}
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
              context.strokeStyle = isSelected ? "#0f172a" : "#f59e0b";
              context.lineWidth = isSelected ? 2.2 : 1.4;
              context.stroke();
            }

            const fontSize = Math.max(10, 12 / globalScale);
            context.font = `${fontSize}px sans-serif`;
            context.fillStyle = "#334155";
            context.textAlign = "center";
            context.textBaseline = "top";
            context.fillText(node.title, node.x, node.y + radius + 2);
          }}
        />
      </div>
      <p className="mt-2 text-xs text-slate-500">
        研究テーマタグ・検索・状態・お気に入りフィルタの結果を対象に表示します。
      </p>
    </section>
  );
};
