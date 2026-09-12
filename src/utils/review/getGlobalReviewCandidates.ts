import type { ConceptMastery } from "../mastery/types";
import type { ConfusionEdgeCountInput } from "../conceptGraphConfusion";
import type { QuizQuestion } from "../../types/quiz";
import { buildFrequentConfusionByConceptId } from "./buildFrequentConfusionByConceptId";
import { buildQuizQuestionConceptIdSet } from "./buildQuizQuestionConceptIdSet";
import { collectGlobalReviewReasons } from "./collectGlobalReviewReasons";
import { compareGlobalReviewCandidates } from "./compareGlobalReviewCandidates";
import { getReviewPriority } from "./getReviewPriority";
import type { GlobalReviewCandidate } from "./types";

export type ReviewConceptRef = {
  id: string;
};

export type GetGlobalReviewCandidatesInput = {
  concepts: readonly ReviewConceptRef[];
  masteryByConceptId: ReadonlyMap<string, ConceptMastery>;
  confusionStats: readonly ConfusionEdgeCountInput[];
  quizQuestions: readonly QuizQuestion[];
  now?: Date;
};

/**
 * global review 候補を抽出する。mastery / confusion は再集計せず、渡された派生データを読む。
 * weak-prerequisite は #118 / #121 接続まで生成しない。
 */
export const getGlobalReviewCandidates = (
  input: GetGlobalReviewCandidatesInput
): GlobalReviewCandidate[] => {
  const now = input.now ?? new Date();
  const originalIndexById = new Map<string, number>();
  const validConceptIds = new Set<string>();

  input.concepts.forEach((concept, index) => {
    if (!originalIndexById.has(concept.id)) {
      originalIndexById.set(concept.id, index);
    }
    validConceptIds.add(concept.id);
  });

  const confusionByConceptId = buildFrequentConfusionByConceptId(
    input.confusionStats,
    validConceptIds
  );
  const quizQuestionConceptIds = buildQuizQuestionConceptIdSet(input.quizQuestions);
  const candidates: GlobalReviewCandidate[] = [];

  for (const concept of input.concepts) {
    const mastery = input.masteryByConceptId.get(concept.id);
    if (!mastery) {
      continue;
    }

    const reasons = collectGlobalReviewReasons(mastery, {
      now,
      frequentConfusion: confusionByConceptId.get(concept.id)
    });
    if (reasons.length === 0) {
      continue;
    }

    candidates.push({
      conceptId: concept.id,
      mastery,
      priority: getReviewPriority(reasons),
      reasons,
      hasQuizQuestion: quizQuestionConceptIds.has(concept.id)
    });
  }

  candidates.sort((a, b) => compareGlobalReviewCandidates(a, b, originalIndexById));
  return candidates;
};
