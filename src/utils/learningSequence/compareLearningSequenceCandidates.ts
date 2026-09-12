import type { LearningSequenceCandidateKey } from "./types";

/**
 * zero-indegree 候補の決定的 tie-break。
 * 1. prerequisiteDepth が大きい
 * 2. originalIndex が小さい
 * 3. Concept ID 昇順
 */
export const compareLearningSequenceCandidates = (
  a: LearningSequenceCandidateKey,
  b: LearningSequenceCandidateKey,
  orderById: ReadonlyMap<string, number>
): number => {
  if (a.prerequisiteDepth !== b.prerequisiteDepth) {
    return b.prerequisiteDepth - a.prerequisiteDepth;
  }

  const indexA = orderById.get(a.conceptId) ?? Number.MAX_SAFE_INTEGER;
  const indexB = orderById.get(b.conceptId) ?? Number.MAX_SAFE_INTEGER;
  if (indexA !== indexB) {
    return indexA - indexB;
  }

  return a.conceptId.localeCompare(b.conceptId);
};
