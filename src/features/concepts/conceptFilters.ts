import { conceptStatusList, type Concept, type ConceptStatus } from "../../types/concept";
import { getDisplayStatus } from "../../utils/conceptStatus";
import { conceptMatchesQuery } from "./conceptSearch";

export const filterConcepts = (
  concepts: Concept[],
  query: string,
  selectedDomainTags: string[],
  selectedResearchTags: string[],
  selectedStatuses: ConceptStatus[],
  onlyFavorite: boolean
): Concept[] =>
  concepts.filter((concept) => {
    const byQuery = conceptMatchesQuery(concept, query);
    const byDomainTags =
      selectedDomainTags.length === 0 ||
      selectedDomainTags.every((tag) => concept.domainTags.includes(tag));
    const byResearchTags =
      selectedResearchTags.length === 0 ||
      selectedResearchTags.every((tag) => concept.researchTags.includes(tag));
    const byStatus =
      selectedStatuses.length === 0 ||
      selectedStatuses.includes(getDisplayStatus(concept));
    const byFavorite = !onlyFavorite || concept.favorite;
    return byQuery && byDomainTags && byResearchTags && byStatus && byFavorite;
  });

export const collectTagGroups = (
  concepts: Concept[]
): { domainTags: string[]; researchTags: string[] } => {
  const domainSet = new Set<string>();
  const researchSet = new Set<string>();
  concepts.forEach((concept) => {
    concept.domainTags.forEach((tag) => domainSet.add(tag));
    concept.researchTags.forEach((tag) => researchSet.add(tag));
  });
  return {
    domainTags: [...domainSet].sort((a, b) => a.localeCompare(b, "ja")),
    researchTags: [...researchSet].sort((a, b) => a.localeCompare(b, "ja"))
  };
};

export const allStatuses: ConceptStatus[] = [...conceptStatusList];
