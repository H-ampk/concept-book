import type { LearningModelPredictionPoint } from "../learningModelEvaluation/types";

/**
 * Data Lab の対象 attempt に一致する prediction point だけ残す。
 * prediction の生成（history）はここでは触らない。
 */
export const filterLearningModelPredictionPointsByAttemptIds = (
  points: readonly LearningModelPredictionPoint[],
  targetAttemptIds: ReadonlySet<string>
): LearningModelPredictionPoint[] =>
  points.filter((point) => targetAttemptIds.has(point.attemptId));
