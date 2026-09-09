import { type Concept, type ConceptStatus } from "../../types/concept";
import { includesNormalized, normalizeForSearch } from "../search";

export type DataLabConceptFavoriteFilter = "all" | "favorite" | "notFavorite";

export type DataLabConceptFilters = {
  query: string;
  domainTags: string[];
  researchTags: string[];
  statuses: ConceptStatus[];
  favorite: DataLabConceptFavoriteFilter;
};

export const DEFAULT_DATA_LAB_CONCEPT_FILTERS: DataLabConceptFilters = {
  query: "",
  domainTags: [],
  researchTags: [],
  statuses: [],
  favorite: "all"
};

export const isDataLabConceptFiltersDefault = (filters: DataLabConceptFilters): boolean =>
  normalizeForSearch(filters.query) === "" &&
  filters.domainTags.length === 0 &&
  filters.researchTags.length === 0 &&
  filters.statuses.length === 0 &&
  filters.favorite === "all";

const normalizeTagList = (tags: readonly string[] | undefined): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags ?? []) {
    const tag = raw.trim();
    if (!tag || seen.has(tag)) {
      continue;
    }
    seen.add(tag);
    out.push(tag);
  }
  return out;
};

const matchesQuery = (concept: Concept, query: string): boolean => {
  if (!normalizeForSearch(query)) {
    return true;
  }
  return includesNormalized(concept.title, query) || includesNormalized(concept.id, query);
};

const matchesTagsOr = (selected: string[], conceptTags: readonly string[] | undefined): boolean => {
  if (selected.length === 0) {
    return true;
  }
  const tags = normalizeTagList(conceptTags);
  if (tags.length === 0) {
    return false;
  }
  return selected.some((tag) => tags.includes(tag));
};

const matchesStatuses = (selected: ConceptStatus[], status: ConceptStatus): boolean => {
  if (selected.length === 0) {
    return true;
  }
  return selected.includes(status);
};

const matchesFavorite = (favorite: DataLabConceptFavoriteFilter, value: boolean): boolean => {
  if (favorite === "all") {
    return true;
  }
  if (favorite === "favorite") {
    return value === true;
  }
  return value === false;
};

/**
 * Data Lab Concept フィルタ。種類同士は AND、同一種類の複数値は OR。
 * 検索は title / id。入力 Concept は mutate しない。
 */
export const filterDataLabConcepts = (
  concepts: readonly Concept[],
  filters: DataLabConceptFilters
): Concept[] => {
  const selectedDomains = normalizeTagList(filters.domainTags);
  const selectedResearch = normalizeTagList(filters.researchTags);

  return concepts.filter((concept) => {
    return (
      matchesQuery(concept, filters.query) &&
      matchesTagsOr(selectedDomains, concept.domainTags) &&
      matchesTagsOr(selectedResearch, concept.researchTags) &&
      matchesStatuses(filters.statuses, concept.status) &&
      matchesFavorite(filters.favorite, concept.favorite)
    );
  });
};
