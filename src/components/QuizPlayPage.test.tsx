import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  questionType: "multiple-choice",
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

describe("QuizPlayPage 回答ログ保存 (#156)", () => {
  beforeEach(() => {
    getAllConcepts.mockReset();
    getQuizQuestions.mockReset();
    getQuizDecks.mockReset();
    getQuizAttemptLogs.mockReset();
    saveQuizAttemptLog.mockReset();
    setupPlayableStorage([question()], deck());
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("保存成功後に回答が確定し、feedback と結果へ進める", async () => {
    const user = await startDeckSession();

    await user.click(screen.getByRole("radio", { name: "スキナー" }));
    await user.click(screen.getByRole("button", { name: "回答する" }));

    expect(await screen.findByRole("status")).toHaveTextContent("正解");
    expect(screen.getByAltText("正解時の犬イラスト")).toBeInTheDocument();
    expect(screen.getByText("解説")).toBeInTheDocument();
    expect(screen.getByText("定義の確認")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "結果を見る" })).toBeInTheDocument();
    expect(saveQuizAttemptLog).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "結果を見る" }));
    expect(await screen.findByRole("heading", { name: "結果" })).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("保存失敗時は回答を確定せず、エラーを表示して再試行できる", async () => {
    saveQuizAttemptLog.mockRejectedValueOnce(new Error("indexeddb write failed"));
    const user = await startDeckSession();

    await user.click(screen.getByRole("radio", { name: "スキナー" }));
    await user.click(screen.getByRole("button", { name: "回答する" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("回答を保存できませんでした。");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByText("定義の確認")).not.toBeInTheDocument();
    expect(screen.queryByText("解説")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "結果を見る" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "次の問題へ" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "もう一度保存する" })).toBeEnabled();
    expect(saveQuizAttemptLog).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "もう一度保存する" }));
    expect(await screen.findByRole("status")).toHaveTextContent("正解");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(saveQuizAttemptLog).toHaveBeenCalledTimes(2);

    await user.click(screen.getByRole("button", { name: "結果を見る" }));
    expect(await screen.findByRole("heading", { name: "結果" })).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(screen.queryByText(/間違えた問題/)).not.toBeInTheDocument();
  });

  it("保存中は回答ボタンを無効化し、保存処理を重複実行しない", async () => {
    let resolveSave: (() => void) | undefined;
    saveQuizAttemptLog.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve;
        })
    );
    const user = await startDeckSession();

    await user.click(screen.getByRole("radio", { name: "パブロフ" }));
    await user.click(screen.getByRole("button", { name: "回答する" }));

    const savingButton = await screen.findByRole("button", { name: "保存中…" });
    expect(savingButton).toBeDisabled();
    expect(screen.getByRole("radio", { name: "スキナー" })).toBeDisabled();
    expect(screen.getByRole("radio", { name: "パブロフ" })).toBeDisabled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "結果を見る" })).not.toBeInTheDocument();

    await user.click(savingButton);
    expect(saveQuizAttemptLog).toHaveBeenCalledTimes(1);

    resolveSave?.();
    expect(await screen.findByRole("status")).toHaveTextContent("不正解");
    expect(saveQuizAttemptLog).toHaveBeenCalledTimes(1);
  });

  it("保存失敗後に再試行するまでスコアへ反映しない", async () => {
    saveQuizAttemptLog.mockRejectedValueOnce(new Error("indexeddb write failed"));
    const user = await startDeckSession();

    await user.click(screen.getByRole("radio", { name: "パブロフ" }));
    await user.click(screen.getByRole("button", { name: "回答する" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    saveQuizAttemptLog.mockResolvedValueOnce(undefined);
    await user.click(screen.getByRole("button", { name: "もう一度保存する" }));

    expect(await screen.findByRole("status")).toHaveTextContent("不正解");
    await user.click(screen.getByRole("button", { name: "結果を見る" }));

    expect(await screen.findByRole("heading", { name: "結果" })).toBeInTheDocument();
    expect(screen.getByText("0%")).toBeInTheDocument();
    expect(screen.getByText(/間違えた問題（1 問）/)).toBeInTheDocument();
  });
});

describe("QuizPlayPage free-response", () => {
  beforeEach(() => {
    getAllConcepts.mockReset();
    getQuizQuestions.mockReset();
    getQuizDecks.mockReset();
    getQuizAttemptLogs.mockReset();
    saveQuizAttemptLog.mockReset();
    setupPlayableStorage(
      [
        question({
          id: "q-fr",
          questionType: "free-response",
          prompt: "教師あり学習とは何ですか？",
          choices: [],
          correctChoiceId: "",
          referenceAnswer: "入力データと正解ラベルの組を用いて学習する手法"
        })
      ],
      deck({ questionIds: ["q-fr"] })
    );
  });

  it("入力 → 回答する → 模範解答と自己評価 → partial でログ保存する", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "クイズ集「学習心理学セット」で学習を開始" }));
    expect(await screen.findByText("教師あり学習とは何ですか？")).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: "選択肢" })).not.toBeInTheDocument();

    const submit = screen.getByRole("button", { name: "回答する" });
    expect(submit).toBeDisabled();
    await user.type(screen.getByLabelText("回答"), "ラベル付きデータを使う方法");
    await user.click(submit);

    expect(saveQuizAttemptLog).not.toHaveBeenCalled();
    expect(screen.getByText("あなたの回答")).toBeInTheDocument();
    expect(screen.getByText("ラベル付きデータを使う方法")).toBeInTheDocument();
    expect(screen.getByText("模範解答")).toBeInTheDocument();
    expect(screen.getByText("入力データと正解ラベルの組を用いて学習する手法")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "不正解" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "部分的に正解" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "正解" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "部分的に正解" }));
    await waitFor(() => {
      expect(saveQuizAttemptLog).toHaveBeenCalledTimes(1);
    });
    const log = saveQuizAttemptLog.mock.calls[0]?.[0];
    expect(log.questionType).toBe("free-response");
    expect(log.userAnswerTextSnapshot).toBe("ラベル付きデータを使う方法");
    expect(log.referenceAnswerSnapshot).toBe("入力データと正解ラベルの組を用いて学習する手法");
    expect(log.selfEvaluation).toBe("partial");
    expect(log.correct).toBe(false);
    expect(log.selectedChoiceId).toBe("");
    expect(log.correctChoiceId).toBe("");

    await user.click(screen.getByRole("button", { name: "結果を見る" }));
    expect(await screen.findByRole("heading", { name: "結果" })).toBeInTheDocument();
    expect(screen.getByText("0%")).toBeInTheDocument();
    expect(screen.getByText(/間違えた問題（1 問）/)).toBeInTheDocument();
    expect(screen.getByText("自己評価: 部分的に正解")).toBeInTheDocument();
  });

  it("keywords 未設定では採点補助を出さず既存フローのまま動く", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "クイズ集「学習心理学セット」で学習を開始" }));
    await user.type(screen.getByLabelText("回答"), "ラベル付きデータを使う方法");
    await user.click(screen.getByRole("button", { name: "回答する" }));
    expect(screen.queryByText("採点補助")).not.toBeInTheDocument();
    expect(screen.queryByText("含まれていた重要語句")).not.toBeInTheDocument();
    expect(saveQuizAttemptLog).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "部分的に正解" })).toBeInTheDocument();
  });
});

describe("QuizPlayPage free-response keyword guidance", () => {
  beforeEach(() => {
    getAllConcepts.mockReset();
    getQuizQuestions.mockReset();
    getQuizDecks.mockReset();
    getQuizAttemptLogs.mockReset();
    saveQuizAttemptLog.mockReset();
    setupPlayableStorage(
      [
        question({
          id: "q-fr-kw",
          questionType: "free-response",
          prompt: "教師あり学習とは何ですか？",
          choices: [],
          correctChoiceId: "",
          referenceAnswer: "入力データと正解ラベルの組を用いて学習する手法",
          keywords: ["正解ラベル", "入力", "学習"]
        })
      ],
      deck({ questionIds: ["q-fr-kw"] })
    );
  });

  it("回答後に含まれていた重要語句と不足している重要語句を表示する", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "クイズ集「学習心理学セット」で学習を開始" }));
    expect(screen.queryByText("採点補助")).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("回答"), "入力データを使って学習する方法");
    await user.click(screen.getByRole("button", { name: "回答する" }));

    expect(screen.getByText("採点補助")).toBeInTheDocument();
    expect(screen.getByText("含まれていた重要語句")).toBeInTheDocument();
    expect(screen.getByText("入力")).toBeInTheDocument();
    expect(screen.getByText("学習")).toBeInTheDocument();
    expect(screen.getByText("不足している重要語句")).toBeInTheDocument();
    expect(screen.getByText("正解ラベル")).toBeInTheDocument();
    expect(saveQuizAttemptLog).not.toHaveBeenCalled();
  });

  it("全キーワード一致でも自動採点せず、自己評価選択後にログ保存する", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "クイズ集「学習心理学セット」で学習を開始" }));
    await user.type(screen.getByLabelText("回答"), "入力と正解ラベルから学習する");
    await user.click(screen.getByRole("button", { name: "回答する" }));

    expect(saveQuizAttemptLog).not.toHaveBeenCalled();
    expect(screen.getByText("不足している重要語句")).toBeInTheDocument();
    expect(screen.getAllByText("なし").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("button", { name: "不正解" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "部分的に正解" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "正解" })).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "部分的に正解" }));
    await waitFor(() => {
      expect(saveQuizAttemptLog).toHaveBeenCalledTimes(1);
    });
    const log = saveQuizAttemptLog.mock.calls[0]?.[0];
    expect(log.selfEvaluation).toBe("partial");
    expect(log.correct).toBe(false);
    expect(log.matchedKeywords).toBeUndefined();
  });
});

