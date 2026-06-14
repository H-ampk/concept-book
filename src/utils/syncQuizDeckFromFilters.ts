import type { Concept } from "../types/concept";
import type { ContextCard } from "../types/contextCard";
import type { QuizDeck, QuizDeckGenerationFilters, QuizQuestion } from "../types/quiz";
import {
  generateForConcept,
  selectConceptsForDomainTag,
  type QuizSetGenerationMode
} from "./generateQuizSetFromDomainTag";
import { resolveQuestionConceptId } from "./quiz/resolveQuestionConceptId";

export type QuizDeckSyncSkipReason =
  | "already-in-pool"
  | "generation-failed"
  | "missing-definition";

export type QuizDeckSyncSkippedEntry = {
  conceptId: string;
  conceptTitle: string;
  reason: QuizDeckSyncSkipReason;
  detail: string;
};

export type QuizDeckSyncPreview = {
  canSync: boolean;
  filters: QuizDeckGenerationFilters | null;
  addableConceptCount: number;
  addableConcepts: Concept[];
  skippedEntries: QuizDeckSyncSkippedEntry[];
  questionsWithoutConceptId: number;
};

export type QuizDeckSyncResult = {
  addedQuestionCount: number;
  skippedCount: number;
  skippedEntries: QuizDeckSyncSkippedEntry[];
  newQuestionIds: string[];
  newQuestions: QuizQuestion[];
  updatedDeck: QuizDeck;
  error?: string;
};

/** クイズ集の再同期に使える生成条件を解決（古いデータは sourceDomainTag から推定） */
export function resolveDeckGenerationFilters(deck: QuizDeck): QuizDeckGenerationFilters | null {
  const fromFilters = deck.generationFilters?.targetDomainTag?.trim();
  if (fromFilters) {
    return {
      targetDomainTag: fromFilters,
      includeDraftConcepts: deck.generationFilters?.includeDraftConcepts ?? false,
      generationMode: deck.generationFilters?.generationMode ?? "auto"
    };
  }
  const fromSource = deck.sourceDomainTag?.trim();
  if (deck.sourceType === "domain-tag" && fromSource) {
    return {
      targetDomainTag: fromSource,
      includeDraftConcepts: false,
      generationMode: "auto"
    };
  }
  const fromDomainTags = deck.domainTags?.find((t) => t.trim().length > 0)?.trim();
  if (deck.sourceType === "domain-tag" && fromDomainTags) {
    return {
      targetDomainTag: fromDomainTags,
      includeDraftConcepts: false,
      generationMode: "auto"
    };
  }
  return null;
}

/** 問題プール内の conceptId 一覧（conceptId 未設定の問題は除外し、件数だけ返す） */
export function collectConceptIdsInDeckPool(
  deck: QuizDeck,
  questionsById: Map<string, QuizQuestion>
): { conceptIds: Set<string>; withoutConceptId: number } {
  const conceptIds = new Set<string>();
  let withoutConceptId = 0;
  for (const qid of deck.questionIds) {
    const q = questionsById.get(qid);
    if (!q) {
      continue;
    }
    const cid = resolveQuestionConceptId(q);
    if (cid) {
      conceptIds.add(cid);
    } else {
      withoutConceptId += 1;
    }
  }
  return { conceptIds, withoutConceptId };
}

export function previewQuizDeckSync(input: {
  deck: QuizDeck;
  allConcepts: Concept[];
  allQuestions: QuizQuestion[];
}): QuizDeckSyncPreview {
  const filters = resolveDeckGenerationFilters(input.deck);
  if (!filters) {
    return {
      canSync: false,
      filters: null,
      addableConceptCount: 0,
      addableConcepts: [],
      skippedEntries: [],
      questionsWithoutConceptId: 0
    };
  }

  const questionsById = new Map(input.allQuestions.map((q) => [q.id, q]));
  const { conceptIds: existingConceptIds, withoutConceptId } = collectConceptIdsInDeckPool(
    input.deck,
    questionsById
  );

  const targetConcepts = selectConceptsForDomainTag(
    input.allConcepts,
    filters.targetDomainTag,
    filters.includeDraftConcepts ?? false
  );

  const addableConcepts: Concept[] = [];
  const skippedEntries: QuizDeckSyncSkippedEntry[] = [];

  for (const concept of targetConcepts) {
    if (existingConceptIds.has(concept.id)) {
      skippedEntries.push({
        conceptId: concept.id,
        conceptTitle: concept.title,
        reason: "already-in-pool",
        detail: "すでに問題プールに含まれています。"
      });
      continue;
    }
    addableConcepts.push(concept);
  }

  return {
    canSync: true,
    filters,
    addableConceptCount: addableConcepts.length,
    addableConcepts,
    skippedEntries,
    questionsWithoutConceptId: withoutConceptId
  };
}

/** 未反映概念から問題を生成し、クイズ集の questionIds を更新する */
export function syncQuizDeckFromFilters(input: {
  deck: QuizDeck;
  allConcepts: Concept[];
  allContextCards: ContextCard[];
  allQuestions: QuizQuestion[];
  createQuestionId: () => string;
  nowIso: string;
}): QuizDeckSyncResult {
  const preview = previewQuizDeckSync({
    deck: input.deck,
    allConcepts: input.allConcepts,
    allQuestions: input.allQuestions
  });

  if (!preview.canSync || !preview.filters) {
    return {
      addedQuestionCount: 0,
      skippedCount: 0,
      skippedEntries: [],
      newQuestionIds: [],
      newQuestions: [],
      updatedDeck: input.deck,
      error: "このクイズ集は再同期条件（分野タグ）が設定されていません。"
    };
  }

  const filters = preview.filters;
  const generationMode: QuizSetGenerationMode = filters.generationMode ?? "auto";
  const skippedEntries: QuizDeckSyncSkippedEntry[] = [...preview.skippedEntries];
  const newQuestions: QuizQuestion[] = [];

  for (const concept of preview.addableConcepts) {
    const outcome = generateForConcept(
      concept,
      generationMode,
      input.allConcepts,
      input.allContextCards
    );

    if ("failed" in outcome) {
      skippedEntries.push({
        conceptId: concept.id,
        conceptTitle: concept.title,
        reason: "generation-failed",
        detail: outcome.reason
      });
      continue;
    }

    newQuestions.push({
      ...outcome.question,
      id: input.createQuestionId(),
      createdAt: input.nowIso,
      updatedAt: input.nowIso
    });
  }

  const newQuestionIds = newQuestions.map((q) => q.id);
  const updatedDeck: QuizDeck = {
    ...input.deck,
    questionIds: [...input.deck.questionIds, ...newQuestionIds],
    updatedAt: input.nowIso,
    lastSyncedAt: input.nowIso,
    generationFilters: filters
  };

  if (updatedDeck.generationSummary) {
    updatedDeck.generationSummary = {
      ...updatedDeck.generationSummary,
      targetConceptCount: selectConceptsForDomainTag(
        input.allConcepts,
        filters.targetDomainTag,
        filters.includeDraftConcepts ?? false
      ).length,
      generatedQuestionCount: updatedDeck.questionIds.length
    };
  }

  return {
    addedQuestionCount: newQuestions.length,
    skippedCount: skippedEntries.filter((e) => e.reason !== "already-in-pool").length,
    skippedEntries,
    newQuestionIds,
    newQuestions,
    updatedDeck
  };
}
