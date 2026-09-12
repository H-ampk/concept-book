import { collectPrerequisiteClosure } from "./collectPrerequisiteClosure";
import { orderConceptLearningClosure } from "./orderConceptLearningClosure";
import type {
  BuildConceptLearningSequenceInput,
  ConceptLearningSequenceResult
} from "./types";

/**
 * target の完全 prerequisite closure を集め、決定的な学習順序を返す。
 * mastery による pruning は行わない（#121 の責務）。
 */
export const buildConceptLearningSequence = (
  input: BuildConceptLearningSequenceInput
): ConceptLearningSequenceResult => {
  const { targetConceptId, prerequisiteIndex } = input;
  const closure = collectPrerequisiteClosure(prerequisiteIndex, targetConceptId);
  if (!closure) {
    return {
      status: "target-not-found",
      targetConceptId,
      items: []
    };
  }

  return orderConceptLearningClosure({
    prerequisiteIndex,
    includedConceptIds: closure.conceptIds,
    depthByConceptId: closure.depthByConceptId,
    targetConceptId
  });
};
