import { EMBEDDING_RETRIEVAL_LIMIT } from "./constants";
import { cosineSimilarity } from "./cosineSimilarity";
import type { RetrievedRelatedConceptCandidate } from "./types";

export type RetrieveRelatedConceptCandidatesOptions = {
  query: readonly number[];
  embeddings: ReadonlyMap<string, readonly number[]>;
  selfId?: string;
  relatedIds: ReadonlySet<string>;
  limit?: number;
};

export const retrieveRelatedConceptCandidates = (
  options: RetrieveRelatedConceptCandidatesOptions
): RetrievedRelatedConceptCandidate[] => {
  const limit = options.limit ?? EMBEDDING_RETRIEVAL_LIMIT;
  const ranked: RetrievedRelatedConceptCandidate[] = [];

  for (const [conceptId, vector] of options.embeddings) {
    if (!conceptId) {
      continue;
    }
    if (options.selfId && conceptId === options.selfId) {
      continue;
    }
    if (options.relatedIds.has(conceptId)) {
      continue;
    }
    const similarity = cosineSimilarity(options.query, vector);
    if (similarity === null) {
      continue;
    }
    ranked.push({ conceptId, similarity });
  }

  ranked.sort((a, b) => b.similarity - a.similarity || a.conceptId.localeCompare(b.conceptId));
  return ranked.slice(0, Math.max(0, limit));
};
