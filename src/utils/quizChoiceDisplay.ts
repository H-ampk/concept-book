import type { Concept } from "../types/concept";
import type { QuizChoice, QuizQuestion } from "../types/quiz";
import { maskConceptNameInText } from "./maskConceptNameInText";

export function collectMaskConceptNames(
  question: QuizQuestion,
  concepts: Concept[]
): string[] {
  const names = new Set<string>();
  const byId = new Map(concepts.map((concept) => [concept.id, concept]));

  if (question.conceptId) {
    const title = byId.get(question.conceptId)?.title?.trim();
    if (title) {
      names.add(title);
    }
  }

  for (const choice of question.choices) {
    if (choice.sourceConceptId) {
      const title = byId.get(choice.sourceConceptId)?.title?.trim();
      if (title) {
        names.add(title);
      }
    }
    if (choice.linkedConceptId) {
      const title = byId.get(choice.linkedConceptId)?.title?.trim();
      if (title) {
        names.add(title);
      }
    }
  }

  return Array.from(names);
}

export function getQuizChoiceDisplayText(
  choice: QuizChoice,
  maskNames: string[],
  options?: { revealOriginal?: boolean }
): string {
  if (options?.revealOriginal) {
    return choice.text;
  }
  if (choice.displayText?.trim()) {
    return choice.displayText;
  }
  return maskConceptNameInText(choice.text, maskNames);
}
