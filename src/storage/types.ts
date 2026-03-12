import type { Concept, ConceptInput } from "../types/concept";

// Security note for future sync backends:
// - Keep this interface storage-agnostic so UI never talks directly to remote APIs.
// - When adding cloud sync, enforce auth + transport encryption (HTTPS/TLS) at implementation level.
// - Validate imported payload shape/version and avoid trusting remote data blindly.
// - Consider per-record encryption and audit logging if sensitive notes are synced.
export type ConceptStorage = {
  getAllConcepts: () => Promise<Concept[]>;
  getConceptById: (id: string) => Promise<Concept | undefined>;
  createConcept: (input: ConceptInput) => Promise<Concept>;
  updateConcept: (
    id: string,
    updates: Partial<ConceptInput> & {
      relatedIds?: string[];
      domainTags?: string[];
      researchTags?: string[];
    }
  ) => Promise<Concept | undefined>;
  deleteConcept: (id: string) => Promise<void>;
  exportConcepts: () => Promise<Concept[]>;
  importConcepts: (
    concepts: Concept[],
    mode: "replace" | "merge"
  ) => Promise<{ imported: number; skipped: number }>;
};
