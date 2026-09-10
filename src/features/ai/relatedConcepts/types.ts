export type ConceptEmbeddingCacheEntry = {
  conceptId: string;
  model: string;
  fingerprint: string;
  vector: number[];
  norm?: number;
};

export type AIExistingRelatedConceptSuggestion = {
  conceptId: string;
  title: string;
  similarity: number;
  reason: string;
};

export type AINewRelatedConceptSuggestion = {
  title: string;
  reason: string;
};

export type RelatedConceptAIProgress =
  | { stage: "embedding"; completed: number; total: number }
  | { stage: "analyzing" };

export type RelatedConceptAISuggestionResult = {
  existing: AIExistingRelatedConceptSuggestion[];
  new: AINewRelatedConceptSuggestion[];
  failedEmbeddingCount: number;
};

export type RetrievedRelatedConceptCandidate = {
  conceptId: string;
  similarity: number;
};

export type RelatedConceptEmbeddingIndex = {
  embeddings: Map<string, number[]>;
  failedIds: string[];
};
