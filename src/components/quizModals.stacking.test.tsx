import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { QuizDeck } from "../types/quiz";
import { QUIZ_DECK_SCHEMA_VERSION } from "../types/quiz";

const { saveQuizDeck, getQuizDeck, getAllContextCards } = vi.hoisted(() => ({
  saveQuizDeck: vi.fn(async () => undefined),
  getQuizDeck: vi.fn(async () => undefined),
  getAllContextCards: vi.fn(async () => [])
}));

vi.mock("../storage", () => {
  const storage = {
    saveQuizDeck,
    getQuizDeck,
    getAllContextCards,
    saveQuizQuestion: vi.fn(async () => undefined),
    deleteQuizQuestion: vi.fn(async () => undefined)
  };
  return {
    getStorage: () => storage,
    getContextStorage: () => storage
  };
});

import { QuizCreateModal } from "./QuizCreateModal";
import { QuizDeckFormModal } from "./QuizDeckFormModal";
import { QuizDeckSyncModal } from "./QuizDeckSyncModal";
import { QuizQuestionFormModal } from "./QuizQuestionFormModal";

const sampleDeck: QuizDeck = {
  id: "deck_1",
  title: "既存のクイズ集",
  questionIds: [],
  visibility: "private",
  schemaVersion: QUIZ_DECK_SCHEMA_VERSION,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
};

const renderInsideAppShell = (ui: ReactNode) =>
  render(
    <>
      <header className="relative z-30">Concept Book App</header>
      <main className="relative z-10">{ui}</main>
    </>
  );

const assertDialogPortaledToBody = (dialog: HTMLElement) => {
  expect(dialog.parentElement).toBe(document.body);
  expect(document.querySelector("main")?.contains(dialog)).toBe(false);
};

describe("quiz modal stacking", () => {
  beforeEach(() => {
    saveQuizDeck.mockClear();
    getQuizDeck.mockClear();
    getAllContextCards.mockClear();
    vi.stubGlobal("alert", vi.fn());
  });

  it("QuizCreateModal の overlay を main 配下ではなく document.body へ portal する", () => {
    const onClose = vi.fn();
    renderInsideAppShell(
      <QuizCreateModal
        open
        concepts={[]}
        allQuestions={[]}
        onClose={onClose}
        onSaved={vi.fn()}
      />
    );

    const dialog = screen.getByRole("dialog");
    assertDialogPortaledToBody(dialog);
    expect(dialog.className).toContain("z-50");
    expect(screen.getByRole("heading", { name: "クイズを作成" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /文脈別カードから作成/ })).toBeInTheDocument();
  });

  it("QuizCreateModal の閉じるをクリックすると onClose が呼ばれる", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderInsideAppShell(
      <QuizCreateModal
        open
        concepts={[]}
        allQuestions={[]}
        onClose={onClose}
        onSaved={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: "閉じる" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("QuizQuestionFormModal の overlay を document.body へ portal し、閉じるで onClose する", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderInsideAppShell(
      <QuizQuestionFormModal
        open
        mode="create"
        concepts={[]}
        onClose={onClose}
        onSaved={vi.fn()}
      />
    );

    const dialog = screen.getByRole("dialog", { name: "クイズを作成" });
    assertDialogPortaledToBody(dialog);
    expect(dialog.className).toContain("z-50");
    await user.click(within(dialog).getByRole("button", { name: "閉じる" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("QuizDeckFormModal の create / edit を portal し、閉じるで onClose する", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { rerender } = renderInsideAppShell(
      <QuizDeckFormModal
        open
        initialDeck={null}
        concepts={[]}
        allQuestions={[]}
        onClose={onClose}
        onReload={vi.fn(async () => undefined)}
      />
    );

    const createDialog = screen.getByRole("dialog", { name: "新規クイズ集" });
    assertDialogPortaledToBody(createDialog);
    expect(screen.getByRole("button", { name: "保存して閉じる" })).toBeInTheDocument();

    rerender(
      <>
        <header className="relative z-30">Concept Book App</header>
        <main className="relative z-10">
          <QuizDeckFormModal
            open
            initialDeck={sampleDeck}
            concepts={[]}
            allQuestions={[]}
            onClose={onClose}
            onReload={vi.fn(async () => undefined)}
          />
        </main>
      </>
    );

    const editDialog = screen.getByRole("dialog", { name: "クイズ集を編集" });
    assertDialogPortaledToBody(editDialog);
    await user.click(within(editDialog).getByRole("button", { name: "閉じる" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("QuizDeckFormModal から QuizQuestionFormModal を開くと Question が前面に portal される", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderInsideAppShell(
      <QuizDeckFormModal
        open
        initialDeck={null}
        concepts={[]}
        allQuestions={[]}
        onClose={onClose}
        onReload={vi.fn(async () => undefined)}
      />
    );

    await user.type(screen.getByLabelText("クイズ集タイトル *"), "テスト集");
    await user.click(screen.getByRole("button", { name: "新しい問題を追加" }));

    const questionDialog = await screen.findByRole("dialog", { name: "クイズを作成" });
    const deckDialog = screen.getByRole("dialog", { name: "新規クイズ集" });
    assertDialogPortaledToBody(deckDialog);
    assertDialogPortaledToBody(questionDialog);
    expect(saveQuizDeck).toHaveBeenCalled();
    expect(
      deckDialog.compareDocumentPosition(questionDialog) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();

    await user.click(within(questionDialog).getByRole("button", { name: "閉じる" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "クイズを作成" })).not.toBeInTheDocument();
    });
    expect(screen.getByRole("dialog", { name: "新規クイズ集" })).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("QuizDeckSyncModal の overlay を document.body へ portal し、閉じるで onClose する", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderInsideAppShell(
      <QuizDeckSyncModal
        open
        deck={sampleDeck}
        concepts={[]}
        allQuestions={[]}
        onClose={onClose}
        onSynced={vi.fn()}
      />
    );

    const dialog = screen.getByRole("dialog", { name: "クイズ集を更新" });
    assertDialogPortaledToBody(dialog);
    expect(dialog.className).toContain("z-50");
    expect(screen.getByText(/「既存のクイズ集」の出題条件/)).toBeInTheDocument();
    await user.click(within(dialog).getAllByRole("button", { name: "閉じる" })[0]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
