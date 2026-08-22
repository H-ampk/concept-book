import type { Concept } from "../../types/concept";
import { extractMatchingSentence, includesNormalized, normalizeForSearch } from "../../utils/search";

export type ConceptSearchMatchType =
  | "title"
  | "definition"
  | "interpretation"
  | "contextDefinition"
  | "notes"
  | "domainTag"
  | "researchTag";

export type ConceptSearchMatch = {
  type: ConceptSearchMatchType;
  label: string;
  text: string;
  contextLabel?: string;
};

const MATCH_PRIORITY: ConceptSearchMatchType[] = [
  "title",
  "definition",
  "interpretation",
  "contextDefinition",
  "notes",
  "domainTag",
  "researchTag"
];

const SNIPPET_TYPES: ConceptSearchMatchType[] = [
  "definition",
  "interpretation",
  "contextDefinition",
  "notes"
];

export const collectConceptSearchMatches = (
  concept: Concept,
  query: string
): ConceptSearchMatch[] => {
  if (!normalizeForSearch(query)) {
    return [];
  }

  const matches: ConceptSearchMatch[] = [];

  if (includesNormalized(concept.title, query)) {
    matches.push({ type: "title", label: "タイトル", text: concept.title });
  }
  if (includesNormalized(concept.definition, query)) {
    matches.push({ type: "definition", label: "定義", text: concept.definition });
  }
  if (includesNormalized(concept.myInterpretation, query)) {
    matches.push({ type: "interpretation", label: "解釈", text: concept.myInterpretation });
  }

  for (const contextDefinition of concept.contextDefinitions ?? []) {
    if (includesNormalized(contextDefinition.definition, query)) {
      matches.push({
        type: "contextDefinition",
        label: `文脈別定義：${contextDefinition.context}`,
        text: contextDefinition.definition,
        contextLabel: contextDefinition.context
      });
    }
  }

  if (includesNormalized(concept.notes, query)) {
    matches.push({ type: "notes", label: "メモ", text: concept.notes });
  }

  for (const tag of concept.domainTags) {
    if (includesNormalized(tag, query)) {
      matches.push({ type: "domainTag", label: "分野タグ", text: tag });
    }
  }
  for (const tag of concept.researchTags) {
    if (includesNormalized(tag, query)) {
      matches.push({ type: "researchTag", label: "研究タグ", text: tag });
    }
  }

  return matches;
};

export const conceptMatchesQuery = (concept: Concept, query: string): boolean => {
  if (!normalizeForSearch(query)) {
    return true;
  }
  return collectConceptSearchMatches(concept, query).length > 0;
};

export const getPrimaryConceptSearchMatch = (
  concept: Concept,
  query: string
): ConceptSearchMatch | undefined => {
  const matches = collectConceptSearchMatches(concept, query);
  for (const type of MATCH_PRIORITY) {
    const match = matches.find((item) => item.type === type);
    if (match) {
      return match;
    }
  }
  return undefined;
};

export const shouldShowSearchSnippet = (match: ConceptSearchMatch | undefined): boolean =>
  Boolean(match && SNIPPET_TYPES.includes(match.type));

export const getSearchSnippetText = (match: ConceptSearchMatch, query: string): string =>
  extractMatchingSentence(match.text, query);
