import type { Concept } from "../types/concept";
import { normalizeConceptTitle } from "./normalizeConceptTitle";

export function buildConceptByIdMap(concepts: Concept[]): Map<string, Concept> {
  return new Map(concepts.map((c) => [c.id, c]));
}

/** 正規化タイトルをキーにした Map。同一タイトルが複数ある場合は配列出現順の先頭のみ */
export function buildConceptByTitleMap(concepts: Concept[]): Map<string, Concept> {
  const m = new Map<string, Concept>();
  for (const c of concepts) {
    const key = normalizeConceptTitle(c.title);
    if (!key || m.has(key)) {
      continue;
    }
    m.set(key, c);
  }
  return m;
}

export function getConceptByTitleExact(map: Map<string, Concept>, title: string): Concept | undefined {
  const key = normalizeConceptTitle(title);
  if (!key) {
    return undefined;
  }
  return map.get(key);
}
