import { compareLearningSequenceCandidates } from "./compareLearningSequenceCandidates";
import type {
  ConceptLearningSequenceItem,
  ConceptLearningSequenceOrderResult,
  OrderConceptLearningClosureInput
} from "./types";

const takeBestCandidate = (
  candidates: string[],
  depthByConceptId: ReadonlyMap<string, number>,
  orderById: ReadonlyMap<string, number>
): string => {
  let bestIndex = 0;
  for (let index = 1; index < candidates.length; index += 1) {
    const candidateId = candidates[index];
    const bestId = candidates[bestIndex];
    const comparison = compareLearningSequenceCandidates(
      {
        conceptId: candidateId,
        prerequisiteDepth: depthByConceptId.get(candidateId) ?? 0
      },
      {
        conceptId: bestId,
        prerequisiteDepth: depthByConceptId.get(bestId) ?? 0
      },
      orderById
    );
    if (comparison < 0) {
      bestIndex = index;
    }
  }

  const bestId = candidates[bestIndex];
  candidates[bestIndex] = candidates[candidates.length - 1];
  candidates.pop();
  return bestId;
};

/**
 * 与えられた closure の induced DAG を Kahn 法で決定的に順序付ける。
 * #121 は pruning 済み includedConceptIds をここに渡して再利用できる。
 * depth は再計算せず、渡された depthByConceptId を tie-break にだけ使う。
 */
export const orderConceptLearningClosure = (
  input: OrderConceptLearningClosureInput
): ConceptLearningSequenceOrderResult => {
  const { prerequisiteIndex, includedConceptIds, depthByConceptId, targetConceptId } = input;
  const includedSize = includedConceptIds.size;
  const indegree = new Map<string, number>();
  const dependentsByPrerequisite = new Map<string, string[]>();

  for (const conceptId of includedConceptIds) {
    indegree.set(conceptId, 0);
    dependentsByPrerequisite.set(conceptId, []);
  }

  for (const dependentId of includedConceptIds) {
    const prerequisites = prerequisiteIndex.prerequisitesByConceptId.get(dependentId);
    if (!prerequisites) {
      continue;
    }
    for (const prerequisiteId of prerequisites) {
      if (!includedConceptIds.has(prerequisiteId)) {
        continue;
      }
      indegree.set(dependentId, (indegree.get(dependentId) ?? 0) + 1);
      dependentsByPrerequisite.get(prerequisiteId)?.push(dependentId);
    }
  }

  const candidates: string[] = [];
  for (const conceptId of includedConceptIds) {
    if ((indegree.get(conceptId) ?? 0) === 0) {
      candidates.push(conceptId);
    }
  }

  const orderedIds: string[] = [];
  while (candidates.length > 0) {
    const conceptId = takeBestCandidate(candidates, depthByConceptId, prerequisiteIndex.orderById);
    orderedIds.push(conceptId);
    const dependents = dependentsByPrerequisite.get(conceptId);
    if (!dependents) {
      continue;
    }
    for (const dependentId of dependents) {
      const nextIndegree = (indegree.get(dependentId) ?? 0) - 1;
      indegree.set(dependentId, nextIndegree);
      if (nextIndegree === 0) {
        candidates.push(dependentId);
      }
    }
  }

  if (orderedIds.length < includedSize) {
    return {
      status: "cycle-detected",
      targetConceptId,
      items: []
    };
  }

  const items: ConceptLearningSequenceItem[] = orderedIds.map((conceptId) => ({
    conceptId,
    prerequisiteDepth: depthByConceptId.get(conceptId) ?? 0,
    isTarget: conceptId === targetConceptId
  }));

  return {
    status: "ok",
    targetConceptId,
    items
  };
};
