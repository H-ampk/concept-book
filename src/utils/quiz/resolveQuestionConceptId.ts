import type { QuizQuestion } from "../../types/quiz";

/** 問題に紐づく概念 ID（conceptId 優先、なければ正解選択肢の sourceConceptId） */
export function resolveQuestionConceptId(question: QuizQuestion): string | undefined {
  const direct = question.conceptId?.trim();
  if (direct) {
    return direct;
  }
  const correct = question.choices.find((c) => c.id === question.correctChoiceId);
  const fromChoice = correct?.sourceConceptId?.trim();
  return fromChoice || undefined;
}
