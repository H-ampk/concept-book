import type { Concept } from "../../types/concept";
import type { PdfPageTextIndex } from "./buildPdfPageTextIndex";
import { isTooNoisyConceptTitle, toConceptSearchKey } from "./toConceptSearchKey";

export type SearchableConceptTerm = {
  conceptId: string;
  title: string;
  searchKey: string;
};

export type ConceptTermMatch = {
  conceptId: string;
  title: string;
  searchStart: number;
  searchEnd: number;
  rawStart: number;
  rawEnd: number;
};

export const collectSearchableConceptTerms = (concepts: Concept[]): SearchableConceptTerm[] => {
  const byKey = new Map<string, SearchableConceptTerm[]>();
  for (const concept of concepts) {
    if (isTooNoisyConceptTitle(concept.title)) {
      continue;
    }
    const searchKey = toConceptSearchKey(concept.title);
    const list = byKey.get(searchKey) ?? [];
    list.push({ conceptId: concept.id, title: concept.title, searchKey });
    byKey.set(searchKey, list);
  }
  const unique: SearchableConceptTerm[] = [];
  for (const list of byKey.values()) {
    const ids = new Set(list.map((item) => item.conceptId));
    if (ids.size !== 1) {
      continue;
    }
    const first = list[0];
    if (first) {
      unique.push(first);
    }
  }
  unique.sort((a, b) => b.searchKey.length - a.searchKey.length || a.conceptId.localeCompare(b.conceptId));
  return unique;
};

export const findConceptTermMatches = (
  index: PdfPageTextIndex,
  terms: SearchableConceptTerm[]
): ConceptTermMatch[] => {
  if (!index.search || terms.length === 0) {
    return [];
  }
  const occupied = new Array<boolean>(index.search.length).fill(false);
  const matches: ConceptTermMatch[] = [];
  for (const term of terms) {
    if (!term.searchKey) {
      continue;
    }
    let from = 0;
    while (from < index.search.length) {
      const found = index.search.indexOf(term.searchKey, from);
      if (found < 0) {
        break;
      }
      const searchEnd = found + term.searchKey.length;
      let blocked = false;
      for (let i = found; i < searchEnd; i += 1) {
        if (occupied[i]) {
          blocked = true;
          break;
        }
      }
      if (!blocked) {
        for (let i = found; i < searchEnd; i += 1) {
          occupied[i] = true;
        }
        const rawStart = index.searchToRaw[found] ?? 0;
        const lastRaw = index.searchToRaw[searchEnd - 1] ?? rawStart;
        matches.push({
          conceptId: term.conceptId,
          title: term.title,
          searchStart: found,
          searchEnd,
          rawStart,
          rawEnd: lastRaw + 1
        });
      }
      from = found + 1;
    }
  }
  matches.sort((a, b) => a.rawStart - b.rawStart || b.searchEnd - b.searchStart - (a.searchEnd - a.searchStart));
  return matches;
};
