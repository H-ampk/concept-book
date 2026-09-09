import type { ConceptStatus } from "../../types/concept";
import {
  isDataLabConceptFiltersDefault,
  type DataLabConceptFilters
} from "./filterDataLabConcepts";

export type DataLabFilterChip = {
  id: string;
  label: string;
};

const STATUS_LABEL: Record<ConceptStatus, string> = {
  active: "稼働中",
  researching: "調査中",
  unclear: "未整理",
  draft: "下書き",
  archived: "保管"
};

export const describeDataLabConceptFilters = (
  filters: DataLabConceptFilters
): DataLabFilterChip[] => {
  if (isDataLabConceptFiltersDefault(filters)) {
    return [];
  }

  const chips: DataLabFilterChip[] = [];
  const query = filters.query.trim();
  if (query) {
    chips.push({ id: "query", label: `検索: ${query}` });
  }
  if (filters.domainTags.length > 0) {
    chips.push({ id: "domain", label: `分野: ${filters.domainTags.join(", ")}` });
  }
  if (filters.researchTags.length > 0) {
    chips.push({ id: "research", label: `研究タグ: ${filters.researchTags.join(", ")}` });
  }
  if (filters.statuses.length > 0) {
    chips.push({
      id: "status",
      label: `status: ${filters.statuses.map((status) => STATUS_LABEL[status]).join(", ")}`
    });
  }
  if (filters.favorite === "favorite") {
    chips.push({ id: "favorite", label: "お気に入りのみ" });
  } else if (filters.favorite === "notFavorite") {
    chips.push({ id: "favorite", label: "お気に入り以外" });
  }

  return chips;
};
