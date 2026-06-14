import type { QuestionQuizStats } from "./getQuestionQuizStats";
import { buildQuestionPriorityContext } from "./questionPriorityContext";

/**
 * 学習状況に基づく出題重み。
 * 未学習・誤答多・低正答率・長期未復習を優先し、直近正解を抑制する。
 * 最低 weight は 1（完全除外しない）。
 */
export function calculateQuestionWeight(stats: QuestionQuizStats, now: Date = new Date()): number {
  let weight = 1;
  const ctx = buildQuestionPriorityContext(stats, now);

  if (ctx.neverAnswered) {
    weight += 10;
  }

  weight += ctx.incorrectCount * 3;

  if (ctx.accuracy !== null && ctx.accuracy < 0.6) {
    weight += 6;
  } else if (ctx.accuracy !== null && ctx.accuracy < 0.8) {
    weight += 3;
  }

  if (ctx.daysSinceLastAnswered !== null && ctx.daysSinceLastAnswered >= 7) {
    weight += 5;
  }

  if (ctx.daysSinceLastAnswered !== null && ctx.daysSinceLastAnswered >= 30) {
    weight += 8;
  }

  if (ctx.daysSinceLastAnswered !== null && ctx.daysSinceLastAnswered <= 1) {
    weight -= 4;
  }

  if (
    ctx.daysSinceLastAnswered !== null &&
    ctx.daysSinceLastAnswered <= 1 &&
    ctx.lastAnswerCorrect === true
  ) {
    weight -= 2;
  }

  if (ctx.accuracy !== null && ctx.accuracy >= 0.9 && ctx.total >= 3) {
    weight -= 3;
  }

  return Math.max(weight, 1);
}

export { daysBetween } from "./questionPriorityContext";
