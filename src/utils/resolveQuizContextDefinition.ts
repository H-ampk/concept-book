import type { Concept } from "../types/concept";
import type { QuizChoice, QuizQuestionSource } from "../types/quiz";
import { maskConceptNameInText } from "./maskConceptNameInText";
import { normalizeConceptTitle } from "./normalizeConceptTitle";
import { parseContextualCardSourceId } from "./quizQuestionSource";
import { findConceptForQuizChoice } from "./resolveQuizConceptDefinition";

export type QuizContextDefinitionStatus = "ok" | "no-concept" | "no-context-definition";

export type QuizContextDefinition = {
  conceptId?: string;
  conceptName: string;
  /** 文脈別定義本文（マスク前） */
  definition?: string;
  /** 表示用（概念名マスク済み） */
  maskedDefinition?: string;
  status: QuizContextDefinitionStatus;
};

function pickContextDefinitionBySource(
  concept: Concept,
  source?: QuizQuestionSource
): string | null {
  const definitions = (concept.contextDefinitions ?? []).filter(
    (item) => item.definition.trim().length > 0
  );
  if (definitions.length === 0) {
    return null;
  }

  if (source?.type === "contextualConceptCard") {
    const parsed = parseContextualCardSourceId(source.sourceId);
    if (parsed && parsed.conceptId === concept.id) {
      const matched = definitions.find((item) => item.id === parsed.contextDefinitionId);
      if (matched) {
        return matched.definition.trim();
      }
    }
  }

  if (source?.type === "contextCard") {
    const hints = [source.fieldName, source.sourceTitle]
      .map((hint) => (hint ? normalizeConceptTitle(hint) : ""))
      .filter(Boolean);
    if (hints.length > 0) {
      const matched = definitions.find((item) =>
        hints.includes(normalizeConceptTitle(item.context))
      );
      if (matched) {
        return matched.definition.trim();
      }
    }
  }

  return definitions[0].definition.trim();
}

/** 選択肢に対応する文脈別定義を解決する */
export function resolveQuizContextDefinition(
  choice: Pick<
    QuizChoice,
    "text" | "displayText" | "linkedConceptId" | "sourceConceptId" | "contextDefinitionId"
  >,
  concepts: Concept[],
  fallbackConceptName?: string,
  source?: QuizQuestionSource
): QuizContextDefinition {
  const concept = findConceptForQuizChoice(choice, concepts, fallbackConceptName);

  if (!concept) {
    return {
      conceptName: fallbackConceptName?.trim() || "—",
      status: "no-concept"
    };
  }

  let rawDefinition: string | undefined;

  if (choice.contextDefinitionId) {
    const matched = (concept.contextDefinitions ?? []).find(
      (item) => item.id === choice.contextDefinitionId
    );
    if (matched?.definition.trim()) {
      rawDefinition = matched.definition.trim();
    }
  }

  if (!rawDefinition) {
    rawDefinition = pickContextDefinitionBySource(concept, source) ?? undefined;
  }

  // text が用語名だけの旧形式でない場合、保存済み本文をフォールバックに使う
  if (!rawDefinition) {
    const textRaw = choice.text.trim();
    if (
      textRaw &&
      normalizeConceptTitle(textRaw) !== normalizeConceptTitle(concept.title)
    ) {
      rawDefinition = textRaw;
    }
  }

  if (!rawDefinition) {
    return {
      conceptId: concept.id,
      conceptName: concept.title,
      status: "no-context-definition"
    };
  }

  const maskedDefinition =
    choice.displayText?.trim() ||
    maskConceptNameInText(rawDefinition, [concept.title]);

  return {
    conceptId: concept.id,
    conceptName: concept.title,
    definition: rawDefinition,
    maskedDefinition,
    status: "ok"
  };
}
