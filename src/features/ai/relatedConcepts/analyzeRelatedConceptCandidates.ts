import { normalizeForSearch } from "../../../utils/search";
import type { AIConceptSnapshot } from "../conceptSnapshot";
import type { AITextProvider } from "../types";
import { LLM_CANDIDATE_LIMIT } from "./constants";
import {
  buildRelatedConceptAnalysisMessages,
  type RelatedConceptAnalysisCandidate
} from "./buildRelatedConceptAnalysisPrompt";
import { parseRelatedConceptAnalysis } from "./parseRelatedConceptAnalysis";
import type { AIExistingRelatedConceptSuggestion, AINewRelatedConceptSuggestion } from "./types";

export type AnalyzeRelatedConceptCandidatesOptions = {
  target: Pick<AIConceptSnapshot, "id" | "title" | "definition" | "myInterpretation">;
  candidates: readonly RelatedConceptAnalysisCandidate[];
  textProvider: AITextProvider;
  relatedIds: ReadonlySet<string>;
  existingTitlesNormalized?: ReadonlySet<string>;
  titlesById: ReadonlyMap<string, string>;
  similaritiesById: ReadonlyMap<string, number>;
  existingLimit?: number;
  newLimit?: number;
};

export type AnalyzedRelatedConceptCandidates = {
  existing: AIExistingRelatedConceptSuggestion[];
  new: AINewRelatedConceptSuggestion[];
};

export const analyzeRelatedConceptCandidates = async (
  options: AnalyzeRelatedConceptCandidatesOptions
): Promise<AnalyzedRelatedConceptCandidates> => {
  const existingLimit = options.existingLimit ?? LLM_CANDIDATE_LIMIT;
  const llmCandidates = options.candidates.slice(0, existingLimit);
  if (llmCandidates.length === 0) {
    return { existing: [], new: [] };
  }

  const embeddingCandidateIds = new Set(llmCandidates.map((candidate) => candidate.id));
  const messages = buildRelatedConceptAnalysisMessages({
    target: options.target,
    candidates: llmCandidates
  });
  const { text } = await options.textProvider.generate({ messages });
  const parsed = parseRelatedConceptAnalysis(text, {
    embeddingCandidateIds,
    selfId: options.target.id,
    relatedIds: options.relatedIds,
    existingTitlesNormalized: options.existingTitlesNormalized,
    currentTitleNormalized: normalizeForSearch(options.target.title),
    existingLimit,
    newLimit: options.newLimit
  });

  const existing: AIExistingRelatedConceptSuggestion[] = [];
  for (const item of parsed.existing) {
    const title = options.titlesById.get(item.id);
    const similarity = options.similaritiesById.get(item.id);
    if (!title || similarity === undefined) {
      continue;
    }
    existing.push({
      conceptId: item.id,
      title,
      similarity,
      reason: item.reason
    });
  }

  return { existing, new: parsed.new };
};
