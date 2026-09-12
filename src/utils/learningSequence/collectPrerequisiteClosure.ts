import type { ConceptPrerequisiteIndex } from "../conceptPrerequisites";
import type { PrerequisiteClosure } from "./types";

/**
 * target から prerequisitesByConceptId を逆方向へ BFS し、
 * target 自身を含む prerequisite closure と最短 prerequisiteDepth を返す。
 *
 * depth(target) = 0、直接の前提 = 1、その前 = 2 …。
 * 非重み付きなので最初に到達した depth が最短。visited / depth map で cycle でも停止する。
 * target が index に無い場合は null。
 */
export const collectPrerequisiteClosure = (
  prerequisiteIndex: ConceptPrerequisiteIndex,
  targetConceptId: string
): PrerequisiteClosure | null => {
  if (!prerequisiteIndex.conceptById.has(targetConceptId)) {
    return null;
  }

  const depthByConceptId = new Map<string, number>();
  const queue = [targetConceptId];
  depthByConceptId.set(targetConceptId, 0);

  for (let index = 0; index < queue.length; index += 1) {
    const currentId = queue[index];
    const currentDepth = depthByConceptId.get(currentId) ?? 0;
    const nextDepth = currentDepth + 1;
    const prerequisites = prerequisiteIndex.prerequisitesByConceptId.get(currentId);
    if (!prerequisites) {
      continue;
    }
    for (const prerequisiteId of prerequisites) {
      if (depthByConceptId.has(prerequisiteId)) {
        continue;
      }
      depthByConceptId.set(prerequisiteId, nextDepth);
      queue.push(prerequisiteId);
    }
  }

  return {
    conceptIds: new Set(depthByConceptId.keys()),
    depthByConceptId
  };
};
