import type { QuizQuestion, QuizSessionFilter } from "../../types/quiz";

/**
 * 出題プールをフィルタする。
 * contextCardId / contextualCardId 指定時は source が一致する問題のみ。
 * source がない古い問題は、全体出題・分野別（fieldTag のみ）では従来通り含める。
 */
export function filterQuizPool(pool: QuizQuestion[], filter?: QuizSessionFilter): QuizQuestion[] {
  if (!filter) {
    return pool;
  }

  const contextCardId = filter.contextCardId?.trim();
  const contextualCardId = filter.contextualCardId?.trim();
  const fieldTag = filter.fieldTag?.trim();
  const sourceType = filter.sourceType;

  if (contextCardId) {
    return pool.filter(
      (q) => q.source?.type === "contextCard" && q.source.sourceId === contextCardId
    );
  }

  if (contextualCardId) {
    return pool.filter(
      (q) =>
        q.source?.type === "contextualConceptCard" && q.source.sourceId === contextualCardId
    );
  }

  return pool.filter((q) => matchesQuizSessionFilter(q, { fieldTag, sourceType }));
}

export function matchesQuizSessionFilter(q: QuizQuestion, filter: QuizSessionFilter): boolean {
  const fieldTag = filter.fieldTag?.trim();
  const sourceType = filter.sourceType;

  if (sourceType && q.source && q.source.type !== sourceType) {
    return false;
  }

  if (fieldTag) {
    if (q.source?.fieldName?.trim() === fieldTag) {
      return true;
    }
    if (!q.source) {
      return true;
    }
    return false;
  }

  return true;
}
