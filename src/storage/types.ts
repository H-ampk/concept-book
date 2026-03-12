import type { Concept, ConceptInput } from "../types/concept";

export type ConceptStorage = {
  getAllConcepts: () => Promise<Concept[]>;
  getConceptById: (id: string) => Promise<Concept | undefined>;
  createConcept: (input: ConceptInput) => Promise<Concept>;
  updateConcept: (
    id: string,
    updates: Partial<ConceptInput> & { relatedIds?: string[]; tags?: string[] }
  ) => Promise<Concept | undefined>;
  deleteConcept: (id: string) => Promise<void>;
  exportConcepts: () => Promise<Concept[]>;
  importConcepts: (
    concepts: Concept[],
    mode: "replace" | "merge"
  ) => Promise<{ imported: number; skipped: number }>;
};
