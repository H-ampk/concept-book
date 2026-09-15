import type { QuizSelfEvaluation } from "../../../types/quiz";

export type FreeResponseAIGrade = {
  evaluation: QuizSelfEvaluation;
  reason: string;
};

export type GradeFreeResponseWithAIInput = {
  questionPrompt: string;
  userAnswer: string;
  referenceAnswer: string;
};
