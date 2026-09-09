import type { Concept, ConceptStatus } from "../types/concept";
import { filterConcepts } from "../features/concepts/conceptFilters";
import { conceptMatchesQuery } from "../features/concepts/conceptSearch";
import { getDisplayStatus } from "../utils/conceptStatus";

export type ConceptListFilterState = {
  query: string;
  selectedDomainTags: string[];
  selectedResearchTags: string[];
  selectedStatuses: ConceptStatus[];
  onlyFavorite: boolean;
};

export type RevealConceptInGraphFiltersResult = {
  filtersChanged: boolean;
  nextFilters: ConceptListFilterState;
};

/**
 * 対象 Concept が現在のフィルタで見えるならフィルタを維持する。
 * 見えない場合だけ、その Concept を通すために必要な条件だけ解除する。
 */
export const planFiltersToRevealConcept = (
  concept: Concept,
  filters: ConceptListFilterState
): RevealConceptInGraphFiltersResult => {
  const visibleNow =
    filterConcepts(
      [concept],
      filters.query,
      filters.selectedDomainTags,
      filters.selectedResearchTags,
      filters.selectedStatuses,
      filters.onlyFavorite
    ).length > 0;

  if (visibleNow) {
    return { filtersChanged: false, nextFilters: filters };
  }

  let query = filters.query;
  if (!conceptMatchesQuery(concept, query)) {
    query = "";
  }

  let selectedDomainTags = filters.selectedDomainTags;
  if (
    selectedDomainTags.length > 0 &&
    !selectedDomainTags.every((tag) => concept.domainTags.includes(tag))
  ) {
    selectedDomainTags = selectedDomainTags.filter((tag) => concept.domainTags.includes(tag));
  }

  let selectedResearchTags = filters.selectedResearchTags;
  if (
    selectedResearchTags.length > 0 &&
    !selectedResearchTags.every((tag) => concept.researchTags.includes(tag))
  ) {
    selectedResearchTags = selectedResearchTags.filter((tag) =>
      concept.researchTags.includes(tag)
    );
  }

  let selectedStatuses = filters.selectedStatuses;
  if (
    selectedStatuses.length > 0 &&
    !selectedStatuses.includes(getDisplayStatus(concept))
  ) {
    selectedStatuses = [];
  }

  let onlyFavorite = filters.onlyFavorite;
  if (onlyFavorite && !concept.favorite) {
    onlyFavorite = false;
  }

  return {
    filtersChanged: true,
    nextFilters: {
      query,
      selectedDomainTags,
      selectedResearchTags,
      selectedStatuses,
      onlyFavorite
    }
  };
};
