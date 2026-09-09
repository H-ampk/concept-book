import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_DATA_LAB_FILTERS } from "../../utils/dataLab/filterDataLabLogs";
import { buildDataLabAnalysisSnapshot } from "../../utils/dataLab/buildDataLabAnalysisSnapshot";
import { createResearchReportFromSnapshot } from "../../utils/researchReport/researchReportBlocks";
import { SavedResearchReportsPanel } from "./SavedResearchReportsPanel";

const snapshot = buildDataLabAnalysisSnapshot(
  {
    filters: {
      ...DEFAULT_DATA_LAB_FILTERS,
      conceptIds: ["gone"],
      deckIds: ["gone-deck"]
    },
    filterChips: [
      { id: "concept", label: "Concept: 保存時の概念名" },
      { id: "deck", label: "Deck: 保存時のデッキ名" }
    ],
    groupBy: "concept",
    metric: "accuracy",
    displayMode: "table",
    filteredLogCount: 8,
    aggregatedRows: [
      {
        groupBy: "concept",
        key: "gone",
        label: "保存時の概念名",
        attemptCount: 8,
        correctCount: 4,
        incorrectCount: 4,
        accuracy: 0.5,
        masteryProbability: 0.66,
        averageResponseTimeMs: 1100,
        firstAttemptAt: null,
        lastAttemptAt: null,
        conceptId: "gone"
      }
    ]
  },
  { now: "2026-09-09T12:00:00.000Z" }
);

describe("SavedResearchReportsPanel", () => {
  it("保存時の名称で Snapshot を表示し、現在の Concept lookup を使わない", () => {
    const report = createResearchReportFromSnapshot(snapshot, {
      id: "r1",
      title: "保存済み分析",
      now: "2026-09-09T12:00:00.000Z"
    });
    render(
      <SavedResearchReportsPanel
        reports={[report]}
        onTitleChange={vi.fn()}
        onCommentaryChange={vi.fn()}
        onDeleteBlock={vi.fn()}
      />
    );

    expect(screen.getByLabelText("保存済み研究レポートの選択")).toHaveValue("r1");
    expect(screen.getByText("Concept: 保存時の概念名 / Deck: 保存時のデッキ名")).toBeInTheDocument();
    expect(screen.getByTestId("research-analysis-snapshot-table")).toHaveTextContent("保存時の概念名");
    expect(screen.getByTestId("research-analysis-snapshot-table")).toHaveTextContent("66%");
    expect(screen.getByText("対象ログ件数")).toBeInTheDocument();
    expect(screen.getByText("8 件")).toBeInTheDocument();
  });

  it("考察の blur で保存コールバックを呼ぶ", () => {
    const report = createResearchReportFromSnapshot(snapshot, { id: "r1", title: "保存済み分析" });
    const onCommentaryChange = vi.fn();
    render(
      <SavedResearchReportsPanel
        reports={[report]}
        onTitleChange={vi.fn()}
        onCommentaryChange={onCommentaryChange}
        onDeleteBlock={vi.fn()}
      />
    );

    const textarea = screen.getByLabelText("考察");
    fireEvent.change(textarea, { target: { value: "正答率が低い。" } });
    fireEvent.blur(textarea);
    expect(onCommentaryChange).toHaveBeenCalledWith(report.id, report.blocks[0]?.id, "正答率が低い。");
  });

  it("分析ブロック削除はコールバックのみで、元データ配列は触らない", () => {
    const sourceLogs = [{ id: "keep" }];
    const report = createResearchReportFromSnapshot(snapshot, { id: "r1", title: "保存済み分析" });
    const onDeleteBlock = vi.fn();
    window.confirm = () => true;
    render(
      <SavedResearchReportsPanel
        reports={[report]}
        onTitleChange={vi.fn()}
        onCommentaryChange={vi.fn()}
        onDeleteBlock={onDeleteBlock}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "分析ブロックを削除" }));
    expect(onDeleteBlock).toHaveBeenCalledWith(report.id, report.blocks[0]?.id);
    expect(sourceLogs).toEqual([{ id: "keep" }]);
  });
});
