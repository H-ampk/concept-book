import type { Concept } from "../types/concept";
import type { QuizChoice, QuizQuestion } from "../types/quiz";
import { maskConceptNameInText } from "./maskConceptNameInText";

export type GetQuizChoiceDisplayTextParams = {
  choice: QuizChoice;
  promptConcept?: Concept;
  allConcepts: Concept[];
  revealAnswer?: boolean;
};

const collectTitlePrefixMaskCandidates = (baseText: string, allConcepts: Concept[]): string[] => {
  const names: string[] = [];
  const trimmed = baseText.trim();
  if (!trimmed) {
    return names;
  }

  for (const concept of allConcepts) {
    const title = concept.title?.trim();
    if (!title) {
      continue;
    }
    if (
      trimmed.startsWith(`${title}とは`) ||
      trimmed.startsWith(`${title}は`) ||
      trimmed.startsWith(`${title}（`) ||
      trimmed.startsWith(`${title}(`)
    ) {
      names.push(title);
    }
  }

  return names;
};

export function collectMaskNamesForChoice(
  choice: QuizChoice,
  promptConcept: Concept | undefined,
  allConcepts: Concept[],
  baseText: string
): string[] {
  const names = new Set<string>();
  const byId = new Map(allConcepts.map((concept) => [concept.id, concept]));

  const promptTitle = promptConcept?.title?.trim();
  if (promptTitle) {
    names.add(promptTitle);
  }

  const sourceConceptId = choice.sourceConceptId?.trim();
  if (sourceConceptId) {
    const title = byId.get(sourceConceptId)?.title?.trim();
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

  if (choice.contextDefinitionId) {
    for (const concept of allConcepts) {
      const hasDefinition = (concept.contextDefinitions ?? []).some(
        (item) => item.id === choice.contextDefinitionId
      );
      if (hasDefinition) {
        const title = concept.title?.trim();
        if (title) {
          names.add(title);
        }
      }
    }
  }

  for (const title of collectTitlePrefixMaskCandidates(baseText, allConcepts)) {
    names.add(title);
  }

  return Array.from(names);
}

/** @deprecated 選択肢ごとの collectMaskNamesForChoice / getQuizChoiceDisplayText を利用する */
export function collectMaskConceptNames(
  question: QuizQuestion,
  concepts: Concept[]
): string[] {
  const promptConcept = question.conceptId
    ? concepts.find((concept) => concept.id === question.conceptId)
    : undefined;
  const names = new Set<string>();

  for (const choice of question.choices) {
    const baseText = choice.displayText?.trim() || choice.text;
    for (const name of collectMaskNamesForChoice(choice, promptConcept, concepts, baseText)) {
      names.add(name);
    }
  }

  return Array.from(names);
}

export function getQuizChoiceDisplayText({
  choice,
  promptConcept,
  allConcepts,
  revealAnswer = false
}: GetQuizChoiceDisplayTextParams): string {
  if (revealAnswer) {
    return choice.text;
  }

  const baseText = choice.displayText?.trim() || choice.text;
  const namesToMask = collectMaskNamesForChoice(
    choice,
    promptConcept,
    allConcepts,
    baseText
  );

  return maskConceptNameInText(baseText, namesToMask);
}
