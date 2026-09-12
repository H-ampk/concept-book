import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  QUIZ_DECK_SCHEMA_VERSION,
  QUIZ_QUESTION_SCHEMA_VERSION,
  type QuizDeck,
  type QuizQuestion
} from "../types/quiz";

const {
  getAllConcepts,
  getQuizQuestions,
  getQuizDecks,
  getQuizAttemptLogs,
  saveQuizAttemptLog
} = vi.hoisted(() => ({
  getAllConcepts: vi.fn(),
  getQuizQuestions: vi.fn(),
  getQuizDecks: vi.fn(),
  getQuizAttemptLogs: vi.fn(),
  saveQuizAttemptLog: vi.fn()
}));

vi.mock("../storage", () => ({
  getStorage: () => ({
    getAllConcepts,
    getQuizQuestions,
    getQuizDecks,
    getQuizAttemptLogs,
    saveQuizAttemptLog
  })
}));

import { QuizPlayPage } from "./QuizPlayPage";

const question = (overrides: Partial<QuizQuestion> = {}): QuizQuestion => ({
  id: "q1",
  prompt: "オペラント条件づけの提唱者は誰ですか？",
  choices: [
    { id: "c1", text: "スキナー" },
    { id: "c2", text: "パブロフ" }
  ],
  correctChoiceId: "c1",
  explanation: "スキナーが提唱した学習理論です。",
  visibility: "private",
  schemaVersion: QUIZ_QUESTION_SCHEMA_VERSION,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
  ...overrides
});

const deck = (overrides: Partial<QuizDeck> = {}): QuizDeck => ({
  id: "deck-1",
  title: "学習心理学セット",
  questionIds: ["q1"],
  visibility: "private",
  schemaVersion: QUIZ_DECK_SCHEMA_VERSION,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
  ...overrides
});

const renderPage = () => {
  const onBack = vi.fn();
  const onGoToQuizBuilder = vi.fn();
  render(<QuizPlayPage onBack={onBack} onGoToQuizBuilder={onGoToQuizBuilder} />);
  return { onBack, onGoToQuizBuilder };
};

const setupPlayableStorage = (questions: QuizQuestion[], quizDeck: QuizDeck) => {
  getAllConcepts.mockResolvedValue([]);
  getQuizQuestions.mockResolvedValue(questions);
  getQuizDecks.mockResolvedValue([quizDeck]);
  getQuizAttemptLogs.mockResolvedValue([]);
  saveQuizAttemptLog.mockResolvedValue(undefined);
};

const assertSetupIntroVisible = () => {
  expect(screen.getByText("Lab · 演習場")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "クイズで学習" })).toBeInTheDocument();
  expect(screen.getByText(/問題プールから学習状況に応じて最大/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "戻る（概念へ）" })).toBeInTheDocument();
  expect(document.querySelector(".ornament-line")).not.toBeNull();
};

const assertSetupIntroHidden = () => {
  expect(screen.queryByText("Lab · 演習場")).not.toBeInTheDocument();
  expect(screen.queryByText(/問題プールから学習状況に応じて最大/)).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "戻る（概念へ）" })).not.toBeInTheDocument();
  expect(document.querySelector(".ornament-line")).toBeNull();
  expect(screen.queryByRole("heading", { name: "クイズ集から始める" })).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "自由に学習する" })).not.toBeInTheDocument();
  expect(document.querySelectorAll("#quiz-play-title")).toHaveLength(1);
};

const startDeckSession = async () => {
  const user = userEvent.setup();
  renderPage();
  await user.click(await screen.findByRole("button", { name: "クイズ集「学習心理学セット」で学習を開始" }));
  expect(await screen.findByText("オペラント条件づけの提唱者は誰ですか？")).toBeInTheDocument();
  return user;
};

describe("QuizPlayPage 導入 UI 整理 (#174)", () => {
  beforeEach(() => {
    getAllConcepts.mockReset();
    getQuizQuestions.mockReset();
    getQuizDecks.mockReset();
    getQuizAttemptLogs.mockReset();
    saveQuizAttemptLog.mockReset();
    setupPlayableStorage([question()], deck());
  });

  it("setup では演習場の導入 UI と説明を表示する", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { name: "クイズ集から始める" })).toBeInTheDocument();
    assertSetupIntroVisible();
    expect(screen.getByRole("heading", { name: "自由に学習する" })).toBeInTheDocument();
    expect(screen.getByText(/選択肢が Concept にリンクしている場合/)).toBeInTheDocument();
  });

  it("play 開始後は問題・選択肢を上部に出し、setup 導入 UI を残さない", async () => {
    await startDeckSession();

    expect(screen.getByText(/問題 1 \/ 1/)).toBeInTheDocument();
    expect(screen.getByText("学習心理学セット")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "スキナー" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "パブロフ" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "戻る" })).toBeInTheDocument();
    assertSetupIntroHidden();
  });

  it("feedback でも setup 導入 UI は復活せず、解説と review を維持する", async () => {
    const user = await startDeckSession();

    await user.click(screen.getByRole("radio", { name: "パブロフ" }));
    await user.click(screen.getByRole("button", { name: "回答する" }));

    expect(await screen.findByRole("status")).toHaveTextContent("不正解");
    expect(screen.getByAltText("不正解時の狸イラスト")).toBeInTheDocument();
    expect(screen.getByText("解説")).toBeInTheDocument();
    expect(screen.getByText("スキナーが提唱した学習理論です。")).toBeInTheDocument();
    expect(screen.getByText("定義の確認")).toBeInTheDocument();
    expect(screen.getByText("あなたの回答")).toBeInTheDocument();
    expect(screen.getByText("正解")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "結果を見る" })).toBeInTheDocument();
    expect(screen.getByText("オペラント条件づけの提唱者は誰ですか？")).toBeInTheDocument();
    expect(screen.getByText(/問題 1 \/ 1/)).toBeInTheDocument();
    assertSetupIntroHidden();
  });

  it("results では結果 UI を表示し、setup の説明 UI は出さない", async () => {
    const user = await startDeckSession();

    await user.click(screen.getByRole("radio", { name: "スキナー" }));
    await user.click(screen.getByRole("button", { name: "回答する" }));
    await user.click(await screen.findByRole("button", { name: "結果を見る" }));

    expect(await screen.findByRole("heading", { name: "結果" })).toBeInTheDocument();
    expect(screen.getByText(/解いた問題/)).toBeInTheDocument();
    expect(screen.getByText("正答率（学習ログに記録されます）")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "クイズ選択に戻る" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "クイズ作成へ" })).toBeInTheDocument();
    expect(screen.getByText(/もう .* 問解く/)).toBeInTheDocument();
    assertSetupIntroHidden();
  });
});
