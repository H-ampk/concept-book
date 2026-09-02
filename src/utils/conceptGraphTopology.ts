import { collectUndirectedConceptEdges } from "./conceptRelations";
import type { Concept } from "../types/concept";

/**
 * 表示中グラフの物理トポロジー署名。
 * title / favorite / domainTags などは含めず、node ID と無向辺だけから決定的に作る。
 */
export const createConceptGraphTopologySignature = (concepts: readonly Concept[]): string => {
  const nodeIds = [...new Set(concepts.map((concept) => concept.id))].sort((a, b) =>
    a.localeCompare(b)
  );

  const links = collectUndirectedConceptEdges(concepts)
    .map((edge) => [edge.source, edge.target] as const)
    .sort((a, b) => {
      const sourceCmp = a[0].localeCompare(b[0]);
      if (sourceCmp !== 0) {
        return sourceCmp;
      }
      return a[1].localeCompare(b[1]);
    });

  return JSON.stringify({ nodes: nodeIds, links });
};
