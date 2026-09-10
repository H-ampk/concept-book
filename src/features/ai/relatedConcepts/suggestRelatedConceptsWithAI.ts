import { createEmptyConceptInput, type Concept } from "../../../types/concept";
import { normalizeForSearch } from "../../../utils/search";
import { buildAIConceptSnapshot, type AIConceptSnapshot } from "../conceptSnapshot";
import { AIError } from "../errors";
import type { AIEmbeddingProvider, AITextProvider } from "../types";
import { analyzeRelatedConceptCandidates } from "./analyzeRelatedConceptCandidates";
import { buildRelatedConceptEmbeddingText } from "./buildRelatedConceptEmbeddingText";
import { buildRelatedConceptEmbeddingIndex } from "./buildRelatedConceptEmbeddingIndex";
import { LLM_CANDIDATE_LIMIT } from "./constants";
import { getConceptEmbeddingCache, type ConceptEmbeddingCache } from "./embeddingCache";
import { retrieveRelatedConceptCandidates } from "./retrieveRelatedConceptCandidates";
import type { RelatedConceptAIProgress, RelatedConceptAISuggestionResult } from "./types";

export type SuggestRelatedConceptsWithAIInput = {
  id?: string;
  title: string;
  definition: string;
  myInterpretation: string;
};

export type SuggestRelatedConceptsWithAIOptions = {
  current: SuggestRelatedConceptsWithAIInput;
  allConcepts: readonly Concept[];
  selectedIds: readonly string[];
  embeddingProvider: AIEmbeddingProvider;
  textProvider: AITextProvider;
  embeddingModel: string;
  cache?: ConceptEmbeddingCache;
  onProgress?: (progress: RelatedConceptAIProgress) => void;
};

const snapshotFromConcept = (concept: Concept): AIConceptSnapshot => buildAIConceptSnapshot(concept);

const snapshotFromCurrent = (current: SuggestRelatedConceptsWithAIInput): AIConceptSnapshot =>
  buildAIConceptSnapshot({
    ...createEmptyConceptInput(),
    id: current.id?.trim() || "__new__",
    createdAt: "",
    updatedAt: "",
    title: current.title,
    definition: current.definition,
    myInterpretation: current.myInterpretation
  });

export const suggestRelatedConceptsWithAI = async (
  options: SuggestRelatedConceptsWithAIOptions
): Promise<RelatedConceptAISuggestionResult> => {
  const currentSnapshot = snapshotFromCurrent(options.current);
  const currentId = options.current.id?.trim();
  const relatedIds = new Set(options.selectedIds);
  const cache = options.cache ?? (await getConceptEmbeddingCache());
  const existingConceptIds = new Set(options.allConcepts.map((concept) => concept.id));
  existingConceptIds.add(currentSnapshot.id);

  const indexItems = options.allConcepts.map((concept) => ({
    conceptId: concept.id,
    text: buildRelatedConceptEmbeddingText(snapshotFromConcept(concept))
  }));

  const currentText = buildRelatedConceptEmbeddingText(currentSnapshot);
  const currentIndexItem = {
    conceptId: currentSnapshot.id,
    text: currentText
  };
  const hasCurrentInAll = Boolean(currentId && options.allConcepts.some((concept) => concept.id === currentId));
  const items = hasCurrentInAll
    ? indexItems.map((item) => (item.conceptId === currentId ? currentIndexItem : item))
    : [...indexItems, currentIndexItem];

  options.onProgress?.({ stage: "embedding", completed: 0, total: items.length });

  const index = await buildRelatedConceptEmbeddingIndex({
    items,
    model: options.embeddingModel,
    provider: options.embeddingProvider,
    cache,
    existingConceptIds,
    onProgress: (completed, total) => {
      options.onProgress?.({ stage: "embedding", completed, total });
    }
  });

  const query = index.embeddings.get(currentSnapshot.id);
  if (!query) {
    throw new AIError("invalid-response", "対象ConceptのEmbeddingを取得できませんでした。");
  }

  const retrieved = retrieveRelatedConceptCandidates({
    query,
    embeddings: index.embeddings,
    selfId: currentSnapshot.id,
    relatedIds
  });

  const titlesById = new Map(options.allConcepts.map((concept) => [concept.id, concept.title]));
  const snapshotsById = new Map(
    options.allConcepts.map((concept) => [concept.id, snapshotFromConcept(concept)])
  );
  const similaritiesById = new Map(retrieved.map((item) => [item.conceptId, item.similarity]));
  const existingTitlesNormalized = new Set(
    options.allConcepts.map((concept) => normalizeForSearch(concept.title)).filter(Boolean)
  );

  const llmCandidates = retrieved.slice(0, LLM_CANDIDATE_LIMIT).flatMap((item) => {
    const snapshot = snapshotsById.get(item.conceptId);
    if (!snapshot) {
      return [];
    }
    return [
      {
        id: item.conceptId,
        title: snapshot.title,
        definition: snapshot.definition,
        myInterpretation: snapshot.myInterpretation,
        similarity: item.similarity
      }
    ];
  });

  options.onProgress?.({ stage: "analyzing" });
  const analyzed = await analyzeRelatedConceptCandidates({
    target: currentSnapshot,
    candidates: llmCandidates,
    textProvider: options.textProvider,
    relatedIds,
    existingTitlesNormalized,
    titlesById,
    similaritiesById
  });

  return {
    existing: analyzed.existing,
    new: analyzed.new,
    failedEmbeddingCount: index.failedIds.filter((id) => id !== currentSnapshot.id).length
  };
};
