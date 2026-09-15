import type { QuizQuestion, QuizQuestionType, QuizSelfEvaluation } from "../../types/quiz";

export function resolveQuizQuestionType(raw: unknown): QuizQuestionType {
  return raw === "free-response" ? "free-response" : "multiple-choice";
}

export function isFreeResponseQuestion(q: Pick<QuizQuestion, "questionType">): boolean {
  return resolveQuizQuestionType(q.questionType) === "free-response";
}

export function isValidQuizSelfEvaluation(raw: unknown): raw is QuizSelfEvaluation {
  return raw === "incorrect" || raw === "partial" || raw === "correct";
}

export function selfEvaluationToCorrect(evaluation: QuizSelfEvaluation): boolean {
  return evaluation === "correct";
}

export function quizQuestionTypeLabel(type: QuizQuestionType): string {
  return type === "free-response" ? "入力式" : "四択";
}

export function selfEvaluationLabel(evaluation: QuizSelfEvaluation): string {
  if (evaluation === "correct") {
    return "正解";
  }
  if (evaluation === "partial") {
    return "部分的に正解";
  }
  return "不正解";
}
