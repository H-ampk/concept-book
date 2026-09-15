import type { QuizQuestion } from "../../types/quiz";
import { resolveQuestionConceptId } from "../quiz/resolveQuestionConceptId";

/** QuizQuestion → 現存 Concept の正式関係（conceptId、なければ正解選択肢の sourceConceptId）。 */
export const buildQuizQuestionConceptIdSet = (
  quizQuestions: readonly QuizQuestion[],
  validConceptIds: ReadonlySet<string>
): Set<string> => {
  const ids = new Set<string>();
  for (const question of quizQuestions) {
    const conceptId = resolveQuestionConceptId(question, validConceptIds);
    if (conceptId) {
      ids.add(conceptId);
    }
  }
  return ids;
};
