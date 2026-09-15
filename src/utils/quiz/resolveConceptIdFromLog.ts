import type { QuizAttemptLog } from "../../types/quiz";

/**
 * QuizAttemptLog の分析対象 Concept を解決する共通 resolver。
 * Data Lab 集計・CSV・学習モデル（BKT / PFA / HLR / mastery history / one-step-ahead）が共用する。
 * 優先順: conceptId → questionConceptId → null。
 * selectedLinkedConceptId / correctLinkedConceptId は混同分析専用のため使わない。
 */
export function resolveConceptIdFromLog(log: QuizAttemptLog): string | null {
  const conceptId = log.conceptId?.trim();
  if (conceptId) {
    return conceptId;
  }

  const questionConceptId = log.questionConceptId?.trim();
  if (questionConceptId) {
    return questionConceptId;
  }

  return null;
}
