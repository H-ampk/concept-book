import type { QuizAttemptLog } from "../../types/quiz";

export type QuestionQuizStats = {
  questionId: string;
  correctCount: number;
  incorrectCount: number;
  lastAnsweredAt: string | null;
  /** 直近の回答が正解だったか（未学習は null） */
  lastAnswerCorrect: boolean | null;
};

const emptyStats = (questionId: string): QuestionQuizStats => ({
  questionId,
  correctCount: 0,
  incorrectCount: 0,
  lastAnsweredAt: null,
  lastAnswerCorrect: null
});

/** 学習ログから問題 ID ごとの集計を構築 */
export function buildQuestionQuizStatsMap(logs: QuizAttemptLog[]): Map<string, QuestionQuizStats> {
  const map = new Map<string, QuestionQuizStats>();

  const sorted = [...logs].sort((a, b) => a.answeredAt.localeCompare(b.answeredAt));

  for (const log of sorted) {
    const questionId = log.questionId?.trim();
    if (!questionId) {
      continue;
    }

    const current = map.get(questionId) ?? emptyStats(questionId);

    if (log.correct) {
      current.correctCount += 1;
    } else {
      current.incorrectCount += 1;
    }

    if (!current.lastAnsweredAt || log.answeredAt >= current.lastAnsweredAt) {
      current.lastAnsweredAt = log.answeredAt;
      current.lastAnswerCorrect = log.correct;
    }

    map.set(questionId, current);
  }

  return map;
}

export function getQuestionQuizStats(
  statsMap: Map<string, QuestionQuizStats>,
  questionId: string
): QuestionQuizStats {
  return statsMap.get(questionId) ?? emptyStats(questionId);
}
