import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createEmptyConceptInput, type Concept } from "../../types/concept";
import { QUIZ_ATTEMPT_LOG_SCHEMA_VERSION, type QuizAttemptLog, type QuizDeck } from "../../types/quiz";
import { getConceptMastery } from "../../utils/mastery/getConceptMastery";
import { formatConceptMasteryProbability } from "../../utils/mastery/formatConceptMastery";
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
    expect(screen.getByRole("heading", { name: "CSV エクスポート" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "研究レポート" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "研究レポートに追加" })).toBeEnabled();
    expect(screen.getByRole("heading", { name: "分析結果" })).toBeInTheDocument();
    expect(screen.getByTestId("data-lab-aggregate-summary")).toHaveTextContent("集計軸: Concept");
    expect(screen.getByTestId("data-lab-aggregate-summary")).toHaveTextContent("対象ログ: 2件");
    expect(screen.getByTestId("data-lab-table")).toBeInTheDocument();
    expect(screen.getByLabelText("開始日")).toBeEnabled();
    expect(screen.getByLabelText("集計軸")).toBeEnabled();
    expect(screen.getByLabelText("集計軸")).toHaveValue("concept");
    expect(screen.getByLabelText("指標")).toBeEnabled();
    expect(screen.getByLabelText("指標")).toHaveValue("accuracy");
    expect(screen.getByLabelText("表示")).toBeEnabled();
    expect(screen.getByLabelText("表示")).toHaveValue("table");
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

  it("表示selectに棒グラフがあり、Concept/分野/Deckで描画し、日では案内、指標・並び・件数を変え、テーブルと折れ線に戻せる", async () => {
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

    const displaySelect = screen.getByLabelText("表示");
    expect(within(displaySelect).getByRole("option", { name: "棒グラフ" })).toBeInTheDocument();

    await user.selectOptions(displaySelect, "bar");
    expect(screen.getByTestId("data-lab-bar-chart")).toBeInTheDocument();
    expect(screen.getByLabelText("並び順")).toHaveValue("valueDesc");
    expect(screen.getByLabelText("表示件数")).toHaveValue("10");

    await user.selectOptions(screen.getByLabelText("集計軸"), "domain");
    expect(screen.getByTestId("data-lab-bar-chart")).toBeInTheDocument();
    expect(screen.getByText("※ 複数分野を持つ Concept は各分野に重複して集計されます。")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("集計軸"), "deck");
    expect(screen.getByTestId("data-lab-bar-chart")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("集計軸"), "day");
    expect(screen.getByText("棒グラフでは Concept・分野・Deck 単位の集計を選択してください。")).toBeInTheDocument();
    expect(screen.queryByTestId("data-lab-bar-chart")).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("集計軸"), "concept");
    await user.selectOptions(screen.getByLabelText("指標"), "attemptCount");
    expect(screen.getByTestId("data-lab-aggregate-summary")).toHaveTextContent("指標: 回答数");
    expect(screen.getByTestId("data-lab-bar-chart")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("並び順"), "valueAsc");
    expect(screen.getByLabelText("並び順")).toHaveValue("valueAsc");
    await user.selectOptions(screen.getByLabelText("表示件数"), "20");
    expect(screen.getByLabelText("表示件数")).toHaveValue("20");

    await user.selectOptions(displaySelect, "table");
    expect(screen.getByTestId("data-lab-table")).toBeInTheDocument();
    expect(screen.queryByTestId("data-lab-bar-chart")).not.toBeInTheDocument();

    await user.selectOptions(displaySelect, "line");
    await user.selectOptions(screen.getByLabelText("集計軸"), "day");
    expect(screen.getByTestId("data-lab-line-chart")).toBeInTheDocument();
  });

  it("表示selectに散布図があり、Concept/分野/Deckで描画し、日では案内、X/Yを変えられ、同じ指標は選べない", async () => {
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

    const displaySelect = screen.getByLabelText("表示");
    expect(within(displaySelect).getByRole("option", { name: "散布図" })).toBeInTheDocument();

    await user.selectOptions(displaySelect, "scatter");
    expect(screen.getByTestId("data-lab-scatter-plot")).toBeInTheDocument();
    expect(screen.getByLabelText("X軸")).toBeInTheDocument();
    expect(screen.getByLabelText("Y軸")).toBeInTheDocument();
    expect(screen.getByLabelText("X軸")).toHaveValue("averageResponseTimeMs");
    expect(screen.getByLabelText("Y軸")).toHaveValue("accuracy");
    expect(screen.getByLabelText("X軸")).not.toHaveValue("accuracy");
    expect(screen.queryByLabelText("指標")).not.toBeInTheDocument();

    const ySameAsX = within(screen.getByLabelText("Y軸")).getByRole("option", { name: "平均回答時間" });
    expect(ySameAsX).toBeDisabled();
    const xSameAsY = within(screen.getByLabelText("X軸")).getByRole("option", { name: "正答率" });
    expect(xSameAsY).toBeDisabled();

    await user.selectOptions(screen.getByLabelText("集計軸"), "domain");
    expect(screen.getByTestId("data-lab-scatter-plot")).toBeInTheDocument();
    expect(screen.getByText("※ 複数分野を持つ Concept は各分野に重複して集計されます。")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("集計軸"), "deck");
    expect(screen.getByTestId("data-lab-scatter-plot")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("集計軸"), "day");
    expect(screen.getByText("散布図では Concept・分野・Deck 単位の集計を選択してください。")).toBeInTheDocument();
    expect(screen.queryByTestId("data-lab-scatter-plot")).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("集計軸"), "week");
    expect(screen.getByTestId("data-lab-scatter-plot-unsupported")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("集計軸"), "month");
    expect(screen.getByTestId("data-lab-scatter-plot-unsupported")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("集計軸"), "concept");
    await user.selectOptions(screen.getByLabelText("X軸"), "attemptCount");
    expect(screen.getByLabelText("X軸")).toHaveValue("attemptCount");
    expect(screen.getByLabelText("Y軸")).toHaveValue("accuracy");
    expect(screen.getByTestId("data-lab-aggregate-summary")).toHaveTextContent("X軸: 回答数");
    expect(screen.getByTestId("data-lab-aggregate-summary")).toHaveTextContent("Y軸: 正答率");

    await user.selectOptions(displaySelect, "table");
    expect(screen.getByTestId("data-lab-table")).toBeInTheDocument();
    expect(screen.queryByTestId("data-lab-scatter-plot")).not.toBeInTheDocument();

    await user.selectOptions(displaySelect, "scatter");
    expect(screen.getByLabelText("X軸")).toHaveValue("attemptCount");
    expect(screen.getByLabelText("Y軸")).toHaveValue("accuracy");
  });

  it("折れ線グラフ表示は日集計でグラフ、Conceptでは案内、テーブルに戻せる", async () => {
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

    await user.selectOptions(screen.getByLabelText("表示"), "line");
    expect(screen.getByText("折れ線グラフでは日・週・月単位の集計を選択してください。")).toBeInTheDocument();
    expect(screen.getByLabelText("集計軸")).toHaveValue("concept");

    await user.selectOptions(screen.getByLabelText("集計軸"), "day");
    expect(screen.getByTestId("data-lab-line-chart")).toBeInTheDocument();
    expect(screen.queryByTestId("data-lab-table")).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("表示"), "table");
    expect(screen.getByTestId("data-lab-table")).toBeInTheDocument();
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

  it("初期状態で CSV エクスポート UI を表示し、対象を切り替えられる", async () => {
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

    expect(screen.getByLabelText("CSVエクスポート対象")).toHaveValue("aggregate");
    expect(screen.getByTestId("data-lab-export-summary")).toHaveTextContent("出力対象: 集計結果");
    expect(screen.getByTestId("data-lab-export-summary")).toHaveTextContent("集計軸: Concept");
    expect(screen.getByTestId("data-lab-export-summary")).toHaveTextContent("件数: 1");
    expect(screen.getByRole("button", { name: "CSVを保存" })).toBeEnabled();

    await user.selectOptions(screen.getByLabelText("CSVエクスポート対象"), "logs");
    expect(screen.getByTestId("data-lab-export-summary")).toHaveTextContent("出力対象: フィルタ済みログ");
    expect(screen.getByTestId("data-lab-export-summary")).toHaveTextContent("件数: 2");
    expect(screen.getByTestId("data-lab-export-summary")).not.toHaveTextContent("集計軸:");

    await user.selectOptions(screen.getByLabelText("回答結果"), "incorrect");
    expect(screen.getByTestId("data-lab-log-count")).toHaveTextContent("1 / 2");
    expect(screen.getByTestId("data-lab-export-summary")).toHaveTextContent("件数: 1");
  });

  it("groupBy を変えるとエクスポートの集計軸表示も変わる", async () => {
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

    await user.selectOptions(screen.getByLabelText("集計軸"), "domain");
    expect(screen.getByTestId("data-lab-export-summary")).toHaveTextContent("集計軸: 分野");
    await user.selectOptions(screen.getByLabelText("集計軸"), "deck");
    expect(screen.getByTestId("data-lab-export-summary")).toHaveTextContent("集計軸: Deck");
  });

  it("0件では CSVを保存 を disabled にし、案内を出す", () => {
    render(
      <DataLabView logs={[]} concepts={[]} decks={[]} loading={false} error={false} onBack={vi.fn()} />
    );

    expect(screen.getByTestId("data-lab-export-summary")).toHaveTextContent("件数: 0");
    expect(screen.getByTestId("data-lab-export-empty")).toHaveTextContent(
      "エクスポートできるデータがありません。"
    );
    expect(screen.getByRole("button", { name: "CSVを保存" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "研究レポートに追加" })).toBeDisabled();
    expect(screen.getByTestId("data-lab-research-report-empty")).toHaveTextContent(
      "保存できる集計結果がありません。"
    );
  });
});

describe("DataLabView 理解度 (#97)", () => {
  it("Concept では理解度を選択でき、他の集計軸では出さない", async () => {
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

    expect(within(screen.getByLabelText("指標")).getByRole("option", { name: "理解度" })).toBeInTheDocument();
    expect(screen.getByTestId("data-lab-mastery-note")).toHaveTextContent(
      "理解度は現在の全学習履歴から計算されます。"
    );
    expect(screen.getByRole("button", { name: "理解度で並べ替え" })).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("集計軸"), "domain");
    expect(within(screen.getByLabelText("指標")).queryByRole("option", { name: "理解度" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("data-lab-mastery-note")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "理解度で並べ替え" })).not.toBeInTheDocument();
  });

  it("理解度選択中に groupBy を変えても不正な指標が残らない", async () => {
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

    await user.selectOptions(screen.getByLabelText("指標"), "mastery");
    expect(screen.getByLabelText("指標")).toHaveValue("mastery");
    await user.selectOptions(screen.getByLabelText("集計軸"), "day");
    expect(screen.getByLabelText("指標")).toHaveValue("accuracy");

    await user.selectOptions(screen.getByLabelText("集計軸"), "concept");
    await user.selectOptions(screen.getByLabelText("表示"), "scatter");
    await user.selectOptions(screen.getByLabelText("Y軸"), "mastery");
    expect(screen.getByLabelText("X軸")).toHaveValue("averageResponseTimeMs");
    expect(screen.getByLabelText("Y軸")).toHaveValue("mastery");
    expect(within(screen.getByLabelText("X軸")).getByRole("option", { name: "理解度" })).toBeDisabled();
    expect(within(screen.getByLabelText("Y軸")).getByRole("option", { name: "平均回答時間" })).toBeDisabled();

    await user.selectOptions(screen.getByLabelText("集計軸"), "domain");
    expect(screen.getByLabelText("X軸")).toHaveValue("averageResponseTimeMs");
    expect(screen.getByLabelText("Y軸")).toHaveValue("accuracy");
    expect(within(screen.getByLabelText("X軸")).queryByRole("option", { name: "理解度" })).not.toBeInTheDocument();
  });

  it("期間フィルタしても回答数は期間内、理解度は全ログになる", () => {
    const oldLog = log({
      id: "old",
      correct: false,
      answeredAt: new Date(2026, 0, 1, 12).toISOString()
    });
    const recentLog = log({
      id: "recent",
      correct: true,
      answeredAt: new Date(2026, 8, 5, 12).toISOString()
    });
    render(
      <DataLabView
        logs={[oldLog, recentLog]}
        concepts={[concept()]}
        decks={[deck()]}
        loading={false}
        error={false}
        onBack={vi.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText("開始日"), { target: { value: "2026-09-01" } });
    expect(screen.getByTestId("data-lab-log-count")).toHaveTextContent("1 / 2");
    const table = screen.getByTestId("data-lab-table");
    const cells = within(table).getAllByRole("cell");
    expect(cells[0]).toHaveTextContent("1");
    expect(cells[1]).toHaveTextContent("1");
    expect(cells[3]).toHaveTextContent("100%");
    const expected = formatConceptMasteryProbability(
      getConceptMastery([oldLog, recentLog], "concept-a").masteryProbability
    );
    expect(cells[4]).toHaveTextContent(expected ?? "");
    expect(cells[4]).not.toHaveTextContent("0%");
  });
});
