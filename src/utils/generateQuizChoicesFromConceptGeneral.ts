import type { Concept, ContextDefinition } from "../types/concept";
import type { ContextCard } from "../types/contextCard";
import {
  flattenAllDefinitionSources,
  generateQuizChoicesFromContextCards
} from "./generateQuizChoicesFromContextCards";

export function generateQuizChoicesFromConceptGeneral({
  targetConcept,
  allConcepts,
  allContextCards
}: {
  targetConcept: Concept;
  allConcepts: Concept[];
  allContextCards: ContextCard[];
}) {
  const definition = targetConcept.definition.trim();
  if (!definition) {
    return {
      prompt: "",
      choices: [],
      correctChoiceId: "",
      quality: "failed" as const,
      warnings: ["定義が空のため、この概念から問題を生成できませんでした。"]
    };
  }

  const syntheticDefinition: ContextDefinition = {
    id: `general_${targetConcept.id}`,
    context: "一般",
    definition
  };

  const result = generateQuizChoicesFromContextCards({
    targetConcept,
    targetContextDefinition: syntheticDefinition,
    allConcepts,
    allContextCards,
    distractorPool: flattenAllDefinitionSources(allConcepts)
  });

  return {
    ...result,
    prompt: `「${targetConcept.title}」の説明として正しいものはどれか。`,
    warnings: Array.from(new Set(result.warnings))
  };
}
