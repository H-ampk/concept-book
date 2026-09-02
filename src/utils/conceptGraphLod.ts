export const SMALL_GRAPH_NODE_COUNT = 40;
export const MEDIUM_LABEL_SCALE = 0.8;
export const FULL_LABEL_SCALE = 1.5;

export type ConceptGraphLabelVisibilityInput = {
  globalScale: number;
  nodeCount: number;
  isSelected: boolean;
  isFavorite: boolean;
};

export const shouldShowConceptGraphLabel = ({
  globalScale,
  nodeCount,
  isSelected,
  isFavorite
}: ConceptGraphLabelVisibilityInput): boolean => {
  if (isSelected) {
    return true;
  }

  if (nodeCount <= SMALL_GRAPH_NODE_COUNT) {
    return true;
  }

  if (globalScale < MEDIUM_LABEL_SCALE) {
    return false;
  }

  if (globalScale < FULL_LABEL_SCALE) {
    return isFavorite;
  }

  return true;
};
