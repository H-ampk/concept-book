import type { QuizAttemptLog, QuizQuestionType, QuizSelfEvaluation } from "../../types/quiz";
import { resolveQuizQuestionType, selfEvaluationLabel } from "./quizQuestionType";

const EMPTY_SNAPSHOT = "—";

export type QuizAttemptHistoryResultKind = QuizSelfEvaluation;

export type QuizAttemptHistoryQuestionTypeFilter = "all" | QuizQuestionType;

export type QuizAttemptHistoryResultFilter = "all" | QuizAttemptHistoryResultKind;

export type QuizAttemptHistoryPresentation = {
  questionType: QuizQuestionType;
  formatLabel: string;
  answerLabel: string;
  answerText: string;
  referenceLabel: string;
  referenceText: string;
  resultHeading: string;
  resultLabel: string;
  resultKind: QuizAttemptHistoryResultKind;
};

export type QuizAttemptHistoryOutcomeSummary = {
  total: number;
  correctCount: number;
  partialCount: number;
  incorrectCount: number;
};

const displaySnapshot = (value: string | undefined): string => {
  if (value == null || value === "") {
    return EMPTY_SNAPSHOT;
  }
  return value;
};

export const quizAttemptHistoryEmptySnapshot = EMPTY_SNAPSHOT;

export function resolveQuizAttemptHistoryResultKind(
  log: Pick<QuizAttemptLog, "questionType" | "correct" | "selfEvaluation">
): QuizAttemptHistoryResultKind {
  const questionType = resolveQuizQuestionType(log.questionType);
  if (questionType === "free-response") {
    if (log.selfEvaluation === "correct" || log.selfEvaluation === "partial" || log.selfEvaluation === "incorrect") {
      return log.selfEvaluation;
    }
    return log.correct ? "correct" : "incorrect";
  }
  return log.correct ? "correct" : "incorrect";
}

export function presentQuizAttemptHistory(
  log: Pick<
    QuizAttemptLog,
    | "questionType"
    | "correct"
    | "selfEvaluation"
    | "selectedChoiceTextSnapshot"
    | "correctChoiceTextSnapshot"
    | "userAnswerTextSnapshot"
    | "referenceAnswerSnapshot"
  >
): QuizAttemptHistoryPresentation {
  const questionType = resolveQuizQuestionType(log.questionType);
  const resultKind = resolveQuizAttemptHistoryResultKind(log);
  const resultLabel = selfEvaluationLabel(resultKind);

  if (questionType === "free-response") {
    return {
      questionType,
      formatLabel: "入力式（再生）",
      answerLabel: "あなたの回答",
      answerText: displaySnapshot(log.userAnswerTextSnapshot),
      referenceLabel: "模範解答",
      referenceText: displaySnapshot(log.referenceAnswerSnapshot),
      resultHeading: "自己評価",
      resultLabel,
      resultKind
    };
  }

  return {
    questionType,
    formatLabel: "四択（再認）",
    answerLabel: "選んだ選択肢",
    answerText: displaySnapshot(log.selectedChoiceTextSnapshot),
    referenceLabel: "正解選択肢",
    referenceText: displaySnapshot(log.correctChoiceTextSnapshot),
    resultHeading: "結果",
    resultLabel,
    resultKind
  };
}

export function matchesQuizAttemptQuestionTypeFilter(
  log: Pick<QuizAttemptLog, "questionType">,
  filter: QuizAttemptHistoryQuestionTypeFilter
): boolean {
  if (filter === "all") {
    return true;
  }
  return resolveQuizQuestionType(log.questionType) === filter;
}

export function matchesQuizAttemptHistoryResultFilter(
  log: Pick<QuizAttemptLog, "questionType" | "correct" | "selfEvaluation">,
  filter: QuizAttemptHistoryResultFilter
): boolean {
  if (filter === "all") {
    return true;
  }
  return resolveQuizAttemptHistoryResultKind(log) === filter;
}

export function matchesQuizAttemptHistorySearch(log: QuizAttemptLog, query: string): boolean {
  const n = query.trim().toLowerCase();
  if (!n) {
    return true;
  }
  const haystacks = [
    log.questionPromptSnapshot,
    log.selectedChoiceTextSnapshot,
    log.correctChoiceTextSnapshot,
    log.userAnswerTextSnapshot,
    log.referenceAnswerSnapshot,
    log.deckTitleSnapshot
  ];
  return haystacks.some((value) => (value ?? "").toLowerCase().includes(n));
}

export function summarizeQuizAttemptHistoryOutcomes(
  logs: Array<Pick<QuizAttemptLog, "questionType" | "correct" | "selfEvaluation">>
): QuizAttemptHistoryOutcomeSummary {
  let correctCount = 0;
  let partialCount = 0;
  let incorrectCount = 0;
  for (const log of logs) {
    const kind = resolveQuizAttemptHistoryResultKind(log);
    if (kind === "correct") {
      correctCount += 1;
    } else if (kind === "partial") {
      partialCount += 1;
    } else {
      incorrectCount += 1;
    }
  }
  return {
    total: logs.length,
    correctCount,
    partialCount,
    incorrectCount
  };
}
