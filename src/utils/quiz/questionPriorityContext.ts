import type { QuestionQuizStats } from "./getQuestionQuizStats";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** ISO 日時から基準日までの経過日数（切り捨て） */
export function daysBetween(fromIso: string, toDate: Date): number {
  const fromMs = new Date(fromIso).getTime();
  const toMs = toDate.getTime();
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) {
    return 0;
  }
  return Math.floor((toMs - fromMs) / MS_PER_DAY);
}

/** calculateQuestionWeight / getQuestionSelectionReasons で共有する優先度コンテキスト */
export type QuestionPriorityContext = {
  total: number;
  neverAnswered: boolean;
  accuracy: number | null;
  daysSinceLastAnswered: number | null;
  incorrectCount: number;
  correctCount: number;
  lastAnswerCorrect: boolean | null;
};

export function buildQuestionPriorityContext(
  stats: QuestionQuizStats,
  now: Date = new Date()
): QuestionPriorityContext {
  const total = stats.correctCount + stats.incorrectCount;
  return {
    total,
    neverAnswered: total === 0,
    accuracy: total > 0 ? stats.correctCount / total : null,
    daysSinceLastAnswered: stats.lastAnsweredAt
      ? daysBetween(stats.lastAnsweredAt, now)
      : null,
    incorrectCount: stats.incorrectCount,
    correctCount: stats.correctCount,
    lastAnswerCorrect: stats.lastAnswerCorrect
  };
}
