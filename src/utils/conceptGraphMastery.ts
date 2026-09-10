import { MASTERY_STATE_LABELS } from "./mastery/constants";
import type { ConceptMastery, MasteryState } from "./mastery/types";

export const GRAPH_MASTERY_FILL_UNLEARNED = "#9aa3a8";
export const GRAPH_MASTERY_FILL_INSUFFICIENT = "#d4c4a8";
export const GRAPH_MASTERY_FILL_LEARNING = "#c97a52";
export const GRAPH_MASTERY_FILL_DEVELOPING = "#c9a24a";
export const GRAPH_MASTERY_FILL_MASTERED = "#3f8f72";

const FILL_BY_STATE: Record<MasteryState, string> = {
  unlearned: GRAPH_MASTERY_FILL_UNLEARNED,
  "insufficient-data": GRAPH_MASTERY_FILL_INSUFFICIENT,
  learning: GRAPH_MASTERY_FILL_LEARNING,
  developing: GRAPH_MASTERY_FILL_DEVELOPING,
  mastered: GRAPH_MASTERY_FILL_MASTERED
};

export const GRAPH_MASTERY_LEGEND_ITEMS: {
  state: MasteryState;
  label: string;
  fill: string;
}[] = (
  ["unlearned", "insufficient-data", "learning", "developing", "mastered"] as const
).map((state) => ({
  state,
  label: MASTERY_STATE_LABELS[state],
  fill: FILL_BY_STATE[state]
}));

const masteryStateOf = (mastery: ConceptMastery | undefined): MasteryState =>
  mastery?.state ?? "unlearned";

export function getConceptGraphMasteryFill(mastery: ConceptMastery | undefined): string {
  return FILL_BY_STATE[masteryStateOf(mastery)];
}

export function getConceptGraphMasteryLabel(mastery: ConceptMastery | undefined): string {
  const state = masteryStateOf(mastery);
  if (state === "unlearned" || state === "insufficient-data") {
    return MASTERY_STATE_LABELS[state];
  }
  const score = mastery?.masteryScore ?? 0;
  return `理解度 ${score} · ${MASTERY_STATE_LABELS[state]}`;
}
