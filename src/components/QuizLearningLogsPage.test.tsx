import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QUIZ_ATTEMPT_LOG_SCHEMA_VERSION, type QuizAttemptLog } from "../types/quiz";

const { getQuizAttemptLogs, getAllConcepts, getQuizQuestions, deleteQuizAttemptLog, clearQuizAttemptLogs } =
  vi.hoisted(() => ({
    getQuizAttemptLogs: vi.fn(),
    getAllConcepts: vi.fn(),
    getQuizQuestions: vi.fn(),
    deleteQuizAttemptLog: vi.fn(),
    clearQuizAttemptLogs: vi.fn()
  }));

vi.mock("../storage", () => ({
  getStorage: () => ({
    getQuizAttemptLogs,
    getAllConcepts,
    getQuizQuestions,
    deleteQuizAttemptLog,
    clearQuizAttemptLogs
  })
}));

import { QuizLearningLogsPage } from "./QuizLearningLogsPage";

const log = (overrides: Partial<QuizAttemptLog> = {}): QuizAttemptLog => ({
  id: "mc-1",
  questionId: "q-mc",
  questionType: "multiple-choice",
  questionPromptSnapshot: "四択の問題文",
  selectedChoiceId: "c1",
  selectedChoiceTextSnapshot: "選択肢A",
  correctChoiceId: "c2",
  correctChoiceTextSnapshot: "選択肢B",
  correct: false,
  startedAt: "2026-09-01T00:00:00.000Z",
  answeredAt: "2026-09-01T00:00:01.000Z",
  timeMs: 1200,
  deckTitleSnapshot: "デッキA",
  schemaVersion: QUIZ_ATTEMPT_LOG_SCHEMA_VERSION,
  ...overrides
});

const mixedLogs: QuizAttemptLog[] = [
  log(),
  log({
    id: "fr-correct",
    questionId: "q-fr-ok",
    questionType: "free-response",
    questionPromptSnapshot: "入力式の問題文・正解",
    selectedChoiceTextSnapshot: "",
    correctChoiceTextSnapshot: "",
    userAnswerTextSnapshot: "自分の正しい答え",
    referenceAnswerSnapshot: "正しい模範解答",
    selfEvaluation: "correct",
    correct: true,
    answeredAt: "2026-09-02T00:00:00.000Z"
  }),
  log({
    id: "fr-partial",
    questionId: "q-fr-partial",
    questionType: "free-response",
    questionPromptSnapshot: "入力式の問題文・部分",
    selectedChoiceTextSnapshot: "",
    correctChoiceTextSnapshot: "",
    userAnswerTextSnapshot: "教師あり学習はラベルを使う",
    referenceAnswerSnapshot: "入力データと正解ラベルの組み合わせで学習する",
    selfEvaluation: "partial",
    correct: false,
    answeredAt: "2026-09-03T00:00:00.000Z"
  }),
  log({
    id: "fr-incorrect",
    questionId: "q-fr-ng",
    questionType: "free-response",
    questionPromptSnapshot: "入力式の問題文・不正解",
    selectedChoiceTextSnapshot: "",
    correctChoiceTextSnapshot: "",
    userAnswerTextSnapshot: "的外れな答え",
    referenceAnswerSnapshot: "別の模範解答",
    selfEvaluation: "incorrect",
    correct: false,
    answeredAt: "2026-09-04T00:00:00.000Z"
  })
];

const renderPage = () =>
  render(
    <QuizLearningLogsPage onBack={vi.fn()} onGoToQuizPlay={vi.fn()} onGoToAnalysisDashboard={vi.fn()} />
  );

describe("QuizLearningLogsPage", () => {
  beforeEach(() => {
    getQuizAttemptLogs.mockReset();
    getAllConcepts.mockReset();
    getQuizQuestions.mockReset();
    getQuizAttemptLogs.mockResolvedValue(mixedLogs);
    getAllConcepts.mockResolvedValue([]);
    getQuizQuestions.mockResolvedValue([]);
  });

  it("四択と入力式の履歴を形式に応じて表示し、partial を不正解にしない", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { name: "学習ログ" })).toBeInTheDocument();
    expect(screen.getAllByText("四択（再認）").length).toBeGreaterThan(0);
    expect(screen.getAllByText("入力式（再生）").length).toBeGreaterThan(0);

    const partialCard = screen.getByTestId("quiz-attempt-log-card-fr-partial");
    expect(within(partialCard).getByText("教師あり学習はラベルを使う")).toBeInTheDocument();
    expect(within(partialCard).getByText("入力データと正解ラベルの組み合わせで学習する")).toBeInTheDocument();
    expect(within(partialCard).getByText("部分的に正解")).toBeInTheDocument();
    expect(within(partialCard).queryByText("不正解")).not.toBeInTheDocument();

    const mcCard = screen.getByTestId("quiz-attempt-log-card-mc-1");
    expect(within(mcCard).getByText("選択肢A")).toBeInTheDocument();
    expect(within(mcCard).getByText("選択肢B")).toBeInTheDocument();
    expect(within(mcCard).getByText("不正解")).toBeInTheDocument();
  });

  it("回答形式 filter で四択・入力式・すべてを絞る", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "学習ログ" });

    fireEvent.click(screen.getByRole("button", { name: "四択" }));
    expect(screen.getByTestId("quiz-attempt-log-card-mc-1")).toBeInTheDocument();
    expect(screen.queryByTestId("quiz-attempt-log-card-fr-partial")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "入力式" }));
    expect(screen.queryByTestId("quiz-attempt-log-card-mc-1")).not.toBeInTheDocument();
    expect(screen.getByTestId("quiz-attempt-log-card-fr-correct")).toBeInTheDocument();
    expect(screen.getByTestId("quiz-attempt-log-card-fr-partial")).toBeInTheDocument();
    expect(screen.getByTestId("quiz-attempt-log-card-fr-incorrect")).toBeInTheDocument();

    fireEvent.click(within(screen.getByRole("group", { name: "回答形式で絞り込み" })).getByRole("button", { name: "すべて" }));
    expect(screen.getByTestId("quiz-attempt-log-card-mc-1")).toBeInTheDocument();
    expect(screen.getByTestId("quiz-attempt-log-card-fr-partial")).toBeInTheDocument();
  });

  it("結果 filter が正解・部分的に正解・不正解を表示 outcome で絞る", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "学習ログ" });
    const resultGroup = screen.getByRole("group", { name: "結果で絞り込み" });

    fireEvent.click(within(resultGroup).getByRole("button", { name: "正解" }));
    expect(screen.getByTestId("quiz-attempt-log-card-fr-correct")).toBeInTheDocument();
    expect(screen.queryByTestId("quiz-attempt-log-card-fr-partial")).not.toBeInTheDocument();
    expect(screen.queryByTestId("quiz-attempt-log-card-mc-1")).not.toBeInTheDocument();

    fireEvent.click(within(resultGroup).getByRole("button", { name: "部分的に正解" }));
    expect(screen.getByTestId("quiz-attempt-log-card-fr-partial")).toBeInTheDocument();
    expect(screen.queryByTestId("quiz-attempt-log-card-fr-incorrect")).not.toBeInTheDocument();
    expect(screen.queryByTestId("quiz-attempt-log-card-mc-1")).not.toBeInTheDocument();

    fireEvent.click(within(resultGroup).getByRole("button", { name: "不正解" }));
    expect(screen.getByTestId("quiz-attempt-log-card-mc-1")).toBeInTheDocument();
    expect(screen.getByTestId("quiz-attempt-log-card-fr-incorrect")).toBeInTheDocument();
    expect(screen.queryByTestId("quiz-attempt-log-card-fr-partial")).not.toBeInTheDocument();
  });

  it("free-response の回答本文と模範解答で検索できる", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "学習ログ" });
    expect(screen.getByLabelText("検索（問題文・回答）")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("検索（問題文・回答）"), {
      target: { value: "ラベルを使う" }
    });
    expect(screen.getByTestId("quiz-attempt-log-card-fr-partial")).toBeInTheDocument();
    expect(screen.queryByTestId("quiz-attempt-log-card-mc-1")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("検索（問題文・回答）"), {
      target: { value: "別の模範解答" }
    });
    expect(screen.getByTestId("quiz-attempt-log-card-fr-incorrect")).toBeInTheDocument();
    expect(screen.queryByTestId("quiz-attempt-log-card-fr-partial")).not.toBeInTheDocument();
  });
});
