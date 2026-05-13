import type { Concept } from "../types/concept";

export function buildConceptByIdMap(concepts: Concept[]): Map<string, Concept> {
  return new Map(concepts.map((c) => [c.id, c]));
}

/** 同一 title が複数ある場合は配列出現順の先頭のみ（従来の Array#find と同様） */
export function buildConceptByTitleMap(concepts: Concept[]): Map<string, Concept> {
  const m = new Map<string, Concept>();
  for (const c of concepts) {
    if (!m.has(c.title)) {
      m.set(c.title, c);
    }
  }
  return m;
}

export function getConceptByTitleExact(map: Map<string, Concept>, title: string): Concept | undefined {
  return map.get(title);
}
