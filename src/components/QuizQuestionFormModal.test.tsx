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
