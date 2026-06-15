import type { Concept, ContextDefinition } from "../types/concept";
import type { ContextCard } from "../types/contextCard";
import type { QuizChoiceSourceStrategy, QuizGenerationQuality } from "../types/quiz";
import { parseBulkRelatedConceptTitles } from "./bulkRelatedConcepts";
import { buildConceptByTitleMap } from "./conceptLookupMaps";
import { normalizeConceptTitle } from "./normalizeConceptTitle";
import { maskConceptNameInText } from "./maskConceptNameInText";

export type ContextDefinitionCard = {
  conceptId: string;
  contextDefinitionId: string;
  context: string;
  explanation: string;
  domainTags: string[];
  relatedConceptIds: string[];
};

export type GeneratedQuizChoice = {
  id: string;
  conceptId: string;
  contextDefinitionId: string;
  text: string;
  displayText: string;
  isCorrect: boolean;
  sourceStrategy: QuizChoiceSourceStrategy;
};

export type QuizGenerationResult = {
  prompt: string;
  choices: GeneratedQuizChoice[];
  correctChoiceId: string;
  quality: QuizGenerationQuality;
  warnings: string[];
};

const DISTRACTOR_COUNT = 3;

const createChoiceId = (): string =>
  `choice_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const normalizeTextKey = (text: string): string => text.trim().replace(/\s+/g, " ");

const shuffleArray = <T>(items: T[]): T[] => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

export function flattenContextDefinitionCards(concepts: Concept[]): ContextDefinitionCard[] {
  const cards: ContextDefinitionCard[] = [];
  for (const concept of concepts) {
    for (const def of concept.contextDefinitions ?? []) {
      const explanation = def.definition.trim();
      if (!explanation) {
        continue;
      }
      cards.push({
        conceptId: concept.id,
        contextDefinitionId: def.id,
        context: def.context.trim(),
        explanation,
        domainTags: concept.domainTags ?? [],
        relatedConceptIds: concept.relatedIds ?? []
      });
    }
  }
  return cards;
}

export function toContextDefinitionCard(
  concept: Concept,
  contextDefinition: ContextDefinition
): ContextDefinitionCard {
  return {
    conceptId: concept.id,
    contextDefinitionId: contextDefinition.id,
    context: contextDefinition.context.trim(),
    explanation: contextDefinition.definition.trim(),
    domainTags: concept.domainTags ?? [],
    relatedConceptIds: concept.relatedIds ?? []
  };
}

type Candidate = ContextDefinitionCard & { sourceStrategy: QuizChoiceSourceStrategy };

function collectDistractorCandidates(
  targetConcept: Concept,
  targetCard: ContextDefinitionCard,
  allCards: ContextDefinitionCard[],
  allContextCards: ContextCard[],
  allConcepts: Concept[],
  usedKeys: Set<string>
): Candidate[] {
  const out: Candidate[] = [];
  const conceptByTitle = buildConceptByTitleMap(allConcepts);
  const targetTitle = targetConcept.title.trim();

  const add = (card: ContextDefinitionCard, strategy: QuizChoiceSourceStrategy) => {
    if (
      card.contextDefinitionId === targetCard.contextDefinitionId &&
      card.conceptId === targetCard.conceptId
    ) {
      return;
    }
    const key = normalizeTextKey(card.explanation);
    const targetKey = normalizeTextKey(targetCard.explanation);
    if (!key || key === targetKey || usedKeys.has(key)) {
      return;
    }
    usedKeys.add(key);
    out.push({ ...card, sourceStrategy: strategy });
  };

  const relatedIds = new Set<string>([
    ...targetConcept.relatedIds,
    ...targetCard.relatedConceptIds
  ]);
  for (const relatedId of relatedIds) {
    if (relatedId === targetConcept.id) {
      continue;
    }
    for (const card of allCards) {
      if (card.conceptId === relatedId) {
        add(card, "same-context");
      }
    }
  }

  for (const contextCard of allContextCards) {
    const keyTerms = parseBulkRelatedConceptTitles(contextCard.keyConcepts);
    const referencesTarget =
      contextCard.linkedConcepts.includes(targetConcept.id) ||
      keyTerms.some((term) => normalizeConceptTitle(term) === normalizeConceptTitle(targetTitle));
    if (!referencesTarget) {
      continue;
    }

    const linkedIds = new Set(contextCard.linkedConcepts);
    for (const term of keyTerms) {
      const matched = conceptByTitle.get(normalizeConceptTitle(term));
      if (matched) {
        linkedIds.add(matched.id);
      }
    }
    for (const linkedId of linkedIds) {
      if (linkedId === targetConcept.id) {
        continue;
      }
      for (const card of allCards) {
        if (card.conceptId === linkedId) {
          add(card, "related-context");
        }
      }
    }
  }

  const targetTags = new Set(targetCard.domainTags.map((tag) => tag.trim()).filter(Boolean));
  for (const card of allCards) {
    if (card.domainTags.some((tag) => targetTags.has(tag.trim()))) {
      add(card, "same-domain");
    }
  }

  for (const card of shuffleArray(allCards)) {
    add(card, "random");
  }

  return out;
}

function determineQuality(distractors: GeneratedQuizChoice[]): QuizGenerationQuality {
  if (distractors.length < DISTRACTOR_COUNT) {
    return "failed";
  }
  const strategies = distractors.map((choice) => choice.sourceStrategy);
  if (strategies.every((s) => s === "same-context" || s === "related-context")) {
    return "high";
  }
  if (strategies.some((s) => s === "same-domain")) {
    return "medium";
  }
  if (strategies.some((s) => s === "random")) {
    return "low";
  }
  return "medium";
}

function buildWarnings(
  quality: QuizGenerationQuality,
  choiceCount: number,
  hasCorrectText: boolean,
  distractors: GeneratedQuizChoice[]
): string[] {
  const warnings: string[] = [];
  if (!hasCorrectText) {
    warnings.push("正答に使える文脈別カード本文が空です。");
  }
  if (choiceCount < 4) {
    warnings.push("選択肢が不足しています。手動で追加してください。");
  }
  if (distractors.some((choice) => choice.sourceStrategy === "same-domain")) {
    warnings.push("文脈別カードが不足しているため、同じ分野タグのカードから補充しました。");
  }
  if (distractors.some((choice) => choice.sourceStrategy === "random")) {
    warnings.push("近接する文脈別カードが不足しているため、ランダム候補を含んでいます。");
  }
  if (quality === "failed") {
    warnings.push("選択肢が不足しています。手動で追加してください。");
  }
  return Array.from(new Set(warnings));
}

function buildMaskedDisplayText(
  explanation: string,
  namesToMask: string[]
): string {
  return maskConceptNameInText(explanation, namesToMask);
}

export function flattenGeneralDefinitionCards(concepts: Concept[]): ContextDefinitionCard[] {
  return concepts
    .filter((concept) => concept.definition.trim().length > 0)
    .map((concept) => ({
      conceptId: concept.id,
      contextDefinitionId: `general_${concept.id}`,
      context: "一般定義",
      explanation: concept.definition.trim(),
      domainTags: concept.domainTags ?? [],
      relatedConceptIds: concept.relatedIds ?? []
    }));
}

export function flattenAllDefinitionSources(concepts: Concept[]): ContextDefinitionCard[] {
  const seen = new Set<string>();
  const out: ContextDefinitionCard[] = [];
  for (const card of [
    ...flattenContextDefinitionCards(concepts),
    ...flattenGeneralDefinitionCards(concepts)
  ]) {
    const key = `${card.conceptId}:${normalizeTextKey(card.explanation)}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(card);
  }
  return out;
}

export function generateQuizChoicesFromContextCards({
  targetConcept,
  targetContextDefinition,
  allConcepts,
  allContextCards,
  distractorPool
}: {
  targetConcept: Concept;
  targetContextDefinition: ContextDefinition;
  allConcepts: Concept[];
  allContextCards: ContextCard[];
  distractorPool?: ContextDefinitionCard[];
}): QuizGenerationResult {
  const targetCard = toContextDefinitionCard(targetConcept, targetContextDefinition);
  const allCards = distractorPool ?? flattenContextDefinitionCards(allConcepts);
  const warnings: string[] = [];

  if (!targetCard.explanation) {
    return {
      prompt: "",
      choices: [],
      correctChoiceId: "",
      quality: "failed",
      warnings: ["正答に使える文脈別カード本文が空です。"]
    };
  }

  const conceptById = new Map(allConcepts.map((concept) => [concept.id, concept]));
  const usedKeys = new Set<string>([normalizeTextKey(targetCard.explanation)]);

  const correctChoice: GeneratedQuizChoice = {
    id: createChoiceId(),
    conceptId: targetConcept.id,
    contextDefinitionId: targetCard.contextDefinitionId,
    text: targetCard.explanation,
    displayText: buildMaskedDisplayText(targetCard.explanation, [targetConcept.title]),
    isCorrect: true,
    sourceStrategy: "correct"
  };

  const candidates = collectDistractorCandidates(
    targetConcept,
    targetCard,
    allCards,
    allContextCards,
    allConcepts,
    usedKeys
  );

  const distractorChoices = candidates.slice(0, DISTRACTOR_COUNT).map((candidate) => {
    const sourceConcept = conceptById.get(candidate.conceptId);
    const namesToMask = [targetConcept.title, sourceConcept?.title ?? ""];
    return {
      id: createChoiceId(),
      conceptId: candidate.conceptId,
      contextDefinitionId: candidate.contextDefinitionId,
      text: candidate.explanation,
      displayText: buildMaskedDisplayText(candidate.explanation, namesToMask),
      isCorrect: false,
      sourceStrategy: candidate.sourceStrategy
    };
  });

  const choices = shuffleArray([correctChoice, ...distractorChoices]);
  const quality =
    distractorChoices.length < DISTRACTOR_COUNT
      ? "failed"
      : determineQuality(distractorChoices);

  warnings.push(
    ...buildWarnings(quality, choices.length, Boolean(targetCard.explanation), distractorChoices)
  );

  const contextLabel = targetCard.context ? `「${targetCard.context}」` : "この文脈";
  const prompt = `${contextLabel}における「${targetConcept.title}」の説明として正しいものはどれか。`;

  return {
    prompt,
    choices,
    correctChoiceId: correctChoice.id,
    quality,
    warnings: Array.from(new Set(warnings))
  };
}

export function replenishDistractorChoices({
  targetConcept,
  targetContextDefinition,
  allConcepts,
  allContextCards,
  existingChoices,
  strategy
}: {
  targetConcept: Concept;
  targetContextDefinition: ContextDefinition;
  allConcepts: Concept[];
  allContextCards: ContextCard[];
  existingChoices: GeneratedQuizChoice[];
  strategy: "same-domain" | "random";
}): GeneratedQuizChoice[] {
  const targetCard = toContextDefinitionCard(targetConcept, targetContextDefinition);
  const allCards = flattenContextDefinitionCards(allConcepts);
  const usedKeys = new Set(existingChoices.map((choice) => normalizeTextKey(choice.text)));
  const conceptById = new Map(allConcepts.map((concept) => [concept.id, concept]));

  const candidates = collectDistractorCandidates(
    targetConcept,
    targetCard,
    allCards,
    allContextCards,
    allConcepts,
    usedKeys
  ).filter((candidate) => candidate.sourceStrategy === strategy);

  const needed = existingChoices.filter((choice) => !choice.isCorrect).length;
  return candidates.slice(0, needed).map((candidate) => {
    const sourceConcept = conceptById.get(candidate.conceptId);
    return {
      id: createChoiceId(),
      conceptId: candidate.conceptId,
      contextDefinitionId: candidate.contextDefinitionId,
      text: candidate.explanation,
      displayText: buildMaskedDisplayText(candidate.explanation, [
        targetConcept.title,
        sourceConcept?.title ?? ""
      ]),
      isCorrect: false,
      sourceStrategy: candidate.sourceStrategy
    };
  });
}
