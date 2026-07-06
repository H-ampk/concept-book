import type { Concept } from "../types/concept";
import type { QuizChoice } from "../types/quiz";
import { normalizeConceptTitle } from "./normalizeConceptTitle";

export type QuizConceptDefinitionStatus = "ok" | "no-concept" | "no-definition";

export type QuizConceptDefinition = {
  conceptId?: string;
  conceptName: string;
  definition?: string;
  status: QuizConceptDefinitionStatus;
};

type ChoiceConceptRef = Pick<QuizChoice, "linkedConceptId" | "sourceConceptId" | "text"> & {
  /** 選択肢に保存されている由来概念名（将来拡張用） */
  sourceConceptName?: string;
};

/** 選択肢から対応する概念カードを特定する */
export function findConceptForQuizChoice(
  choice: ChoiceConceptRef,
  concepts: Concept[],
  fallbackConceptName?: string
): Concept | undefined {
  const linkedId = choice.linkedConceptId?.trim();
  if (linkedId) {
    const byLinked = concepts.find((concept) => concept.id === linkedId);
    if (byLinked) {
      return byLinked;
    }
  }

  const sourceId = choice.sourceConceptId?.trim();
  if (sourceId) {
    const bySource = concepts.find((concept) => concept.id === sourceId);
    if (bySource) {
      return bySource;
    }
  }

  const nameCandidates = [choice.text, choice.sourceConceptName, fallbackConceptName].filter(
    (name): name is string => Boolean(name?.trim())
  );
  for (const name of nameCandidates) {
    const key = normalizeConceptTitle(name);
    if (!key) {
      continue;
    }
    const matches = concepts.filter(
      (concept) => normalizeConceptTitle(concept.title) === key
    );
    if (matches.length === 1) {
      return matches[0];
    }
  }

  return undefined;
}

/** 選択肢に対応する概念カードの通常定義（definition）を返す */
export function resolveQuizConceptDefinition(
  choice: ChoiceConceptRef,
  concepts: Concept[],
  fallbackConceptName?: string
): QuizConceptDefinition {
  const concept = findConceptForQuizChoice(choice, concepts, fallbackConceptName);

  if (!concept) {
    return {
      conceptName: fallbackConceptName?.trim() || "—",
      status: "no-concept"
    };
  }

  const definition = concept.definition.trim();
  if (!definition) {
    return {
      conceptId: concept.id,
      conceptName: concept.title,
      status: "no-definition"
    };
  }

  return {
    conceptId: concept.id,
    conceptName: concept.title,
    definition,
    status: "ok"
  };
}
