import {
  MASTERY_CONFIDENCE_LABELS,
  MASTERY_FRESHNESS_LABELS,
  MASTERY_STATE_LABELS
} from "./constants";
import type { ConceptMastery, MasteryState } from "./types";

export type MasteryOverviewFilter = "all" | MasteryState | "stale";

export const MASTERY_OVERVIEW_FILTER_OPTIONS: {
  value: MasteryOverviewFilter;
  label: string;
}[] = [
  { value: "all", label: "すべて" },
  { value: "unlearned", label: MASTERY_STATE_LABELS.unlearned },
  { value: "insufficient-data", label: MASTERY_STATE_LABELS["insufficient-data"] },
  { value: "learning", label: MASTERY_STATE_LABELS.learning },
  { value: "developing", label: MASTERY_STATE_LABELS.developing },
  { value: "mastered", label: MASTERY_STATE_LABELS.mastered },
  { value: "stale", label: MASTERY_FRESHNESS_LABELS.stale }
];

const isLearnedMasteryState = (state: MasteryState): boolean =>
  state === "learning" || state === "developing" || state === "mastered";

/** 一覧向けの短い理解状態ラベル。未学習・データ不足では数値を出さない。 */
export const getConceptMasteryOverviewLabel = (mastery: ConceptMastery): string => {
  if (!isLearnedMasteryState(mastery.state)) {
    return MASTERY_STATE_LABELS[mastery.state];
  }
  const parts = [`理解度 ${mastery.masteryScore}`, MASTERY_STATE_LABELS[mastery.state]];
  if (mastery.freshness === "stale") {
    parts.push(MASTERY_FRESHNESS_LABELS.stale);
  }
  return parts.join(" · ");
};

/** aria-label / title 用。confidence と freshness を補助情報として含める。 */
export const getConceptMasteryAccessibleLabel = (mastery: ConceptMastery): string => {
  const overview = getConceptMasteryOverviewLabel(mastery);
  return [
    overview,
    `信頼度: ${MASTERY_CONFIDENCE_LABELS[mastery.confidence]}`,
    MASTERY_FRESHNESS_LABELS[mastery.freshness]
  ].join("。");
};

export const conceptMatchesMasteryOverviewFilter = (
  mastery: ConceptMastery | undefined,
  filter: MasteryOverviewFilter
): boolean => {
  if (filter === "all") {
    return true;
  }
  if (!mastery) {
    return false;
  }
  if (filter === "stale") {
    return mastery.freshness === "stale";
  }
  return mastery.state === filter;
};
