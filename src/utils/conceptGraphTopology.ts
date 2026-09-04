import { collectUndirectedConceptEdges } from "./conceptRelations";
import type { Concept } from "../types/concept";

export type ConceptGraphTopologyNode = {
  id: string;
};

export type ConceptGraphTopologyLink = {
  source: string;
  target: string;
};

export type ConceptGraphTopologySnapshot = {
  signature: string;
  nodes: ConceptGraphTopologyNode[];
  links: ConceptGraphTopologyLink[];
};

/**
 * 表示中グラフの物理トポロジーを1回の辺収集から作る。
 * title / favorite / domainTags などは含めず、node ID と無向辺だけから決定的に署名する。
 */
export const createConceptGraphTopologySnapshot = (
  concepts: readonly Concept[]
): ConceptGraphTopologySnapshot => {
  const nodeIds = [...new Set(concepts.map((concept) => concept.id))].sort((a, b) =>
    a.localeCompare(b)
  );

  const edges = collectUndirectedConceptEdges(concepts);
  const sortedLinkPairs = edges
    .map((edge) => [edge.source, edge.target] as const)
    .sort((a, b) => {
      const sourceCmp = a[0].localeCompare(b[0]);
      if (sourceCmp !== 0) {
        return sourceCmp;
      }
      return a[1].localeCompare(b[1]);
    });

  return {
    signature: JSON.stringify({ nodes: nodeIds, links: sortedLinkPairs }),
    nodes: concepts.map((concept) => ({ id: concept.id })),
    links: edges.map((edge) => ({ source: edge.source, target: edge.target }))
  };
};

/**
 * 表示中グラフの物理トポロジー署名。
 * title / favorite / domainTags などは含めず、node ID と無向辺だけから決定的に作る。
 */
export const createConceptGraphTopologySignature = (concepts: readonly Concept[]): string =>
  createConceptGraphTopologySnapshot(concepts).signature;
