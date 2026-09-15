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
  saveQuizAttemptLog,
  generateAIText
} = vi.hoisted(() => ({
  getAllConcepts: vi.fn(),
  getQuizQuestions: vi.fn(),
  getQuizDecks: vi.fn(),
  getQuizAttemptLogs: vi.fn(),
  saveQuizAttemptLog: vi.fn(),
  generateAIText: vi.fn()
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

vi.mock("../features/ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../features/ai")>();
  return {
    ...actual,
    getAITextProvider: () => ({ generate: generateAIText })
  };
});

import { AI_SETTINGS_STORAGE_KEY, DEFAULT_AI_SETTINGS } from "../features/ai";
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

const enableAISettings = (baseUrl = "http://localhost:11434") => {
  localStorage.setItem(
    AI_SETTINGS_STORAGE_KEY,
    JSON.stringify({
      ...DEFAULT_AI_SETTINGS,
      enabled: true,
      baseUrl
    })
  );
};

const freeResponseQuestion = (overrides: Partial<QuizQuestion> = {}): QuizQuestion =>
  question({
    id: "q-fr-ai",
    questionType: "free-response",
    prompt: "教師あり学習とは何ですか？",
    choices: [],
    correctChoiceId: "",
    referenceAnswer: "入力データと正解ラベルの組を用いて学習する手法",
    ...overrides
  });

describe("QuizPlayPage free-response AI grading", () => {
  beforeEach(() => {
    localStorage.clear();
    generateAIText.mockReset();
    getAllConcepts.mockReset();
    getQuizQuestions.mockReset();
    getQuizDecks.mockReset();
    getQuizAttemptLogs.mockReset();
    saveQuizAttemptLog.mockReset();
    setupPlayableStorage([freeResponseQuestion()], deck({ questionIds: ["q-fr-ai"] }));
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("AI設定 disabled では Provider を呼ばず自己評価できる", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "クイズ集「学習心理学セット」で学習を開始" }));
    await user.type(screen.getByLabelText("回答"), "ラベル付きデータを使う方法");
    await user.click(screen.getByRole("button", { name: "回答する" }));

    expect(
      screen.getByText("AI採点補助はAI設定が有効な場合のみ利用できます。自己評価はこのまま利用できます。")
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "AIに採点補助を依頼" })).not.toBeInTheDocument();
    expect(generateAIText).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "部分的に正解" }));
    await waitFor(() => {
      expect(saveQuizAttemptLog).toHaveBeenCalledTimes(1);
    });
    expect(saveQuizAttemptLog.mock.calls[0]?.[0].selfEvaluation).toBe("partial");
  });

  it("回答するだけでは provider.generate を呼ばない", async () => {
    enableAISettings();
    generateAIText.mockResolvedValue({
      text: JSON.stringify({ evaluation: "correct", reason: "一致" })
    });
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "クイズ集「学習心理学セット」で学習を開始" }));
    await user.type(screen.getByLabelText("回答"), "ラベル付きデータを使う方法");
    await user.click(screen.getByRole("button", { name: "回答する" }));

    expect(generateAIText).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "AIに採点補助を依頼" })).toBeInTheDocument();
  });

  it("request button 前に送信内容の説明を表示する", async () => {
    enableAISettings("http://localhost:11434");
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "クイズ集「学習心理学セット」で学習を開始" }));
    await user.type(screen.getByLabelText("回答"), "ラベル付きデータを使う方法");
    await user.click(screen.getByRole("button", { name: "回答する" }));

    expect(
      screen.getByText(/問題文・あなたの回答・模範解答を設定済みのAI Providerへ送信します/)
    ).toBeInTheDocument();
    expect(screen.getByText("送信先: http://localhost:11434")).toBeInTheDocument();
  });

  it("AI依頼成功で判定と理由を表示し、自動保存しない", async () => {
    enableAISettings();
    generateAIText.mockResolvedValue({
      text: JSON.stringify({
        evaluation: "correct",
        reason: "本質的に一致しています。"
      })
    });
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "クイズ集「学習心理学セット」で学習を開始" }));
    await user.type(screen.getByLabelText("回答"), "ラベル付きデータを使う方法");
    await user.click(screen.getByRole("button", { name: "回答する" }));
    await user.click(screen.getByRole("button", { name: "AIに採点補助を依頼" }));

    expect(await screen.findByText("判定")).toBeInTheDocument();
    expect(screen.getByText("本質的に一致しています。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "この判定を自己評価に採用" })).toBeInTheDocument();
    expect(saveQuizAttemptLog).not.toHaveBeenCalled();
    expect(generateAIText).toHaveBeenCalledTimes(1);
  });

  it("LLM判定を採用すると selfEvaluation が保存される", async () => {
    enableAISettings();
    generateAIText.mockResolvedValue({
      text: JSON.stringify({
        evaluation: "partial",
        reason: "重要な要素が不足しています。"
      })
    });
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "クイズ集「学習心理学セット」で学習を開始" }));
    await user.type(screen.getByLabelText("回答"), "ラベル付きデータを使う方法");
    await user.click(screen.getByRole("button", { name: "回答する" }));
    await user.click(screen.getByRole("button", { name: "AIに採点補助を依頼" }));
    await user.click(await screen.findByRole("button", { name: "この判定を自己評価に採用" }));

    await waitFor(() => {
      expect(saveQuizAttemptLog).toHaveBeenCalledTimes(1);
    });
    expect(saveQuizAttemptLog.mock.calls[0]?.[0].selfEvaluation).toBe("partial");
    expect(saveQuizAttemptLog.mock.calls[0]?.[0].correct).toBe(false);
    expect(saveQuizAttemptLog.mock.calls[0]?.[0].aiEvaluation).toBeUndefined();
  });

  it("LLM判定が partial でもユーザーが正解を選べる", async () => {
    enableAISettings();
    generateAIText.mockResolvedValue({
      text: JSON.stringify({
        evaluation: "partial",
        reason: "重要な要素が不足しています。"
      })
    });
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "クイズ集「学習心理学セット」で学習を開始" }));
    await user.type(screen.getByLabelText("回答"), "ラベル付きデータを使う方法");
    await user.click(screen.getByRole("button", { name: "回答する" }));
    await user.click(screen.getByRole("button", { name: "AIに採点補助を依頼" }));
    expect(await screen.findByText("重要な要素が不足しています。")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "正解" }));

    await waitFor(() => {
      expect(saveQuizAttemptLog).toHaveBeenCalledTimes(1);
    });
    const log = saveQuizAttemptLog.mock.calls[0]?.[0];
    expect(log.selfEvaluation).toBe("correct");
    expect(log.correct).toBe(true);
  });

  it("error 時も自己評価ボタンが使え、保存できる", async () => {
    enableAISettings();
    generateAIText.mockRejectedValue(new Error("provider failed"));
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "クイズ集「学習心理学セット」で学習を開始" }));
    await user.type(screen.getByLabelText("回答"), "ラベル付きデータを使う方法");
    await user.click(screen.getByRole("button", { name: "回答する" }));
    await user.click(screen.getByRole("button", { name: "AIに採点補助を依頼" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("AI採点補助を利用できませんでした。");
    expect(screen.getByRole("button", { name: "不正解" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "部分的に正解" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "正解" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "不正解" }));
    await waitFor(() => {
      expect(saveQuizAttemptLog).toHaveBeenCalledTimes(1);
    });
    expect(saveQuizAttemptLog.mock.calls[0]?.[0].selfEvaluation).toBe("incorrect");
  });

  it("keyword guidance と AI採点補助と自己評価が共存する", async () => {
    enableAISettings();
    setupPlayableStorage(
      [
        freeResponseQuestion({
          id: "q-fr-ai-kw",
          keywords: ["正解ラベル", "入力", "学習"]
        })
      ],
      deck({ questionIds: ["q-fr-ai-kw"] })
    );
    generateAIText.mockResolvedValue({
      text: JSON.stringify({ evaluation: "partial", reason: "不足があります。" })
    });
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "クイズ集「学習心理学セット」で学習を開始" }));
    await user.type(screen.getByLabelText("回答"), "入力データを使って学習する方法");
    await user.click(screen.getByRole("button", { name: "回答する" }));

    expect(screen.getByText("採点補助")).toBeInTheDocument();
    expect(screen.getByText("AI採点補助（任意）")).toBeInTheDocument();
    expect(screen.getByText("自己評価")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "AIに採点補助を依頼" }));
    expect(await screen.findByText("不足があります。")).toBeInTheDocument();
    expect(screen.getByText("採点補助")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "部分的に正解" })).toBeInTheDocument();
  });

  it("次問題へ移ると前問題の AI判定・理由・error が残らない", async () => {
    enableAISettings();
    setupPlayableStorage(
      [
        freeResponseQuestion({ id: "q-fr-1", prompt: "問題1" }),
        freeResponseQuestion({ id: "q-fr-2", prompt: "問題2", referenceAnswer: "別の模範解答" })
      ],
      deck({ questionIds: ["q-fr-1", "q-fr-2"] })
    );
    generateAIText.mockResolvedValue({
      text: JSON.stringify({ evaluation: "partial", reason: "前の問題の理由" })
    });
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "クイズ集「学習心理学セット」で学習を開始" }));
    expect(await screen.findByText(/問題 1 \/ 2/)).toBeInTheDocument();
    await user.type(screen.getByLabelText("回答"), "回答1");
    await user.click(screen.getByRole("button", { name: "回答する" }));
    await user.click(screen.getByRole("button", { name: "AIに採点補助を依頼" }));
    expect(await screen.findByText("前の問題の理由")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "部分的に正解" }));
    await user.click(await screen.findByRole("button", { name: "次の問題へ" }));

    expect(await screen.findByText(/問題 2 \/ 2/)).toBeInTheDocument();
    await user.type(screen.getByLabelText("回答"), "回答2");
    await user.click(screen.getByRole("button", { name: "回答する" }));
    expect(screen.queryByText("前の問題の理由")).not.toBeInTheDocument();
    expect(screen.queryByText("AIが回答を確認中…")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "AIに採点補助を依頼" })).toBeInTheDocument();
  });
});

