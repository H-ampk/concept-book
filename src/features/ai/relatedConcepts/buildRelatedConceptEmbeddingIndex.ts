import { AIError, isAIError } from "../errors";
import type { AIEmbeddingProvider } from "../types";
import { EMBEDDING_BATCH_SIZE } from "./constants";
import { embeddingCacheEntryKey, type ConceptEmbeddingCache } from "./embeddingCache";
import { fingerprintRelatedConceptEmbeddingText } from "./fingerprint";
import { isValidEmbeddingVector, vectorNorm } from "./cosineSimilarity";
import type { ConceptEmbeddingCacheEntry, RelatedConceptEmbeddingIndex } from "./types";

export type RelatedConceptEmbeddingIndexItem = {
  conceptId: string;
  text: string;
};

export type BuildRelatedConceptEmbeddingIndexOptions = {
  items: readonly RelatedConceptEmbeddingIndexItem[];
  model: string;
  provider: AIEmbeddingProvider;
  cache: ConceptEmbeddingCache;
  existingConceptIds?: ReadonlySet<string>;
  batchSize?: number;
  onProgress?: (completed: number, total: number) => void;
};

const shouldRethrowEmbeddingError = (error: unknown): boolean => {
  if (!isAIError(error)) {
    return false;
  }
  return (
    error.code === "disabled" ||
    error.code === "model-not-found" ||
    error.code === "timeout" ||
    error.code === "connection-failed" ||
    error.code === "network"
  );
};

const toCacheEntry = (
  conceptId: string,
  model: string,
  fingerprint: string,
  vector: number[]
): ConceptEmbeddingCacheEntry => {
  const norm = vectorNorm(vector);
  return {
    conceptId,
    model,
    fingerprint,
    vector: [...vector],
    ...(norm !== null ? { norm } : {})
  };
};

const embedOne = async (
  provider: AIEmbeddingProvider,
  text: string
): Promise<number[] | null> => {
  try {
    const [vector] = await provider.embed(text);
    return isValidEmbeddingVector(vector) ? vector : null;
  } catch (error) {
    if (shouldRethrowEmbeddingError(error)) {
      throw error;
    }
    return null;
  }
};

const embedBatch = async (
  provider: AIEmbeddingProvider,
  texts: string[]
): Promise<Array<number[] | null>> => {
  try {
    const vectors = await provider.embed(texts);
    if (vectors.length !== texts.length) {
      return Promise.all(texts.map((text) => embedOne(provider, text)));
    }
    return vectors.map((vector) => (isValidEmbeddingVector(vector) ? vector : null));
  } catch (error) {
    if (shouldRethrowEmbeddingError(error)) {
      throw error;
    }
    return Promise.all(texts.map((text) => embedOne(provider, text)));
  }
};

export const buildRelatedConceptEmbeddingIndex = async (
  options: BuildRelatedConceptEmbeddingIndexOptions
): Promise<RelatedConceptEmbeddingIndex> => {
  const model = options.model.trim();
  if (!model) {
    throw new AIError("invalid-response", "Embeddingモデルが設定されていません。");
  }

  const batchSize = Math.max(1, options.batchSize ?? EMBEDDING_BATCH_SIZE);
  const existingConceptIds = options.existingConceptIds;
  const cached = await options.cache.getAll();

  const orphanKeys = cached
    .filter((entry) => existingConceptIds && !existingConceptIds.has(entry.conceptId))
    .map((entry) => embeddingCacheEntryKey(entry.conceptId, entry.model));
  if (orphanKeys.length > 0) {
    await options.cache.deleteKeys(orphanKeys);
  }

  const usableCache = new Map<string, ConceptEmbeddingCacheEntry>();
  for (const entry of cached) {
    if (existingConceptIds && !existingConceptIds.has(entry.conceptId)) {
      continue;
    }
    if (entry.model !== model) {
      continue;
    }
    if (!isValidEmbeddingVector(entry.vector)) {
      continue;
    }
    usableCache.set(entry.conceptId, entry);
  }

  const embeddings = new Map<string, number[]>();
  const failedIds: string[] = [];
  const misses: Array<{ conceptId: string; text: string; fingerprint: string }> = [];
  const total = options.items.length;

  for (const item of options.items) {
    const fingerprint = fingerprintRelatedConceptEmbeddingText(item.text);
    const hit = usableCache.get(item.conceptId);
    if (hit && hit.fingerprint === fingerprint) {
      embeddings.set(item.conceptId, hit.vector);
    } else {
      misses.push({ conceptId: item.conceptId, text: item.text, fingerprint });
    }
  }

  options.onProgress?.(embeddings.size, total);

  const pendingPuts: ConceptEmbeddingCacheEntry[] = [];

  for (let offset = 0; offset < misses.length; offset += batchSize) {
    const batch = misses.slice(offset, offset + batchSize);
    const vectors = await embedBatch(
      options.provider,
      batch.map((item) => item.text)
    );
    batch.forEach((item, index) => {
      const vector = vectors[index];
      if (!vector) {
        failedIds.push(item.conceptId);
        return;
      }
      embeddings.set(item.conceptId, vector);
      pendingPuts.push(toCacheEntry(item.conceptId, model, item.fingerprint, vector));
    });
    options.onProgress?.(embeddings.size + failedIds.length, total);
  }

  if (pendingPuts.length > 0) {
    await options.cache.putMany(pendingPuts);
  }

  return { embeddings, failedIds };
};
