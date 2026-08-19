import type { QuizAttemptLog } from "../../types/quiz";

/**
 * 回答ログを mastery / 概念別集計の対象 Concept へ帰属させる。
 * 優先順: questionConceptId → conceptId。
 * selectedLinkedConceptId / correctLinkedConceptId は混同分析専用のため使わない。
 */
export function resolveConceptIdFromLog(log: QuizAttemptLog): string | null {
  const questionConceptId = log.questionConceptId?.trim();
  if (questionConceptId) {
    return questionConceptId;
  }
  const conceptId = log.conceptId?.trim();
  if (conceptId) {
    return conceptId;
  }
  return null;
}
