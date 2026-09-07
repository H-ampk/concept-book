import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { DataLabAggregateRow } from "../../utils/dataLab/aggregateDataLabLogs";
import { DataLabResultsPanel } from "./DataLabResultsPanel";

const sampleRow: DataLabAggregateRow = {
  groupBy: "concept",
  key: "c1",
  label: "概念A",
  attemptCount: 2,
  correctCount: 1,
  incorrectCount: 1,
  accuracy: 0.5,
  averageResponseTimeMs: 1000,
  firstAttemptAt: "2026-01-01T00:00:00.000Z",
  lastAttemptAt: "2026-01-01T00:00:00.000Z"
};

const dayRow: DataLabAggregateRow = {
  ...sampleRow,
  groupBy: "day",
  key: "2026-08-28",
  label: "2026-08-28",
  periodStart: "2026-08-28",
  periodEnd: "2026-08-28"
};

describe("DataLabResultsPanel 空状態", () => {
  it("学習ログ0件の空状態を表示する", () => {
    render(
      <DataLabResultsPanel
        totalLogs={0}
        displayedLogs={0}
        groupBy="concept"
        metric="accuracy"
        displayMode="table"
        aggregatedRows={[]}
      />
    );
    expect(screen.getByText("まだ分析できる学習データがありません。")).toBeInTheDocument();
    expect(screen.queryByTestId("data-lab-table")).not.toBeInTheDocument();
  });

  it("filteredLogs 0件の空状態を表示する", () => {
    render(
      <DataLabResultsPanel
        totalLogs={4}
        displayedLogs={0}
        groupBy="concept"
        metric="accuracy"
        displayMode="table"
        aggregatedRows={[]}
      />
    );
    expect(screen.getByText("条件に一致する学習データがありません。")).toBeInTheDocument();
    expect(screen.queryByText("まだ分析できる学習データがありません。")).not.toBeInTheDocument();
    expect(screen.queryByTestId("data-lab-table")).not.toBeInTheDocument();
  });

  it("filteredLogs はあるが集計行が0件の空状態を表示する", () => {
    render(
      <DataLabResultsPanel
        totalLogs={4}
        displayedLogs={2}
        groupBy="day"
        metric="accuracy"
        displayMode="table"
        aggregatedRows={[]}
      />
    );
    expect(screen.getByText("この条件では集計できるデータがありません。")).toBeInTheDocument();
    expect(screen.queryByText("まだ分析できる学習データがありません。")).not.toBeInTheDocument();
    expect(screen.queryByText("条件に一致する学習データがありません。")).not.toBeInTheDocument();
    expect(screen.queryByTestId("data-lab-table")).not.toBeInTheDocument();
  });

  it("折れ線グラフで集計行0件のときはグラフ用の空状態を表示する", () => {
    render(
      <DataLabResultsPanel
        totalLogs={4}
        displayedLogs={2}
        groupBy="day"
        metric="accuracy"
        displayMode="line"
        aggregatedRows={[]}
      />
    );
    expect(screen.getByText("この条件ではグラフに表示できるデータがありません。")).toBeInTheDocument();
  });

  it("集計行があるときはテーブルと要約を表示する", () => {
    render(
      <DataLabResultsPanel
        totalLogs={4}
        displayedLogs={2}
        groupBy="concept"
        metric="accuracy"
        displayMode="table"
        aggregatedRows={[sampleRow]}
      />
    );
    expect(screen.getByTestId("data-lab-aggregate-summary")).toHaveTextContent("集計軸: Concept");
    expect(screen.getByTestId("data-lab-aggregate-summary")).toHaveTextContent("対象ログ: 2件");
    expect(screen.getByTestId("data-lab-aggregate-summary")).toHaveTextContent("集計結果: 1件");
    expect(screen.getByTestId("data-lab-table")).toBeInTheDocument();
  });
});

describe("DataLabResultsPanel 表示分岐", () => {
  it("table + concept はテーブルを表示する", () => {
    render(
      <DataLabResultsPanel
        totalLogs={4}
        displayedLogs={2}
        groupBy="concept"
        metric="accuracy"
        displayMode="table"
        aggregatedRows={[sampleRow]}
      />
    );
    expect(screen.getByTestId("data-lab-table")).toBeInTheDocument();
    expect(screen.queryByTestId("data-lab-line-chart")).not.toBeInTheDocument();
  });

  it.each(["day", "week", "month"] as const)("line + %s は折れ線グラフを表示する", (groupBy) => {
    render(
      <DataLabResultsPanel
        totalLogs={4}
        displayedLogs={2}
        groupBy={groupBy}
        metric="accuracy"
        displayMode="line"
        aggregatedRows={[{ ...dayRow, groupBy }]}
      />
    );
    expect(screen.getByTestId("data-lab-line-chart")).toBeInTheDocument();
    expect(screen.queryByTestId("data-lab-table")).not.toBeInTheDocument();
  });

  it.each(["concept", "domain", "deck"] as const)("line + %s は非対応案内を表示する", (groupBy) => {
    render(
      <DataLabResultsPanel
        totalLogs={4}
        displayedLogs={2}
        groupBy={groupBy}
        metric="accuracy"
        displayMode="line"
        aggregatedRows={[sampleRow]}
      />
    );
    expect(screen.getByTestId("data-lab-line-chart-unsupported")).toHaveTextContent(
      "折れ線グラフでは日・週・月単位の集計を選択してください。"
    );
    expect(screen.queryByTestId("data-lab-table")).not.toBeInTheDocument();
    expect(screen.queryByTestId("data-lab-line-chart")).not.toBeInTheDocument();
  });
});
