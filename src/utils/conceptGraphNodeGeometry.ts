export const GRAPH_DOMAIN_RING_WIDTH = 2.4;
export const GRAPH_OUTER_RING_GAP = 1.6;
export const GRAPH_SELECTED_OUTER_LINE_WIDTH = 2.2;
export const GRAPH_FAVORITE_OUTER_LINE_WIDTH = 1.4;
/** Canvas 上で ring 外縁からラベル上端までの余白（graph space）。 */
export const GRAPH_LABEL_NODE_GAP = 2;

export type ConceptGraphNodeGeometryInput = {
  nodeRadius: number;
  isSelected: boolean;
  isFavorite: boolean;
};

export type ConceptGraphNodeGeometry = {
  nodeRadius: number;
  domainRadius: number;
  outerRadius: number;
  outerLineWidth: number;
  visualRadius: number;
  labelOffset: number;
};

/**
 * ConceptGraphView のノード描画と同じ ring / ラベルオフセット。
 * 見た目を変えないための共有計算。
 */
export const getConceptGraphNodeGeometry = ({
  nodeRadius,
  isSelected,
  isFavorite
}: ConceptGraphNodeGeometryInput): ConceptGraphNodeGeometry => {
  const domainRadius = nodeRadius + GRAPH_DOMAIN_RING_WIDTH / 2;
  const outerLineWidth = isSelected
    ? GRAPH_SELECTED_OUTER_LINE_WIDTH
    : GRAPH_FAVORITE_OUTER_LINE_WIDTH;
  const outerRadius = domainRadius + GRAPH_DOMAIN_RING_WIDTH / 2 + GRAPH_OUTER_RING_GAP;
  const visualRadius =
    isFavorite || isSelected
      ? outerRadius + outerLineWidth / 2
      : domainRadius + GRAPH_DOMAIN_RING_WIDTH / 2;

  return {
    nodeRadius,
    domainRadius,
    outerRadius,
    outerLineWidth,
    visualRadius,
    labelOffset: visualRadius
  };
};
