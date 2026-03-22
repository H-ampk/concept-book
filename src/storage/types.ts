import type { Concept, ConceptInput } from "../types/concept";
import type { ConceptMediaRef } from "../types/media";

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
      media?: ConceptMediaRef[];
    }
  ) => Promise<Concept | undefined>;
  deleteConcept: (id: string) => Promise<void>;
  exportConcepts: () => Promise<Concept[]>;
  importConcepts: (
    concepts: Concept[],
    mode: "replace" | "merge"
  ) => Promise<{ imported: number; skipped: number }>;
  /** 画像・動画を保存し、概念の media 参照を更新する */
  addMedia: (input: {
    conceptId: string;
    file: File;
    caption?: string;
  }) => Promise<ConceptMediaRef>;
  deleteMedia: (mediaId: string) => Promise<void>;
  updateMediaCaption: (mediaId: string, caption: string | undefined) => Promise<void>;
  getMediaBlob: (mediaId: string) => Promise<Blob | undefined>;
  /** concepts.json + media/ を含む ZIP */
  exportConceptBookPackage: () => Promise<Blob>;
  importConceptBookPackage: (
    file: File,
    mode: "replace" | "merge"
  ) => Promise<{
    importedConcepts: number;
    skippedConcepts: number;
    importedMedia: number;
    missingMedia: number;
  }>;
};
