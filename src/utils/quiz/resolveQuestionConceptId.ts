import type { QuizQuestion } from "../../types/quiz";

/** 現在存在する Concept への帰属を解決する（historical log には使わない） */
export function resolveQuestionConceptId(
  question: QuizQuestion,
  validConceptIds: ReadonlySet<string>
): string | undefined {
  const direct = question.conceptId?.trim();
  if (direct && validConceptIds.has(direct)) {
    return direct;
  }
  const correct = question.choices.find((c) => c.id === question.correctChoiceId);
  const fromChoice = correct?.sourceConceptId?.trim();
  if (fromChoice && validConceptIds.has(fromChoice)) {
    return fromChoice;
  }
  return undefined;
}
