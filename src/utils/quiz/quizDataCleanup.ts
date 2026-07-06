import type { QuizDeck, QuizQuestion } from "../../types/quiz";

/** いずれかのクイズ集 questionIds に含まれる問題 ID 集合 */
export function collectReferencedQuestionIds(decks: QuizDeck[]): Set<string> {
  const ids = new Set<string>();
  for (const deck of decks) {
    for (const questionId of deck.questionIds) {
      const trimmed = questionId.trim();
      if (trimmed) {
        ids.add(trimmed);
      }
    }
  }
  return ids;
}

/** どのクイズ集にも参照されていない問題 ID */
export function findOrphanQuestionIds(
  questions: QuizQuestion[],
  decks: QuizDeck[]
): string[] {
  const referenced = collectReferencedQuestionIds(decks);
  return questions.filter((question) => !referenced.has(question.id)).map((question) => question.id);
}

/** 指定クイズ集にのみ属し、他クイズ集では参照されていない問題 ID */
export function findExclusiveQuestionIds(deck: QuizDeck, otherDecks: QuizDeck[]): string[] {
  const otherIds = collectReferencedQuestionIds(otherDecks);
  return deck.questionIds.filter((questionId) => {
    const trimmed = questionId.trim();
    return trimmed.length > 0 && !otherIds.has(trimmed);
  });
}

export type QuizDataSummary = {
  deckCount: number;
  questionCount: number;
  referencedQuestionCount: number;
  orphanQuestionCount: number;
  attemptLogCount: number;
};

export function buildQuizDataSummary(input: {
  decks: QuizDeck[];
  questions: QuizQuestion[];
  attemptLogCount: number;
}): QuizDataSummary {
  const referenced = collectReferencedQuestionIds(input.decks);
  const orphanQuestionCount = input.questions.filter((q) => !referenced.has(q.id)).length;
  return {
    deckCount: input.decks.length,
    questionCount: input.questions.length,
    referencedQuestionCount: referenced.size,
    orphanQuestionCount,
    attemptLogCount: input.attemptLogCount
  };
}
