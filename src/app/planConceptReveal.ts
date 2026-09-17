import type { Concept } from "../types/concept";
import type { ConceptMastery } from "../utils/mastery/types";
import {
  conceptMatchesMasteryOverviewFilter,
  type MasteryOverviewFilter
} from "../utils/mastery/masteryPresentation";
import {
  planFiltersToRevealConcept,
  type ConceptListFilterState
} from "./revealConceptInGraphFilters";

export type ConceptRevealState = {
  filters: ConceptListFilterState;
  masteryFilter: MasteryOverviewFilter;
};

export type ConceptRevealPlan = {
  nextFilters: ConceptListFilterState;
  nextMasteryFilter: MasteryOverviewFilter;
  filtersChanged: boolean;
  masteryFilterChanged: boolean;
  changed: boolean;
};

export const planConceptReveal = (
  concept: Concept,
  state: ConceptRevealState,
  mastery: ConceptMastery | undefined
): ConceptRevealPlan => {
  const base = planFiltersToRevealConcept(concept, state.filters);
  const masteryMatches =
    state.masteryFilter === "all" ||
    conceptMatchesMasteryOverviewFilter(mastery, state.masteryFilter);
  const nextMasteryFilter = masteryMatches ? state.masteryFilter : "all";
  const masteryFilterChanged = nextMasteryFilter !== state.masteryFilter;

  return {
    nextFilters: base.nextFilters,
    nextMasteryFilter,
    filtersChanged: base.filtersChanged,
    masteryFilterChanged,
    changed: base.filtersChanged || masteryFilterChanged
  };
};
