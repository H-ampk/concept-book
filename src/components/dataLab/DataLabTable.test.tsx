import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { DataLabAggregateRow } from "../../utils/dataLab/aggregateDataLabLogs";
import { shortDateTime } from "../../utils/date";
import { DataLabTable } from "./DataLabTable";

const row = (overrides: Partial<DataLabAggregateRow> & Pick<DataLabAggregateRow, "key" | "label">): DataLabAggregateRow => ({
  groupBy: "concept",
  attemptCount: 1,
  correctCount: 1,
  incorrectCount: 0,
  accuracy: 1,
  averageResponseTimeMs: 1000,
  firstAttemptAt: "2026-01-01T00:00:00.000Z",
  lastAttemptAt: "2026-01-01T00:00:00.000Z",
  ...overrides
});

const sampleRows: DataLabAggregateRow[] = [
  row({
    key: "beta",
    label: "ベータ",
    attemptCount: 2,
    correctCount: 1,
    incorrectCount: 1,
    accuracy: 0.5,
    averageResponseTimeMs: 3000,
    lastAttemptAt: "2026-01-02T00:00:00.000Z"
  }),
  row({
    key: "alpha",
    label: "アルファ",
    attemptCount: 9,
    correctCount: 7,
    incorrectCount: 2,
    accuracy: 0.778,
    averageResponseTimeMs: 4200,
    lastAttemptAt: "2026-09-01T12:00:00.000Z"
  }),
  row({
    key: "missing",
    label: "欠損",
    attemptCount: 1,
    correctCount: 0,
    incorrectCount: 1,
    accuracy: null,
    averageResponseTimeMs: null,
    lastAttemptAt: null
  })
];

const labels = () =>
  within(screen.getByTestId("data-lab-table"))
    .getAllByRole("row")
    .slice(1)
    .map((tableRow) => within(tableRow).getAllByRole("rowheader")[0].textContent);

describe("DataLabTable", () => {
  it("集計軸に応じて先頭列名を変える", () => {
    const { rerender } = render(<DataLabTable rows={sampleRows} groupBy="concept" />);
    expect(screen.getByRole("button", { name: "Conceptで並べ替え" })).toBeInTheDocument();

    rerender(<DataLabTable rows={sampleRows} groupBy="domain" />);
    expect(screen.getByRole("button", { name: "分野で並べ替え" })).toBeInTheDocument();

    rerender(<DataLabTable rows={sampleRows} groupBy="deck" />);
    expect(screen.getByRole("button", { name: "Deckで並べ替え" })).toBeInTheDocument();

    rerender(<DataLabTable rows={sampleRows} groupBy="day" />);
    expect(screen.getByRole("button", { name: "日付で並べ替え" })).toBeInTheDocument();

    rerender(<DataLabTable rows={sampleRows} groupBy="week" />);
    expect(screen.getByRole("button", { name: "週で並べ替え" })).toBeInTheDocument();

    rerender(<DataLabTable rows={sampleRows} groupBy="month" />);
    expect(screen.getByRole("button", { name: "月で並べ替え" })).toBeInTheDocument();
  });

  it("Concept 集計だけ理解度列を出し、百分率表示する", () => {
    const rows = [
      row({
        key: "alpha",
        label: "アルファ",
        masteryProbability: 0.821
      }),
      row({
        key: "missing",
        label: "欠損",
        masteryProbability: null
      })
    ];
    const { rerender } = render(<DataLabTable rows={rows} groupBy="concept" />);
    expect(screen.getByRole("button", { name: "理解度で並べ替え" })).toBeInTheDocument();
    expect(screen.getByText("82%")).toBeInTheDocument();
    expect(screen.queryByText("0%")).not.toBeInTheDocument();

    rerender(<DataLabTable rows={rows} groupBy="domain" />);
    expect(screen.queryByRole("button", { name: "理解度で並べ替え" })).not.toBeInTheDocument();
  });

  it("理解度を生数値でソートし、null は最後にする", async () => {
    const user = userEvent.setup();
    const rows = [
      row({ key: "mid", label: "中", masteryProbability: 0.5 }),
      row({ key: "high", label: "高", masteryProbability: 0.9 }),
      row({ key: "missing", label: "欠損", masteryProbability: null })
    ];
    render(<DataLabTable rows={rows} groupBy="concept" />);
    const header = screen.getByRole("button", { name: "理解度で並べ替え" });
    await user.click(header);
    expect(labels()).toEqual(["中", "高", "欠損"]);
    await user.click(header);
    expect(labels()).toEqual(["高", "中", "欠損"]);
  });

  it("row.label と formatter を表示する", () => {
    render(<DataLabTable rows={sampleRows} groupBy="concept" />);
    expect(screen.getByText("アルファ")).toBeInTheDocument();
    expect(screen.getByText("77.8%")).toBeInTheDocument();
    expect(screen.getByText("4.2秒")).toBeInTheDocument();
    expect(screen.getAllByText("—")).toHaveLength(6);
    expect(screen.getByText(shortDateTime("2026-09-01T12:00:00.000Z"))).toBeInTheDocument();
  });

  it("未ソート時は aggregatedRows の順序を維持する", () => {
    render(<DataLabTable rows={sampleRows} groupBy="concept" />);
    expect(labels()).toEqual(["ベータ", "アルファ", "欠損"]);
  });

  it("列クリックで asc / desc を切り替え、数値列は生値で並べる", async () => {
    const user = userEvent.setup();
    render(<DataLabTable rows={sampleRows} groupBy="concept" />);

    const attemptHeader = screen.getByRole("button", { name: "回答数で並べ替え" });
    await user.click(attemptHeader);
    expect(labels()).toEqual(["欠損", "ベータ", "アルファ"]);
    expect(attemptHeader).toHaveTextContent("回答数 ↑");
    expect(attemptHeader.closest("th")).toHaveAttribute("aria-sort", "ascending");

    await user.click(attemptHeader);
    expect(labels()).toEqual(["アルファ", "ベータ", "欠損"]);
    expect(attemptHeader).toHaveTextContent("回答数 ↓");
    expect(attemptHeader.closest("th")).toHaveAttribute("aria-sort", "descending");
  });

  it("正答率ソートでは null が最後になる", async () => {
    const user = userEvent.setup();
    render(<DataLabTable rows={sampleRows} groupBy="concept" />);
    await user.click(screen.getByRole("button", { name: "正答率で並べ替え" }));
    expect(labels()).toEqual(["ベータ", "アルファ", "欠損"]);
    await user.click(screen.getByRole("button", { name: "正答率で並べ替え" }));
    expect(labels()).toEqual(["アルファ", "ベータ", "欠損"]);
  });

  it("groupBy 変更時に手動ソートを解除する", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<DataLabTable rows={sampleRows} groupBy="concept" />);
    await user.click(screen.getByRole("button", { name: "回答数で並べ替え" }));
    expect(labels()).toEqual(["欠損", "ベータ", "アルファ"]);

    rerender(<DataLabTable rows={sampleRows} groupBy="day" />);
    expect(labels()).toEqual(["ベータ", "アルファ", "欠損"]);
    expect(screen.getByRole("button", { name: "回答数で並べ替え" })).toHaveTextContent("回答数");
  });
});
