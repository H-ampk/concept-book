import { buildConceptLearningSequence } from "./buildConceptLearningSequence";
import { collectPersonalizedPrerequisiteClosure } from "./collectPersonalizedPrerequisiteClosure";
import {
  getPersonalizedLearningSequenceReason,
  isSatisfiedPrerequisite
} from "./isSatisfiedPrerequisite";
import { orderConceptLearningClosure } from "./orderConceptLearningClosure";
import type {
  BuildPersonalizedConceptLearningSequenceInput,
  PersonalizedConceptLearningSequenceItem,
  PersonalizedConceptLearningSequenceResult,
  SatisfiedPrerequisiteBoundary
} from "./types";

const unavailable = (
  status: "target-not-found" | "cycle-detected",
  targetConceptId: string
): PersonalizedConceptLearningSequenceResult => ({
  status,
  targetConceptId,
  items: [],
  satisfiedBoundaries: [],
  targetAlreadyMastered: false
});

const compareByOriginalOrder = (
  a: string,
  b: string,
  orderById: ReadonlyMap<string, number>
): number => {
  const indexA = orderById.get(a) ?? Number.MAX_SAFE_INTEGER;
  const indexB = orderById.get(b) ?? Number.MAX_SAFE_INTEGER;
  if (indexA !== indexB) {
    return indexA - indexB;
  }
  return a.localeCompare(b);
};

const toItem = (
  conceptId: string,
  prerequisiteDepth: number,
  targetConceptId: string,
  masteryByConceptId: BuildPersonalizedConceptLearningSequenceInput["masteryByConceptId"]
): PersonalizedConceptLearningSequenceItem => {
  const mastery = masteryByConceptId.get(conceptId);
  const item: PersonalizedConceptLearningSequenceItem = {
    conceptId,
    prerequisiteDepth,
    isTarget: conceptId === targetConceptId,
    reason: getPersonalizedLearningSequenceReason(conceptId === targetConceptId, mastery)
  };
  if (mastery) {
    item.masteryState = mastery.state;
    item.confidence = mastery.confidence;
  }
  return item;
};

const toSatisfiedBoundaries = (
  conceptIds: ReadonlySet<string>,
  masteryByConceptId: BuildPersonalizedConceptLearningSequenceInput["masteryByConceptId"],
  orderById: ReadonlyMap<string, number>
): SatisfiedPrerequisiteBoundary[] => {
  const sortedIds = [...conceptIds].sort((a, b) => compareByOriginalOrder(a, b, orderById));
  const boundaries: SatisfiedPrerequisiteBoundary[] = [];
  for (const conceptId of sortedIds) {
    const mastery = masteryByConceptId.get(conceptId);
    if (!isSatisfiedPrerequisite(mastery) || !mastery) {
      continue;
    }
    boundaries.push({
      conceptId,
      reason: "satisfied-prerequisite",
      masteryState: mastery.state,
      confidence: mastery.confidence
    });
  }
  return boundaries;
};

/**
 * #120 の full sequence を壊さず、mastery map から personalized sequence を作る。
 * QuizAttemptLog は受け取らない。BKT も再計算しない。
 */
export const buildPersonalizedConceptLearningSequence = (
  input: BuildPersonalizedConceptLearningSequenceInput
): PersonalizedConceptLearningSequenceResult => {
  const { targetConceptId, prerequisiteIndex, masteryByConceptId } = input;
  const fullSequence =
    input.fullSequence && input.fullSequence.targetConceptId === targetConceptId
      ? input.fullSequence
      : buildConceptLearningSequence({ targetConceptId, prerequisiteIndex });

  if (fullSequence.status === "target-not-found" || fullSequence.status === "cycle-detected") {
    return unavailable(fullSequence.status, targetConceptId);
  }

  const targetMastery = masteryByConceptId.get(targetConceptId);
  const targetAlreadyMastered = isSatisfiedPrerequisite(targetMastery);
  if (targetAlreadyMastered) {
    return {
      status: "ok",
      targetConceptId,
      items: [toItem(targetConceptId, 0, targetConceptId, masteryByConceptId)],
      satisfiedBoundaries: [],
      targetAlreadyMastered: true
    };
  }

  const closure = collectPersonalizedPrerequisiteClosure({
    prerequisiteIndex,
    targetConceptId,
    isSatisfiedConcept: (conceptId) => isSatisfiedPrerequisite(masteryByConceptId.get(conceptId))
  });
  if (!closure) {
    return unavailable("target-not-found", targetConceptId);
  }

  const fullDepthByConceptId = new Map(
    fullSequence.items.map((item) => [item.conceptId, item.prerequisiteDepth] as const)
  );
  const depthByConceptId = new Map<string, number>();
  for (const conceptId of closure.activeConceptIds) {
    depthByConceptId.set(
      conceptId,
      fullDepthByConceptId.get(conceptId) ?? closure.depthByConceptId.get(conceptId) ?? 0
    );
  }

  const ordered = orderConceptLearningClosure({
    prerequisiteIndex,
    includedConceptIds: closure.activeConceptIds,
    depthByConceptId,
    targetConceptId
  });
  if (ordered.status === "cycle-detected") {
    return unavailable("cycle-detected", targetConceptId);
  }

  return {
    status: "ok",
    targetConceptId,
    items: ordered.items.map((item) =>
      toItem(item.conceptId, item.prerequisiteDepth, targetConceptId, masteryByConceptId)
    ),
    satisfiedBoundaries: toSatisfiedBoundaries(
      closure.satisfiedBoundaryConceptIds,
      masteryByConceptId,
      prerequisiteIndex.orderById
    ),
    targetAlreadyMastered: false
  };
};
