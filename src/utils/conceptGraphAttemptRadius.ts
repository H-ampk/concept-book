export type GraphMetricMode = "normal" | "attempts";

export const GRAPH_METRIC_MODES: { mode: GraphMetricMode; label: string }[] = [
  { mode: "normal", label: "通常" },
  { mode: "attempts", label: "学習回数" }
];

export const GRAPH_NODE_RADIUS_DEFAULT = 5.2;
export const GRAPH_NODE_RADIUS_FAVORITE = 6.8;

export const GRAPH_ATTEMPT_RADIUS_MIN = 5.2;
export const GRAPH_ATTEMPT_RADIUS_MAX = 16;
export const GRAPH_ATTEMPT_RADIUS_SCALE = 1.8;

const sanitizeAttempts = (totalAttempts: number): number => {
  if (!Number.isFinite(totalAttempts) || totalAttempts < 0) {
    return 0;
  }
  return totalAttempts;
};

export function getConceptGraphAttemptRadius(totalAttempts: number): number {
  const attempts = sanitizeAttempts(totalAttempts);
  const radius = GRAPH_ATTEMPT_RADIUS_MIN + Math.log1p(attempts) * GRAPH_ATTEMPT_RADIUS_SCALE;
  return Math.min(GRAPH_ATTEMPT_RADIUS_MAX, radius);
}

export function getConceptGraphNodeRadius({
  metricMode,
  totalAttempts,
  isFavorite
}: {
  metricMode: GraphMetricMode;
  totalAttempts: number;
  isFavorite: boolean;
}): number {
  if (metricMode === "attempts") {
    return getConceptGraphAttemptRadius(totalAttempts);
  }
  return isFavorite ? GRAPH_NODE_RADIUS_FAVORITE : GRAPH_NODE_RADIUS_DEFAULT;
}

export function getConceptGraphAttemptLabel(totalAttempts: number): string {
  const attempts = Math.floor(sanitizeAttempts(totalAttempts));
  return attempts === 0 ? "未学習" : `${attempts}回`;
}
