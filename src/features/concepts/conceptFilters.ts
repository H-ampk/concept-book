import type { Concept } from "../../types/concept";
import { includesNormalized } from "../../utils/search";

const fullText = (concept: Concept): string =>
  [
    concept.title,
    concept.definition,
    concept.myInterpretation,
    concept.domainTags.join(" "),
    concept.researchTags.join(" "),
    concept.notes
  ].join(" ");

export const filterConcepts = (
  concepts: Concept[],
  query: string,
  selectedDomainTags: string[],
  selectedResearchTags: string[],
  onlyFavorite: boolean
): Concept[] =>
  concepts.filter((concept) => {
    const byQuery = includesNormalized(fullText(concept), query);
    const byDomainTags =
      selectedDomainTags.length === 0 ||
      selectedDomainTags.every((tag) => concept.domainTags.includes(tag));
    const byResearchTags =
      selectedResearchTags.length === 0 ||
      selectedResearchTags.every((tag) => concept.researchTags.includes(tag));
    const byFavorite = !onlyFavorite || concept.favorite;
    return byQuery && byDomainTags && byResearchTags && byFavorite;
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
