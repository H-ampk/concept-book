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

describe("DataLabResultsPanel 空状態", () => {
  it("学習ログ0件の空状態を表示する", () => {
    render(
      <DataLabResultsPanel totalLogs={0} displayedLogs={0} groupBy="concept" aggregatedRows={[]} />
    );
    expect(screen.getByText("まだ分析できる学習データがありません。")).toBeInTheDocument();
    expect(screen.queryByTestId("data-lab-table")).not.toBeInTheDocument();
  });

  it("filteredLogs 0件の空状態を表示する", () => {
    render(
      <DataLabResultsPanel totalLogs={4} displayedLogs={0} groupBy="concept" aggregatedRows={[]} />
    );
    expect(screen.getByText("条件に一致する学習データがありません。")).toBeInTheDocument();
    expect(screen.queryByText("まだ分析できる学習データがありません。")).not.toBeInTheDocument();
    expect(screen.queryByTestId("data-lab-table")).not.toBeInTheDocument();
  });

  it("filteredLogs はあるが集計行が0件の空状態を表示する", () => {
    render(
      <DataLabResultsPanel totalLogs={4} displayedLogs={2} groupBy="day" aggregatedRows={[]} />
    );
    expect(screen.getByText("この条件では集計できるデータがありません。")).toBeInTheDocument();
    expect(screen.queryByText("まだ分析できる学習データがありません。")).not.toBeInTheDocument();
    expect(screen.queryByText("条件に一致する学習データがありません。")).not.toBeInTheDocument();
    expect(screen.queryByTestId("data-lab-table")).not.toBeInTheDocument();
  });

  it("集計行があるときはテーブルと要約を表示する", () => {
    render(
      <DataLabResultsPanel
        totalLogs={4}
        displayedLogs={2}
        groupBy="concept"
        aggregatedRows={[sampleRow]}
      />
    );
    expect(screen.getByTestId("data-lab-aggregate-summary")).toHaveTextContent("集計軸: Concept");
    expect(screen.getByTestId("data-lab-aggregate-summary")).toHaveTextContent("対象ログ: 2件");
    expect(screen.getByTestId("data-lab-aggregate-summary")).toHaveTextContent("集計結果: 1件");
    expect(screen.getByTestId("data-lab-table")).toBeInTheDocument();
  });
});
