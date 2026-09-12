import {
  getPrerequisiteSatisfactionReason,
  isSatisfiedPrerequisite
} from "../learningSequence";
import type {
  PersonalizedConceptLearningSequenceItem,
  PersonalizedConceptLearningSequenceResult
} from "../learningSequence";
import type { ConceptMastery } from "../mastery/types";
import type {
  SelectedContextReviewCandidate,
  SelectedContextReviewResult,
  WeakPrerequisiteReason,
  WeakPrerequisiteSatisfactionReason
} from "./types";

export type GetSelectedContextReviewCandidatesInput = {
  /** #121 の personalized sequence。ここでは再計算しない。 */
  personalizedSequence: PersonalizedConceptLearningSequenceResult;
  masteryByConceptId: ReadonlyMap<string, ConceptMastery>;
  quizQuestionConceptIds: ReadonlySet<string>;
};

const unavailable = (
  status: "target-not-found" | "cycle-detected",
  targetConceptId: string
): SelectedContextReviewResult => ({
  status,
  targetConceptId,
  candidates: []
});

const toWeakReason = (
  item: PersonalizedConceptLearningSequenceItem,
  targetConceptId: string,
  mastery: ConceptMastery | undefined,
  satisfactionReason: WeakPrerequisiteSatisfactionReason
): WeakPrerequisiteReason => {
  const reason: WeakPrerequisiteReason = {
    type: "weak-prerequisite",
    targetConceptId,
    prerequisiteId: item.conceptId,
    prerequisiteDepth: item.prerequisiteDepth,
    satisfactionReason
  };
  if (mastery) {
    reason.state = mastery.state;
    reason.confidence = mastery.confidence;
  }
  return reason;
};

/**
 * #121 personalized sequence の target 以外を weak-prerequisite candidate へ変換する。
 * branch pruning / satisfaction は再実装せず、渡された sequence を読む。
 */
export const getSelectedContextReviewCandidates = (
  input: GetSelectedContextReviewCandidatesInput
): SelectedContextReviewResult => {
  const { personalizedSequence, masteryByConceptId, quizQuestionConceptIds } = input;
  const { targetConceptId, status } = personalizedSequence;

  if (status === "target-not-found" || status === "cycle-detected") {
    return unavailable(status, targetConceptId);
  }

  const candidates: SelectedContextReviewCandidate[] = [];
  for (const item of personalizedSequence.items) {
    if (item.isTarget || item.conceptId === targetConceptId) {
      continue;
    }

    const mastery = masteryByConceptId.get(item.conceptId);
    if (isSatisfiedPrerequisite(mastery)) {
      continue;
    }

    const satisfactionReason = getPrerequisiteSatisfactionReason(mastery);
    if (satisfactionReason === "satisfied-prerequisite") {
      continue;
    }

    const candidate: SelectedContextReviewCandidate = {
      conceptId: item.conceptId,
      targetConceptId,
      reason: toWeakReason(item, targetConceptId, mastery, satisfactionReason),
      hasQuizQuestion: quizQuestionConceptIds.has(item.conceptId)
    };
    if (mastery) {
      candidate.mastery = mastery;
    }
    candidates.push(candidate);
  }

  return {
    status: "ok",
    targetConceptId,
    candidates,
    targetAlreadyMastered: personalizedSequence.targetAlreadyMastered
  };
};
