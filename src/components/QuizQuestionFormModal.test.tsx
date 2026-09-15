import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyConceptInput, type Concept } from "../types/concept";
import type { QuizQuestion } from "../types/quiz";
import { QUIZ_QUESTION_SCHEMA_VERSION } from "../types/quiz";

const { saveQuizQuestion, getAllContextCards } = vi.hoisted(() => ({
  saveQuizQuestion: vi.fn(async () => undefined),
  getAllContextCards: vi.fn(async () => [])
}));

vi.mock("../storage", () => {
  const storage = {
    saveQuizQuestion,
    getAllContextCards
  };
  return {
    getStorage: () => storage,
    getContextStorage: () => storage
  };
});

import { QuizQuestionFormModal } from "./QuizQuestionFormModal";

const concept = (overrides: Partial<Concept>): Concept => ({
  ...createEmptyConceptInput(),
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides
});

const concepts: Concept[] = [
  concept({
    id: "bayes",
    title: "ベイズ推論",
    domainTags: ["統計", "機械学習"]
  }),
  concept({
    id: "mle",
    title: "最尤推定",
    domainTags: ["統計"]
  })
];

const existingQuestion: QuizQuestion = {
  id: "q1",
  conceptId: "bayes",
  questionType: "multiple-choice",
  prompt: "既存の問題",
  choices: [
    { id: "ch1", text: "選択肢A" },
    { id: "ch2", text: "選択肢B" }
  ],
  correctChoiceId: "ch1",
  visibility: "private",
  schemaVersion: QUIZ_QUESTION_SCHEMA_VERSION,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
};

describe("QuizQuestionFormModal concept picker", () => {
  beforeEach(() => {
    saveQuizQuestion.mockClear();
    getAllContextCards.mockClear();
  });

  it("edit mode で既存の conceptId が選択中として表示される", () => {
    render(
      <QuizQuestionFormModal
        open
        mode="edit"
        question={existingQuestion}
        concepts={concepts}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );

    expect(screen.getByText("選択中")).toBeInTheDocument();
    expect(screen.getByText("ベイズ推論")).toBeInTheDocument();
    expect(screen.getByText("統計 / 機械学習")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).toBeInTheDocument();
    expect(document.querySelectorAll("select#quiz-form-related-concept")).toHaveLength(0);
  });

  it("Concept を選んで保存すると payload.conceptId が Concept ID になる", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(
      <QuizQuestionFormModal
        open
        mode="create"
        concepts={concepts}
        onClose={vi.fn()}
        onSaved={onSaved}
      />
    );

    await user.type(
      screen.getByRole("combobox", { name: "Conceptを検索（タイトル・分野タグで絞り込み）" }),
      "ベイズ"
    );
    await waitFor(() => {
      expect(screen.getByRole("option", { name: /ベイズ推論/ })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("option", { name: /ベイズ推論/ }));

    await user.type(screen.getByPlaceholderText("問いを入力…"), "問題文");
    const choiceInputs = screen.getAllByPlaceholderText(/選択肢の本文/);
    await user.type(choiceInputs[0]!, "正解");
    await user.type(choiceInputs[1]!, "誤答");

    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(saveQuizQuestion).toHaveBeenCalledTimes(1);
    });
    const payload = saveQuizQuestion.mock.calls[0]?.[0] as QuizQuestion;
    expect(payload.conceptId).toBe("bayes");
    expect(onSaved).toHaveBeenCalled();
  });

  it("Concept をなしに戻して保存すると conceptId を付けない", async () => {
    const user = userEvent.setup();
    render(
      <QuizQuestionFormModal
        open
        mode="edit"
        question={existingQuestion}
        concepts={concepts}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: "クリア" }));
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(saveQuizQuestion).toHaveBeenCalledTimes(1);
    });
    const payload = saveQuizQuestion.mock.calls[0]?.[0] as QuizQuestion;
    expect(payload.conceptId).toBeUndefined();
  });

  it("入力式を選ぶと選択肢UIを隠し、模範解答必須で保存する", async () => {
    const user = userEvent.setup();
    render(
      <QuizQuestionFormModal
        open
        mode="create"
        concepts={concepts}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: "入力式" }));
    expect(screen.queryByText("選択肢 *（2件以上）")).not.toBeInTheDocument();
    await user.type(screen.getByPlaceholderText("問いを入力…"), "教師あり学習とは？");
    await user.click(screen.getByRole("button", { name: "保存" }));
    expect(saveQuizQuestion).not.toHaveBeenCalled();
    expect(screen.getByText("模範解答を入力してください。")).toBeInTheDocument();

    await user.type(screen.getByLabelText("模範解答"), "ラベル付きデータで学習する");
    await user.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => {
      expect(saveQuizQuestion).toHaveBeenCalledTimes(1);
    });
    const payload = saveQuizQuestion.mock.calls[0]?.[0] as QuizQuestion;
    expect(payload.questionType).toBe("free-response");
    expect(payload.choices).toEqual([]);
    expect(payload.correctChoiceId).toBe("");
    expect(payload.referenceAnswer).toBe("ラベル付きデータで学習する");
    expect(payload.keywords).toBeUndefined();
    expect(payload.schemaVersion).toBe(QUIZ_QUESTION_SCHEMA_VERSION);
  });

  it("入力式の採点補助キーワードを1行1件で正規化して保存する", async () => {
    const user = userEvent.setup();
    render(
      <QuizQuestionFormModal
        open
        mode="create"
        concepts={concepts}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: "入力式" }));
    await user.type(screen.getByPlaceholderText("問いを入力…"), "教師あり学習とは？");
    await user.type(screen.getByLabelText("模範解答"), "ラベル付きデータで学習する");
    await user.type(screen.getByLabelText("採点補助キーワード"), " 学習 \n入力\n\n学習");
    await user.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => {
      expect(saveQuizQuestion).toHaveBeenCalledTimes(1);
    });
    const payload = saveQuizQuestion.mock.calls[0]?.[0] as QuizQuestion;
    expect(payload.keywords).toEqual(["学習", "入力"]);
  });

  it("入力式から四択へ切り替えて保存すると keywords を残さない", async () => {
    const user = userEvent.setup();
    const freeResponse: QuizQuestion = {
      ...existingQuestion,
      questionType: "free-response",
      referenceAnswer: "模範",
      keywords: ["入力", "学習"],
      schemaVersion: 2
    };
    render(
      <QuizQuestionFormModal
        open
        mode="edit"
        question={freeResponse}
        concepts={concepts}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );

    expect(screen.getByLabelText("採点補助キーワード")).toHaveValue("入力\n学習");
    await user.click(screen.getByRole("button", { name: "四択" }));
    await user.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => {
      expect(saveQuizQuestion).toHaveBeenCalledTimes(1);
    });
    const payload = saveQuizQuestion.mock.calls[0]?.[0] as QuizQuestion;
    expect(payload.questionType).toBe("multiple-choice");
    expect(payload.keywords).toBeUndefined();
    expect(payload.schemaVersion).toBe(QUIZ_QUESTION_SCHEMA_VERSION);
  });


  it("候補が開いている Escape では Modal を閉じず、もう一度 Escape で閉じる", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <QuizQuestionFormModal
        open
        mode="create"
        concepts={concepts}
        onClose={onClose}
        onSaved={vi.fn()}
      />
    );

    const dialog = screen.getByRole("dialog", { name: "クイズを作成" });
    await user.type(
      within(dialog).getByRole("combobox", { name: "Conceptを検索（タイトル・分野タグで絞り込み）" }),
      "ベイズ"
    );
    await waitFor(() => {
      expect(screen.getByRole("option", { name: /ベイズ推論/ })).toBeInTheDocument();
    });

    await user.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
    expect(dialog).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
