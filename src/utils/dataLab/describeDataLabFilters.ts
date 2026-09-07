import type { Concept } from "../../types/concept";
import type { QuizDeck } from "../../types/quiz";
import type { DataLabFilters } from "./filterDataLabLogs";
import { isDataLabFiltersDefault } from "./filterDataLabLogs";

const formatYmd = (ymd: string): string => ymd.trim().replace(/-/g, "/");

export type DataLabFilterChip = {
  id: string;
  label: string;
};

export const describeDataLabFilters = (
  filters: DataLabFilters,
  conceptById: Map<string, Concept>,
  deckById: Map<string, QuizDeck>
): DataLabFilterChip[] => {
  if (isDataLabFiltersDefault(filters)) {
    return [];
  }

  const chips: DataLabFilterChip[] = [];
  const from = filters.dateFrom.trim();
  const to = filters.dateTo.trim();
  if (from || to) {
    chips.push({
      id: "period",
      label: `期間: ${from ? formatYmd(from) : ""}${from || to ? "〜" : ""}${to ? formatYmd(to) : ""}`
    });
  }

  if (filters.conceptIds.length > 0) {
    const names = filters.conceptIds.map((id) => conceptById.get(id)?.title?.trim() || id);
    chips.push({ id: "concept", label: `Concept: ${names.join(", ")}` });
  }

  if (filters.domainTags.length > 0) {
    chips.push({ id: "domain", label: `分野: ${filters.domainTags.join(", ")}` });
  }

  if (filters.deckIds.length > 0) {
    const names = filters.deckIds.map((id) => deckById.get(id)?.title?.trim() || id);
    chips.push({ id: "deck", label: `Deck: ${names.join(", ")}` });
  }

  if (filters.correctness === "correct") {
    chips.push({ id: "correctness", label: "正答のみ" });
  } else if (filters.correctness === "incorrect") {
    chips.push({ id: "correctness", label: "誤答のみ" });
  }

  return chips;
};
