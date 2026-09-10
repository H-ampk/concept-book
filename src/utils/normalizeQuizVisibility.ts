import type { QuizVisibility } from "../types/quiz";

/**
 * QuizQuestion / QuizDeck の visibility を canonical 値へ正規化する。
 *
 * - private → private
 * - shareable → shareable
 * - public（legacy）→ shareable
 * - 欠落・不正値 → private
 */
export const normalizeQuizVisibility = (value: unknown): QuizVisibility => {
  if (value === "private") {
    return "private";
  }
  if (value === "shareable" || value === "public") {
    return "shareable";
  }
  return "private";
};
