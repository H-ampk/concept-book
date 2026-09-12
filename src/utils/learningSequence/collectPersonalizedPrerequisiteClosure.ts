import type {
  CollectPersonalizedPrerequisiteClosureInput,
  PersonalizedPrerequisiteClosure
} from "./types";

/**
 * target から prerequisite を逆方向へ辿り、satisfied branch を boundary で止める。
 * BKT / ConceptMastery は知らず、`isSatisfiedConcept` だけを見る。
 *
 * visited は active として展開した Concept だけ。satisfied boundary の祖先を
 * visited にしないので、別 branch の shared ancestor を探索できる。
 *
 * depth は active 経路上の最短距離（fallback）。#120 の full depth がある場合は
 * adapter 側で上書きする。
 */
export const collectPersonalizedPrerequisiteClosure = (
  input: CollectPersonalizedPrerequisiteClosureInput
): PersonalizedPrerequisiteClosure | null => {
  const { prerequisiteIndex, targetConceptId, isSatisfiedConcept } = input;
  if (!prerequisiteIndex.conceptById.has(targetConceptId)) {
    return null;
  }

  const activeConceptIds = new Set<string>([targetConceptId]);
  const satisfiedBoundaryConceptIds = new Set<string>();
  const depthByConceptId = new Map<string, number>([[targetConceptId, 0]]);
  const expandedActiveConceptIds = new Set<string>([targetConceptId]);
  const queue = [targetConceptId];

  for (let index = 0; index < queue.length; index += 1) {
    const dependentId = queue[index];
    const currentDepth = depthByConceptId.get(dependentId) ?? 0;
    const prerequisites = prerequisiteIndex.prerequisitesByConceptId.get(dependentId);
    if (!prerequisites) {
      continue;
    }

    for (const prerequisiteId of prerequisites) {
      if (isSatisfiedConcept(prerequisiteId)) {
        satisfiedBoundaryConceptIds.add(prerequisiteId);
        continue;
      }

      activeConceptIds.add(prerequisiteId);
      const nextDepth = currentDepth + 1;
      const existingDepth = depthByConceptId.get(prerequisiteId);
      if (existingDepth === undefined || nextDepth < existingDepth) {
        depthByConceptId.set(prerequisiteId, nextDepth);
      }

      if (!expandedActiveConceptIds.has(prerequisiteId)) {
        expandedActiveConceptIds.add(prerequisiteId);
        queue.push(prerequisiteId);
      }
    }
  }

  return {
    activeConceptIds,
    satisfiedBoundaryConceptIds,
    depthByConceptId
  };
};
