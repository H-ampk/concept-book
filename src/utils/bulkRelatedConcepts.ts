import { createEmptyConceptInput, type Concept, type ConceptInput } from "../types/concept";

/** コンマ・読点・改行で分割し、trim・空除去・入力内の重複除去（出現順を維持） */
export function parseBulkRelatedConceptTitles(raw: string): string[] {
  if (!raw.trim()) {
    return [];
  }
  const parts = raw.split(/[,\n、]+/);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const t = p.trim();
    if (!t || seen.has(t)) {
      continue;
    }
    seen.add(t);
    out.push(t);
  }
  return out;
}

/** Concept.title との完全一致のみ（正規化・類似一致なし） */
export function findConceptByExactTitle(concepts: Concept[], title: string): Concept | undefined {
  return concepts.find((c) => c.title === title);
}

/** タイトルのみ指定した新規 Concept 用入力（タグ等は空・既定値） */
export function createConceptInputFromTitle(title: string): ConceptInput {
  return { ...createEmptyConceptInput(), title };
}
