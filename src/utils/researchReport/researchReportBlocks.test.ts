import { describe, expect, it } from "vitest";
import type { DataLabAggregateRow } from "../dataLab/aggregateDataLabLogs";
import { DEFAULT_DATA_LAB_FILTERS } from "../dataLab/filterDataLabLogs";
import { buildDataLabAnalysisSnapshot } from "../dataLab/buildDataLabAnalysisSnapshot";
import {
  appendDataLabAnalysisBlock,
  createResearchReportFromSnapshot,
  deleteResearchReportBlock,
  updateResearchReportBlockCommentary,
  updateResearchReportTitle
} from "./researchReportBlocks";

const row = (overrides: Partial<DataLabAggregateRow> = {}): DataLabAggregateRow => ({
  groupBy: "concept",
  key: "concept-a",
  label: "人工知能",
  attemptCount: 2,
  correctCount: 1,
  incorrectCount: 1,
  accuracy: 0.5,
  masteryProbability: 0.42,
  averageResponseTimeMs: 1200,
  firstAttemptAt: "2026-08-01T00:00:00.000Z",
  lastAttemptAt: "2026-08-02T00:00:00.000Z",
  conceptId: "concept-a",
  ...overrides
});

const snapshot = (label = "人工知能") =>
  buildDataLabAnalysisSnapshot(
    {
      filters: DEFAULT_DATA_LAB_FILTERS,
      filterChips: [{ id: "concept", label: `Concept: ${label}` }],
      groupBy: "concept",
      metric: "accuracy",
      displayMode: "table",
      filteredLogCount: 2,
      aggregatedRows: [row({ label })]
    },
    { now: "2026-09-09T12:00:00.000Z" }
  );

describe("researchReportBlocks", () => {
  it("新規レポートに Snapshot と空の考察を入れる", () => {
    const report = createResearchReportFromSnapshot(snapshot(), {
      id: "r1",
      now: "2026-09-09T12:00:00.000Z"
    });
    expect(report.title).toMatch(/Data Lab 分析 2026\/09\/09/);
    expect(report.blocks).toHaveLength(1);
    expect(report.blocks[0]?.type).toBe("data-lab-analysis");
    expect(report.blocks[0]?.commentary).toBe("");
    expect(report.blocks[0]?.snapshot.rows[0]?.label).toBe("人工知能");
  });

  it("既存レポート末尾へ追加し、既存 block は変えない", () => {
    const report = createResearchReportFromSnapshot(snapshot("A"), {
      id: "r1",
      now: "2026-09-01T00:00:00.000Z"
    });
    const firstBlock = report.blocks[0]!;
    const next = appendDataLabAnalysisBlock(report, snapshot("B"), {
      now: "2026-09-09T00:00:00.000Z",
      blockId: "b2"
    });

    expect(next.blocks).toHaveLength(2);
    expect(next.blocks[0]).toEqual(firstBlock);
    expect(next.blocks[1]?.snapshot.rows[0]?.label).toBe("B");
    expect(report.blocks).toHaveLength(1);
  });

  it("考察を編集できる", () => {
    const report = createResearchReportFromSnapshot(snapshot(), { id: "r1" });
    const updated = updateResearchReportBlockCommentary(
      report,
      report.blocks[0]!.id,
      "正答率が低い。",
      "2026-09-09T13:00:00.000Z"
    );
    expect(updated.blocks[0]?.commentary).toBe("正答率が低い。");
    expect(report.blocks[0]?.commentary).toBe("");
  });

  it("タイトルを編集できる", () => {
    const report = createResearchReportFromSnapshot(snapshot(), { id: "r1", title: "自動" });
    const updated = updateResearchReportTitle(report, "手動タイトル");
    expect(updated.title).toBe("手動タイトル");
  });

  it("Analysis Block 削除はレポートの blocks だけを変え、元 Snapshot を壊さない", () => {
    const sourceLogs = [{ id: "log-keep" }];
    const snap = snapshot();
    const report = createResearchReportFromSnapshot(snap, { id: "r1" });
    const extra = appendDataLabAnalysisBlock(report, snapshot("B"), { blockId: "keep" });
    const removed = deleteResearchReportBlock(extra, extra.blocks[0]!.id);

    expect(removed.blocks).toHaveLength(1);
    expect(removed.blocks[0]?.id).toBe("keep");
    expect(sourceLogs).toEqual([{ id: "log-keep" }]);
    expect(snap.rows[0]?.label).toBe("人工知能");
  });
});
