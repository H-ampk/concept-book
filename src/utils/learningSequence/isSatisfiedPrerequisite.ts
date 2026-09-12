import type { ConceptMastery } from "../mastery/types";
import type { PersonalizedLearningSequenceReason } from "./types";

export type PrerequisiteSatisfactionReason =
  | "satisfied-prerequisite"
  | "needs-learning"
  | "insufficient-evidence";

/**
 * Prerequisite が十分習得済みか（canonical）。
 *
 * `mastered` かつ confidence が `medium` または `high` のときのみ true。
 * freshness / masteryScore / masteryProbability / attemptCount / accuracy は見ない。
 * `undefined`（mastery 欠損）は未充足。
 *
 * #58 Phase 2 の `weak-prerequisite` 判定も、この関数を再利用すること。
 */
export const isSatisfiedPrerequisite = (
  mastery: ConceptMastery | undefined
): boolean =>
  mastery?.state === "mastered" &&
  (mastery.confidence === "medium" || mastery.confidence === "high");

/**
 * Satisfaction の説明用分類。判定本体は `isSatisfiedPrerequisite`。
 * freshness は見ない。
 */
export const getPrerequisiteSatisfactionReason = (
  mastery: ConceptMastery | undefined
): PrerequisiteSatisfactionReason => {
  if (isSatisfiedPrerequisite(mastery)) {
    return "satisfied-prerequisite";
  }
  if (
    mastery == null ||
    mastery.state === "insufficient-data" ||
    (mastery.state === "mastered" && mastery.confidence === "low")
  ) {
    return "insufficient-evidence";
  }
  return "needs-learning";
};

/** Personalized sequence の active item 用。target は mastery に関係なく `target`。 */
export const getPersonalizedLearningSequenceReason = (
  isTarget: boolean,
  mastery: ConceptMastery | undefined
): PersonalizedLearningSequenceReason => {
  if (isTarget) {
    return "target";
  }
  const satisfaction = getPrerequisiteSatisfactionReason(mastery);
  return satisfaction === "satisfied-prerequisite" ? "needs-learning" : satisfaction;
};
