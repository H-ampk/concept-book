export type ConceptGraphAccuracyBand = "unlearned" | "0-25" | "26-50" | "51-75" | "76-100";

export const GRAPH_ACCURACY_FILL_UNLEARNED = "#c8d0d4";
export const GRAPH_ACCURACY_FILL_0_25 = "#d6e4ec";
export const GRAPH_ACCURACY_FILL_26_50 = "#adc4d2";
export const GRAPH_ACCURACY_FILL_51_75 = "#7a9dad";
export const GRAPH_ACCURACY_FILL_76_100 = "#446878";

const FILL_BY_BAND: Record<ConceptGraphAccuracyBand, string> = {
  unlearned: GRAPH_ACCURACY_FILL_UNLEARNED,
  "0-25": GRAPH_ACCURACY_FILL_0_25,
  "26-50": GRAPH_ACCURACY_FILL_26_50,
  "51-75": GRAPH_ACCURACY_FILL_51_75,
  "76-100": GRAPH_ACCURACY_FILL_76_100
};

export const GRAPH_ACCURACY_LEGEND_ITEMS: {
  band: ConceptGraphAccuracyBand;
  label: string;
  fill: string;
}[] = [
  { band: "unlearned", label: "未学習", fill: GRAPH_ACCURACY_FILL_UNLEARNED },
  { band: "0-25", label: "0–25%", fill: GRAPH_ACCURACY_FILL_0_25 },
  { band: "26-50", label: "26–50%", fill: GRAPH_ACCURACY_FILL_26_50 },
  { band: "51-75", label: "51–75%", fill: GRAPH_ACCURACY_FILL_51_75 },
  { band: "76-100", label: "76–100%", fill: GRAPH_ACCURACY_FILL_76_100 }
];

export function getConceptGraphAccuracyBand(
  accuracy: number | null | undefined
): ConceptGraphAccuracyBand {
  if (accuracy == null || !Number.isFinite(accuracy) || accuracy < 0 || accuracy > 100) {
    return "unlearned";
  }
  if (accuracy <= 25) {
    return "0-25";
  }
  if (accuracy <= 50) {
    return "26-50";
  }
  if (accuracy <= 75) {
    return "51-75";
  }
  return "76-100";
}

export function getConceptGraphAccuracyFill(accuracy: number | null | undefined): string {
  return FILL_BY_BAND[getConceptGraphAccuracyBand(accuracy)];
}

export function getConceptGraphAccuracyLabel(accuracy: number | null | undefined): string {
  const band = getConceptGraphAccuracyBand(accuracy);
  if (band === "unlearned") {
    return "未学習";
  }
  return `${Math.round(accuracy as number)}%`;
}
