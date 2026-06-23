import type { QuizQuestion, QuizQuestionSource } from "../types/quiz";
import { normalizeConceptTitle } from "./normalizeConceptTitle";

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
    if (!question.source) {
      continue;
    }
    const { answerConceptId, normalizedAnswerTitle } = resolveQuestionAnswerKey(question);
    keys.add(
      buildQuizQuestionDuplicateKey(question.source, answerConceptId, normalizedAnswerTitle)
    );
  }
  return keys;
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
