import type { Concept } from "../types/concept";
import type { QuizQuestion, QuizQuestionSource } from "../types/quiz";
import { normalizeConceptTitle } from "./normalizeConceptTitle";

const GENERATED_QUESTION_SOURCE_TYPES = new Set<QuizQuestionSource["type"]>([
  "contextualConceptCard",
  "contextCard",
  "conceptGeneral"
]);

export function buildConceptGeneralSource(
  concept: Pick<Concept, "id" | "title">,
  fieldName?: string
): QuizQuestionSource {
  const trimmedFieldName = fieldName?.trim();
  return {
    type: "conceptGeneral",
    sourceId: concept.id,
    sourceTitle: concept.title,
    ...(trimmedFieldName ? { fieldName: trimmedFieldName } : {})
  };
}

export function isLegacyConceptGeneralQuestion(question: QuizQuestion): boolean {
  if (question.source) {
    return false;
  }
  const conceptId = question.conceptId?.trim();
  if (!conceptId) {
    return false;
  }
  const expectedContextDefinitionId = `general_${conceptId}`;
  return question.choices.some((choice) => {
    if (choice.contextDefinitionId !== expectedContextDefinitionId) {
      return false;
    }
    const sourceConceptId = choice.sourceConceptId?.trim();
    if (sourceConceptId && sourceConceptId !== conceptId) {
      return false;
    }
    const linkedConceptId = choice.linkedConceptId?.trim();
    if (linkedConceptId && linkedConceptId !== conceptId) {
      return false;
    }
    const isCorrect = choice.id === question.correctChoiceId;
    const fromAnswerConcept = sourceConceptId === conceptId || linkedConceptId === conceptId;
    return isCorrect || fromAnswerConcept;
  });
}

/** 文脈別カードの sourceId（conceptId:contextDefinitionId） */
export function buildContextualCardSourceId(conceptId: string, contextDefinitionId: string): string {
  return `${conceptId}:${contextDefinitionId}`;
}

export function parseContextualCardSourceId(
  sourceId: string
): { conceptId: string; contextDefinitionId: string } | null {
  const idx = sourceId.indexOf(":");
  if (idx <= 0 || idx >= sourceId.length - 1) {
    return null;
  }
  return {
    conceptId: sourceId.slice(0, idx),
    contextDefinitionId: sourceId.slice(idx + 1)
  };
}

export function buildQuizQuestionDuplicateKey(
  source: QuizQuestionSource,
  answerConceptId?: string,
  normalizedAnswerTitle?: string
): string {
  const answerKey = answerConceptId?.trim() || normalizedAnswerTitle?.trim() || "";
  return [source.type, source.sourceId, answerKey].join(":");
}

export function resolveQuestionAnswerKey(question: QuizQuestion): {
  answerConceptId?: string;
  normalizedAnswerTitle: string;
} {
  const correctChoice = question.choices.find((c) => c.id === question.correctChoiceId);
  const answerConceptId = question.conceptId ?? correctChoice?.linkedConceptId;
  const normalizedAnswerTitle = correctChoice
    ? normalizeConceptTitle(correctChoice.text)
    : "";
  return { answerConceptId, normalizedAnswerTitle };
}

export function collectExistingDuplicateKeys(questions: QuizQuestion[]): Set<string> {
  const keys = new Set<string>();
  for (const question of questions) {
    const { answerConceptId, normalizedAnswerTitle } = resolveQuestionAnswerKey(question);
    if (question.source) {
      keys.add(
        buildQuizQuestionDuplicateKey(question.source, answerConceptId, normalizedAnswerTitle)
      );
      continue;
    }
    if (!isLegacyConceptGeneralQuestion(question) || !question.conceptId) {
      continue;
    }
    keys.add(
      buildQuizQuestionDuplicateKey(
        {
          type: "conceptGeneral",
          sourceId: question.conceptId,
          sourceTitle: ""
        },
        answerConceptId,
        normalizedAnswerTitle
      )
    );
  }
  return keys;
}

export function collectExistingGeneratedQuestionConceptIds(questions: QuizQuestion[]): Set<string> {
  const ids = new Set<string>();
  for (const question of questions) {
    const conceptId = question.conceptId?.trim();
    if (question.source && GENERATED_QUESTION_SOURCE_TYPES.has(question.source.type)) {
      if (conceptId) {
        ids.add(conceptId);
        continue;
      }
      const { answerConceptId } = resolveQuestionAnswerKey(question);
      if (answerConceptId) {
        ids.add(answerConceptId);
      }
      continue;
    }
    if (isLegacyConceptGeneralQuestion(question) && conceptId) {
      ids.add(conceptId);
    }
  }
  return ids;
}

export function isDuplicateQuizQuestion(
  source: QuizQuestionSource,
  answerConceptId: string | undefined,
  normalizedAnswerTitle: string,
  existingKeys: Set<string>
): boolean {
  return existingKeys.has(
    buildQuizQuestionDuplicateKey(source, answerConceptId, normalizedAnswerTitle)
  );
}
