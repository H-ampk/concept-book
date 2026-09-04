export const GRAPH_NODE_PAGE = 200;
export const GRAPH_FIT_DURATION_MS = 400;
export const GRAPH_FIT_PADDING_PX = 48;

export const shouldAutoFitConceptGraph = (
  hasAutoFitted: boolean,
  nodeCount: number
): boolean => !hasAutoFitted && nodeCount > 0;

export const getVisibleGraphNodeCount = (
  graphNodeLimit: number,
  conceptCount: number
): number => Math.min(graphNodeLimit, Math.max(0, conceptCount));

export const nextGraphNodeLimit = (
  graphNodeLimit: number,
  conceptCount: number,
  pageSize: number = GRAPH_NODE_PAGE
): number => Math.min(graphNodeLimit + pageSize, conceptCount);
