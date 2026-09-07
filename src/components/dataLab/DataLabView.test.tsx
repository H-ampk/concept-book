import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createEmptyConceptInput, type Concept } from "../../types/concept";
import { QUIZ_ATTEMPT_LOG_SCHEMA_VERSION, type QuizAttemptLog, type QuizDeck } from "../../types/quiz";
import { DataLabView } from "./DataLabView";

const log = (overrides: Partial<QuizAttemptLog> = {}): QuizAttemptLog => ({
  id: "log-1",
  questionId: "q1",
  questionPromptSnapshot: "問い",
  selectedChoiceId: "c1",
  selectedChoiceTextSnapshot: "選択",
  correctChoiceId: "c2",
  correctChoiceTextSnapshot: "正解",
  correct: true,
  startedAt: "2026-08-15T03:00:00.000Z",
  answeredAt: "2026-08-15T03:00:01.000Z",
  timeMs: 10,
  schemaVersion: QUIZ_ATTEMPT_LOG_SCHEMA_VERSION,
  conceptId: "concept-a",
  ...overrides
});

const concept = (overrides: Partial<Concept> = {}): Concept => ({
  ...createEmptyConceptInput(),
  id: "concept-a",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  title: "人工知能",
  domainTags: ["情報科学"],
  ...overrides
});

const deck = (overrides: Partial<QuizDeck> = {}): QuizDeck => ({
  id: "deck-1",
  title: "AI基礎",
  questionIds: [],
  visibility: "private",
  schemaVersion: 1,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides
});

const twoLogs: QuizAttemptLog[] = [
  log({ id: "ok", correct: true, deckId: "deck-1" }),
  log({ id: "ng", correct: false, deckId: "deck-1" })
];

describe("DataLabView (#89 / #90)", () => {
  it("基本領域（ヘッダー・フィルタ・分析条件・結果）を表示する", () => {
    render(
      <DataLabView
        logs={twoLogs}
        concepts={[concept()]}
        decks={[deck()]}
        loading={false}
        error={false}
        onBack={vi.fn()}
      />
    );

    expect(screen.getByRole("heading", { name: "Data Lab" })).toBeInTheDocument();
    expect(screen.getByText("学習ログを条件指定して探索・分析します。")).toBeInTheDocument();
    expect(screen.getByTestId("data-lab-log-count")).toHaveTextContent("2 / 2");
    expect(screen.getByRole("heading", { name: "Filters" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "分析条件" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "分析結果" })).toBeInTheDocument();
    expect(screen.getByTestId("data-lab-aggregate-summary")).toHaveTextContent("集計軸: Concept");
    expect(screen.getByTestId("data-lab-aggregate-summary")).toHaveTextContent("対象ログ: 2件");
    expect(screen.getByTestId("data-lab-table")).toBeInTheDocument();
    expect(screen.getByLabelText("開始日")).toBeEnabled();
    expect(screen.getByLabelText("集計軸")).toBeEnabled();
    expect(screen.getByLabelText("集計軸")).toHaveValue("concept");
  });

  it("ログ0件で空状態になる", () => {
    render(
      <DataLabView logs={[]} concepts={[]} decks={[]} loading={false} error={false} onBack={vi.fn()} />
    );

    expect(screen.getByTestId("data-lab-log-count")).toHaveTextContent("0 / 0");
    expect(screen.getByText("まだ分析できる学習データがありません。")).toBeInTheDocument();
    expect(screen.queryByText(/条件に一致する学習ログは/)).not.toBeInTheDocument();
  });

  it("フィルタ結果0件は通常の空状態と区別し、リセットで全件に戻る", async () => {
    const user = userEvent.setup();
    const allCorrect = [log({ id: "ok-1", correct: true }), log({ id: "ok-2", correct: true })];
    render(
      <DataLabView
        logs={allCorrect}
        concepts={[concept()]}
        decks={[deck()]}
        loading={false}
        error={false}
        onBack={vi.fn()}
      />
    );

    await user.selectOptions(screen.getByLabelText("回答結果"), "incorrect");
    expect(screen.getByTestId("data-lab-log-count")).toHaveTextContent("0 / 2");
    expect(screen.getByText("条件に一致する学習データがありません。")).toBeInTheDocument();
    expect(screen.getByText("フィルタ条件を変更してください。")).toBeInTheDocument();
    expect(screen.queryByText("まだ分析できる学習データがありません。")).not.toBeInTheDocument();
    expect(screen.getByTestId("data-lab-active-filters")).toHaveTextContent("誤答のみ");

    await user.click(screen.getByRole("button", { name: "条件をリセット" }));
    expect(screen.getByTestId("data-lab-log-count")).toHaveTextContent("2 / 2");
    expect(screen.getByTestId("data-lab-table")).toBeInTheDocument();
  });

  it("6集計軸を切り替え、先頭列名とラベルを表示する", async () => {
    const user = userEvent.setup();
    render(
      <DataLabView
        logs={twoLogs}
        concepts={[concept()]}
        decks={[deck()]}
        loading={false}
        error={false}
        onBack={vi.fn()}
      />
    );

    const table = () => screen.getByTestId("data-lab-table");
    expect(screen.getByRole("button", { name: "Conceptで並べ替え" })).toBeInTheDocument();
    expect(within(table()).getByRole("rowheader", { name: "人工知能" })).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("集計軸"), "domain");
    expect(screen.getByRole("button", { name: "分野で並べ替え" })).toBeInTheDocument();
    expect(within(table()).getByRole("rowheader", { name: "情報科学" })).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("集計軸"), "deck");
    expect(screen.getByRole("button", { name: "Deckで並べ替え" })).toBeInTheDocument();
    expect(within(table()).getByRole("rowheader", { name: "AI基礎" })).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("集計軸"), "day");
    expect(screen.getByRole("button", { name: "日付で並べ替え" })).toBeInTheDocument();
    expect(within(table()).getAllByRole("rowheader")).toHaveLength(1);

    await user.selectOptions(screen.getByLabelText("集計軸"), "week");
    expect(screen.getByRole("button", { name: "週で並べ替え" })).toBeInTheDocument();
    expect(within(table()).getAllByRole("rowheader")).toHaveLength(1);

    await user.selectOptions(screen.getByLabelText("集計軸"), "month");
    expect(screen.getByRole("button", { name: "月で並べ替え" })).toBeInTheDocument();
    expect(within(table()).getAllByRole("rowheader")).toHaveLength(1);
  });

  it("loading 状態を表示する", () => {
    render(
      <DataLabView logs={[]} concepts={[]} decks={[]} loading={true} error={false} onBack={vi.fn()} />
    );

    expect(screen.getByRole("status")).toHaveTextContent("読み込み中…");
    expect(screen.queryByRole("heading", { name: "Filters" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "分析結果" })).not.toBeInTheDocument();
  });

  it("読み込み失敗時はエラーメッセージを表示する", () => {
    render(
      <DataLabView logs={[]} concepts={[]} decks={[]} loading={false} error={true} onBack={vi.fn()} />
    );

    expect(screen.getByRole("alert")).toHaveTextContent("学習データを読み込めませんでした。");
    expect(screen.queryByRole("heading", { name: "分析結果" })).not.toBeInTheDocument();
  });
});
