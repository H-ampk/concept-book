import type { Concept } from "../types/concept";
import type { ContextCard } from "../types/contextCard";
import type {
  QuizDeckGenerationSummary,
  QuizGenerationQuality,
  QuizQuestion,
  QuizQuestionSource
} from "../types/quiz";
import { QUIZ_QUESTION_SCHEMA_VERSION } from "../types/quiz";
import { deriveConceptStatus } from "./conceptStatus";
import { nowIso } from "./date";
import { generateQuizChoicesFromConceptGeneral } from "./generateQuizChoicesFromConceptGeneral";
import { generateQuizChoicesFromContextCards } from "./generateQuizChoicesFromContextCards";
import type { QuizGenerationResult } from "./generateQuizChoicesFromContextCards";
import {
  buildContextualCardSourceId,
  buildQuizQuestionDuplicateKey,
  collectExistingDuplicateKeys,
  isDuplicateQuizQuestion,
  resolveQuestionAnswerKey
} from "./quizQuestionSource";
import { normalizeConceptTitle } from "./normalizeConceptTitle";

export type QuizSetGenerationMode = "context-definition" | "concept-general" | "auto";

export type GenerateQuizSetInput = {
  quizSetTitle: string;
  targetDomainTag: string;
  includeDraftConcepts?: boolean;
  generationMode?: QuizSetGenerationMode;
  questionLimit?: number | "all";
  allConcepts: Concept[];
  allContextCards: ContextCard[];
  existingQuestions?: QuizQuestion[];
};

export type GeneratedQuizQuestionDraft = {
  question: QuizQuestion;
  conceptId: string;
  conceptTitle: string;
  modeUsed: "context-definition" | "concept-general";
  warnings: string[];
  quality: QuizGenerationQuality;
};

export type FailedConceptEntry = {
  conceptId: string;
  conceptTitle: string;
  reason: string;
};

export type QuizSetGenerationPreview = {
  quizSetTitle: string;
  targetDomainTag: string;
  questions: GeneratedQuizQuestionDraft[];
  failedConcepts: FailedConceptEntry[];
  summary: QuizDeckGenerationSummary;
};

const createQuizQuestionId = (): string =>
  `quiz_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

const hasContextDefinitions = (concept: Concept): boolean =>
  (concept.contextDefinitions ?? []).some((item) => item.definition.trim().length > 0);

const hasGeneralDefinition = (concept: Concept): boolean => concept.definition.trim().length > 0;

export function selectConceptsForDomainTag(
  concepts: Concept[],
  targetDomainTag: string,
  includeDraftConcepts: boolean
): Concept[] {
  const tag = targetDomainTag.trim();
  if (!tag) {
    return [];
  }

  return concepts.filter((concept) => {
    if (!concept.title.trim()) {
      return false;
    }
    if (!concept.domainTags.some((domainTag) => domainTag.trim() === tag)) {
      return false;
    }
    if (!includeDraftConcepts && deriveConceptStatus(concept.definition) !== "active") {
      return false;
    }
    if (!hasContextDefinitions(concept) && !hasGeneralDefinition(concept)) {
      return false;
    }
    return true;
  });
}

function toQuizQuestion(
  concept: Concept,
  result: QuizGenerationResult,
  source?: QuizQuestionSource
): QuizQuestion | null {
  if (result.quality === "failed" || result.choices.length < 4) {
    return null;
  }

  const now = nowIso();
  return {
    id: createQuizQuestionId(),
    conceptId: concept.id,
    ...(source ? { source } : {}),
    prompt: result.prompt,
    choices: result.choices.map((choice) => ({
      id: choice.id,
      text: choice.text,
      displayText: choice.displayText,
      sourceConceptId: choice.conceptId,
      contextDefinitionId: choice.contextDefinitionId,
      sourceStrategy: choice.sourceStrategy
    })),
    correctChoiceId: result.correctChoiceId,
    visibility: "private",
    schemaVersion: QUIZ_QUESTION_SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now
  };
}

function generateFromContextDefinition(
  concept: Concept,
  allConcepts: Concept[],
  allContextCards: ContextCard[]
): { result: QuizGenerationResult; modeUsed: "context-definition"; contextDefinitionId: string } | null {
  const contextDefinition = (concept.contextDefinitions ?? []).find(
    (item) => item.definition.trim().length > 0
  );
  if (!contextDefinition) {
    return null;
  }
  return {
    result: generateQuizChoicesFromContextCards({
      targetConcept: concept,
      targetContextDefinition: contextDefinition,
      allConcepts,
      allContextCards
    }),
    modeUsed: "context-definition",
    contextDefinitionId: contextDefinition.id
  };
}

function buildContextualConceptCardSource(
  concept: Concept,
  contextDefinitionId: string,
  fieldName?: string
): QuizQuestionSource {
  const contextDef = (concept.contextDefinitions ?? []).find((d) => d.id === contextDefinitionId);
  return {
    type: "contextualConceptCard",
    sourceId: buildContextualCardSourceId(concept.id, contextDefinitionId),
    sourceTitle: concept.title,
    fieldName: fieldName ?? (contextDef?.context.trim() || concept.domainTags[0]?.trim())
  };
}

function generateFromConceptGeneral(
  concept: Concept,
  allConcepts: Concept[],
  allContextCards: ContextCard[]
): { result: QuizGenerationResult; modeUsed: "concept-general" } {
  return {
    result: generateQuizChoicesFromConceptGeneral({
      targetConcept: concept,
      allConcepts,
      allContextCards
    }),
    modeUsed: "concept-general"
  };
}

export function generateForConcept(
  concept: Concept,
  generationMode: QuizSetGenerationMode,
  allConcepts: Concept[],
  allContextCards: ContextCard[],
  existingDuplicateKeys?: Set<string>
):
  | {
      question: QuizQuestion;
      modeUsed: "context-definition" | "concept-general";
      warnings: string[];
      quality: QuizGenerationQuality;
    }
  | { failed: true; reason: string } {
  if (generationMode === "context-definition") {
    const generated = generateFromContextDefinition(concept, allConcepts, allContextCards);
    if (!generated) {
      return { failed: true, reason: "文脈別定義がないため、この概念から問題を生成できませんでした。" };
    }
    const source = buildContextualConceptCardSource(concept, generated.contextDefinitionId);
    if (
      existingDuplicateKeys &&
      isDuplicateQuizQuestion(
        source,
        concept.id,
        normalizeConceptTitle(concept.title),
        existingDuplicateKeys
      )
    ) {
      return { failed: true, reason: "この文脈別カードから作成できる新しいクイズはありません。" };
    }
    const question = toQuizQuestion(concept, generated.result, source);
    if (!question) {
      return {
        failed: true,
        reason: generated.result.warnings[0] ?? "選択肢が不足しているため、この概念から問題を生成できませんでした。"
      };
    }
    return {
      question,
      modeUsed: generated.modeUsed,
      warnings: generated.result.warnings,
      quality: generated.result.quality
    };
  }

  if (generationMode === "concept-general") {
    const generated = generateFromConceptGeneral(concept, allConcepts, allContextCards);
    const question = toQuizQuestion(concept, generated.result);
    if (!question) {
      return {
        failed: true,
        reason: generated.result.warnings[0] ?? "定義が空のため、この概念から問題を生成できませんでした。"
      };
    }
    return {
      question,
      modeUsed: generated.modeUsed,
      warnings: generated.result.warnings,
      quality: generated.result.quality
    };
  }

  const contextGenerated = generateFromContextDefinition(concept, allConcepts, allContextCards);
  if (contextGenerated) {
    const source = buildContextualConceptCardSource(concept, contextGenerated.contextDefinitionId);
    const isDuplicate =
      existingDuplicateKeys &&
      isDuplicateQuizQuestion(
        source,
        concept.id,
        normalizeConceptTitle(concept.title),
        existingDuplicateKeys
      );
    if (!isDuplicate) {
      const question = toQuizQuestion(concept, contextGenerated.result, source);
      if (question) {
        return {
          question,
          modeUsed: contextGenerated.modeUsed,
          warnings: contextGenerated.result.warnings,
          quality: contextGenerated.result.quality
        };
      }
    }
  }

  if (!hasGeneralDefinition(concept)) {
    return {
      failed: true,
      reason: "定義が空のため、この概念から問題を生成できませんでした。"
    };
  }

  const generalGenerated = generateFromConceptGeneral(concept, allConcepts, allContextCards);
  const question = toQuizQuestion(concept, generalGenerated.result);
  if (!question) {
    return {
      failed: true,
      reason:
        generalGenerated.result.warnings[0] ??
        "選択肢が不足しているため、この概念から問題を生成できませんでした。"
    };
  }

  return {
    question,
    modeUsed: generalGenerated.modeUsed,
    warnings: [
      "文脈別定義が不足しているため、概念一般モードで生成しました。",
      ...generalGenerated.result.warnings
    ],
    quality: generalGenerated.result.quality
  };
}

export function generateQuizSetFromDomainTag(
  input: GenerateQuizSetInput
): QuizSetGenerationPreview {
  const {
    quizSetTitle,
    targetDomainTag,
    includeDraftConcepts = false,
    generationMode = "auto",
    questionLimit = "all",
    allConcepts,
    allContextCards,
    existingQuestions = []
  } = input;

  const existingDuplicateKeys = collectExistingDuplicateKeys(existingQuestions);

  const targetConcepts = selectConceptsForDomainTag(
    allConcepts,
    targetDomainTag,
    includeDraftConcepts
  );

  const questions: GeneratedQuizQuestionDraft[] = [];
  const failedConcepts: FailedConceptEntry[] = [];
  let warningCount = 0;

  for (const concept of targetConcepts) {
    if (questionLimit !== "all" && questions.length >= questionLimit) {
      break;
    }

    const outcome = generateForConcept(
      concept,
      generationMode,
      allConcepts,
      allContextCards,
      existingDuplicateKeys
    );

    if ("failed" in outcome) {
      failedConcepts.push({
        conceptId: concept.id,
        conceptTitle: concept.title,
        reason: outcome.reason
      });
      continue;
    }

    if (outcome.warnings.length > 0) {
      warningCount += 1;
    }

    if (outcome.question.source) {
      const { answerConceptId, normalizedAnswerTitle } = resolveQuestionAnswerKey(outcome.question);
      existingDuplicateKeys.add(
        buildQuizQuestionDuplicateKey(
          outcome.question.source,
          answerConceptId,
          normalizedAnswerTitle
        )
      );
    }

    questions.push({
      question: outcome.question,
      conceptId: concept.id,
      conceptTitle: concept.title,
      modeUsed: outcome.modeUsed,
      warnings: outcome.warnings,
      quality: outcome.quality
    });
  }

  return {
    quizSetTitle: quizSetTitle.trim(),
    targetDomainTag: targetDomainTag.trim(),
    questions,
    failedConcepts,
    summary: {
      targetConceptCount: targetConcepts.length,
      generatedQuestionCount: questions.length,
      warningCount,
      failedCount: failedConcepts.length
    }
  };
}

export function generateQuizFromSingleContextualCard(input: {
  conceptId: string;
  contextDefinitionId: string;
  allConcepts: Concept[];
  allContextCards: ContextCard[];
  existingQuestions: QuizQuestion[];
}): GeneratedQuizQuestionDraft | { failed: true; reason: string } {
  const { conceptId, contextDefinitionId, allConcepts, allContextCards, existingQuestions } = input;
  const concept = allConcepts.find((c) => c.id === conceptId);
  if (!concept) {
    return { failed: true, reason: "概念が見つかりません。" };
  }

  const contextDefinition = (concept.contextDefinitions ?? []).find(
    (d) => d.id === contextDefinitionId
  );
  if (!contextDefinition || !contextDefinition.definition.trim()) {
    return { failed: true, reason: "文脈別定義が見つからないか、定義が空です。" };
  }

  const source = buildContextualConceptCardSource(concept, contextDefinitionId);
  const { answerConceptId, normalizedAnswerTitle } = {
    answerConceptId: concept.id,
    normalizedAnswerTitle: normalizeConceptTitle(concept.title)
  };
  const existingKeys = collectExistingDuplicateKeys(existingQuestions);
  if (isDuplicateQuizQuestion(source, answerConceptId, normalizedAnswerTitle, existingKeys)) {
    return { failed: true, reason: "この文脈別カードから作成できる新しいクイズはありません。" };
  }

  const result = generateQuizChoicesFromContextCards({
    targetConcept: concept,
    targetContextDefinition: contextDefinition,
    allConcepts,
    allContextCards
  });

  const question = toQuizQuestion(concept, result, source);
  if (!question) {
    return {
      failed: true,
      reason: result.warnings[0] ?? "選択肢が不足しているため、問題を生成できませんでした。"
    };
  }

  return {
    question,
    conceptId: concept.id,
    conceptTitle: concept.title,
    modeUsed: "context-definition",
    warnings: result.warnings,
    quality: result.quality
  };
}
