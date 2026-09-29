import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  QUIZ_DECK_SCHEMA_VERSION,
  QUIZ_QUESTION_SCHEMA_VERSION,
  type QuizDeck,
  type QuizQuestion
} from "../types/quiz";
import { QuizDeckMembershipConflictError } from "../storage/quizDeckQuestionIds";

const storage = vi.hoisted(() => ({
  saveQuizDeck: vi.fn(),
  saveQuizDeckMetadata: vi.fn(async (deck: QuizDeck) => deck),
  addQuestionsToDeck: vi.fn(),
  removeQuestionsFromDeck: vi.fn(),
  reorderQuizDeckQuestions: vi.fn(),
  getQuizDeck: vi.fn(async () => undefined as QuizDeck | undefined),
  saveQuizQuestionAndAppendToDeck: vi.fn()
}));

vi.mock("../storage", () => ({
  getStorage: () => storage,
  getContextStorage: () => ({
    getAllContextCards: vi.fn(async () => [])
  })
}));

import { QuizDeckFormModal } from "./QuizDeckFormModal";

const iso = "2026-01-01T00:00:00.000Z";

const question = (id: string, prompt: string): QuizQuestion => ({
  id,
  questionType: "multiple-choice",
  prompt,
  choices: [
    { id: "a", text: "A" },
    { id: "b", text: "B" }
  ],
  correctChoiceId: "a",
  visibility: "private",
  schemaVersion: QUIZ_QUESTION_SCHEMA_VERSION,
  createdAt: iso,
  updatedAt: iso
});

const deck = (questionIds: string[], extras: Partial<QuizDeck> = {}): QuizDeck => ({
  id: "deck_1",
  title: "既存のクイズ集",
  questionIds,
  visibility: "private",
  schemaVersion: QUIZ_DECK_SCHEMA_VERSION,
  createdAt: iso,
  updatedAt: iso,
  ...extras
});

const renderModal = (initial: QuizDeck, questions: QuizQuestion[]) => {
  const onReload = vi.fn(async () => undefined);
  render(
    <QuizDeckFormModal
      open
      initialDeck={initial}
      concepts={[]}
      allQuestions={questions}
      onClose={vi.fn()}
      onReload={onReload}
    />
  );
  return { onReload };
};

describe("QuizDeckFormModal membership intents", () => {
  beforeEach(() => {
    storage.saveQuizDeck.mockReset();
    storage.saveQuizDeckMetadata.mockReset();
    storage.saveQuizDeckMetadata.mockImplementation(async (next) => next);
    storage.addQuestionsToDeck.mockReset();
    storage.removeQuestionsFromDeck.mockReset();
    storage.reorderQuizDeckQuestions.mockReset();
    storage.getQuizDeck.mockReset();
    storage.getQuizDeck.mockResolvedValue(undefined);
    vi.stubGlobal("alert", vi.fn());
  });

  it("既存問題の追加は add intent を送り、Deck 全体は保存しない", async () => {
    const user = userEvent.setup();
    const initial = deck(["q-a"]);
    storage.addQuestionsToDeck.mockResolvedValue(deck(["q-a", "q-b"]));
    renderModal(initial, [question("q-a", "問題A"), question("q-b", "問題B")]);

    await user.click(screen.getByRole("button", { name: "既存の問題を追加" }));
    await user.click(screen.getByRole("button", { name: "追加" }));

    expect(storage.addQuestionsToDeck).toHaveBeenCalledWith("deck_1", ["q-b"]);
    expect(storage.saveQuizDeck).not.toHaveBeenCalled();
    expect(await screen.findByText("問題B")).toBeInTheDocument();
  });

  it("Deck から外す操作は remove intent を送る", async () => {
    const user = userEvent.setup();
    storage.removeQuestionsFromDeck.mockResolvedValue(deck(["q-b"]));
    renderModal(deck(["q-a", "q-b"]), [question("q-a", "問題A"), question("q-b", "問題B")]);

    await user.click(screen.getAllByRole("button", { name: "Deckから外す" })[0]);

    expect(storage.removeQuestionsFromDeck).toHaveBeenCalledWith("deck_1", ["q-a"]);
    expect(storage.saveQuizDeck).not.toHaveBeenCalled();
  });

  it("並び替えは expected snapshot と next order を送る", async () => {
    const user = userEvent.setup();
    storage.reorderQuizDeckQuestions.mockResolvedValue(deck(["q-b", "q-a"]));
    renderModal(deck(["q-a", "q-b"]), [question("q-a", "問題A"), question("q-b", "問題B")]);

    await user.click(screen.getByRole("button", { name: "問題 1 を下へ" }));

    expect(storage.reorderQuizDeckQuestions).toHaveBeenCalledWith(
      "deck_1",
      ["q-a", "q-b"],
      ["q-b", "q-a"]
    );
    expect(storage.saveQuizDeck).not.toHaveBeenCalled();
  });

  it("並び替えの競合では最新 Deck を読み直す", async () => {
    const user = userEvent.setup();
    storage.reorderQuizDeckQuestions.mockRejectedValue(new QuizDeckMembershipConflictError());
    storage.getQuizDeck.mockResolvedValue(deck(["q-a", "q-b", "q-c"]));
    renderModal(deck(["q-a", "q-b"]), [question("q-a", "問題A"), question("q-b", "問題B")]);

    await user.click(screen.getByRole("button", { name: "問題 1 を下へ" }));

    expect(window.alert).toHaveBeenCalledWith(
      "別の更新と問題の並びが競合しました。最新のクイズ集を読み込み直します。"
    );
    expect(storage.getQuizDeck).toHaveBeenCalledWith("deck_1");
    expect(await screen.findByText("q-c")).toBeInTheDocument();
  });

  it("タイトル保存は metadata API を使い questionIds の whole-object 保存をしない", async () => {
    const user = userEvent.setup();
    renderModal(deck(["q-a"]), [question("q-a", "問題A")]);

    await user.clear(screen.getByLabelText("クイズ集タイトル *"));
    await user.type(screen.getByLabelText("クイズ集タイトル *"), "更新後タイトル");
    await user.click(screen.getByRole("button", { name: "クイズ集を保存" }));

    expect(storage.saveQuizDeckMetadata).toHaveBeenCalled();
    const payload = storage.saveQuizDeckMetadata.mock.calls.at(-1)?.[0] as QuizDeck;
    expect(payload.title).toBe("更新後タイトル");
    expect(storage.saveQuizDeck).not.toHaveBeenCalled();
    expect(storage.addQuestionsToDeck).not.toHaveBeenCalled();
    expect(storage.removeQuestionsFromDeck).not.toHaveBeenCalled();
    expect(storage.reorderQuizDeckQuestions).not.toHaveBeenCalled();
  });
});
