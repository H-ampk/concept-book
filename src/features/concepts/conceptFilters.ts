import type { Concept } from "../../types/concept";
import { includesNormalized } from "../../utils/search";

const fullText = (concept: Concept): string =>
  [
    concept.title,
    concept.definition,
    concept.myInterpretation,
    concept.tags.join(" "),
    concept.notes
  ].join(" ");

export const filterConcepts = (
  concepts: Concept[],
  query: string,
  selectedTags: string[],
  onlyFavorite: boolean
): Concept[] =>
  concepts.filter((concept) => {
    const byQuery = includesNormalized(fullText(concept), query);
    const byTags =
      selectedTags.length === 0 || selectedTags.every((tag) => concept.tags.includes(tag));
    const byFavorite = !onlyFavorite || concept.favorite;
    return byQuery && byTags && byFavorite;
  });

export const collectTags = (concepts: Concept[]): string[] => {
  const set = new Set<string>();
  concepts.forEach((concept) => concept.tags.forEach((tag) => set.add(tag)));
  return [...set].sort((a, b) => a.localeCompare(b, "ja"));
};
