import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_DATA_LAB_FILTERS } from "../../utils/dataLab/filterDataLabLogs";
import { createEmptyConceptInput, type Concept } from "../../types/concept";
import { QUIZ_ATTEMPT_LOG_SCHEMA_VERSION, type QuizAttemptLog } from "../../types/quiz";
import { buildConceptMasteryMap } from "../../utils/mastery/getConceptMastery";
import { buildConceptPfaPredictionMap } from "../../utils/pfa/getConceptPfaPrediction";
import { buildDataLabAggregatedRows } from "../../utils/dataLab/buildDataLabAggregatedRows";
import { calculateHlrRetentionProbability } from "../../utils/hlr/hlr";
import { createResearchReportFromSnapshot } from "../../utils/researchReport/researchReportBlocks";
import { buildDataLabAnalysisSnapshot } from "../../utils/dataLab/buildDataLabAnalysisSnapshot";
import type { ResearchReport } from "../../types/researchReport";
import { DataLabAddToResearchReportPanel } from "./DataLabAddToResearchReportPanel";

const { saveResearchReport, getResearchReports, getResearchReport } = vi.hoisted(() => ({
  saveResearchReport: vi.fn().mockResolvedValue(undefined),
  getResearchReports: vi.fn().mockResolvedValue([]),
  getResearchReport: vi.fn()
}));

vi.mock("../../storage", () => ({
  getStorage: () => ({
    getResearchReports,
    getResearchReport,
    saveResearchReport
  })
}));

const t0 = "2026-09-02T12:00:00.000Z";
const t1 = "2026-09-02T18:00:00.000Z";
const originalCreatedAt = "2026-08-01T00:00:00.000Z";

const log = (overrides: Partial<QuizAttemptLog> = {}): QuizAttemptLog => ({
  id: "log-1",
  questionId: "q1",
  questionType: "multiple-choice",
  questionPromptSnapshot: "問い",
  selectedChoiceId: "c1",
  selectedChoiceTextSnapshot: "選択",
  correctChoiceId: "c1",
  correctChoiceTextSnapshot: "正解",
  correct: false,
  startedAt: t0,
  answeredAt: t0,
  timeMs: 10,
  schemaVersion: QUIZ_ATTEMPT_LOG_SCHEMA_VERSION,
  conceptId: "concept-a",
  ...overrides
});

const concept = (): Concept => ({
  ...createEmptyConceptInput(),
  id: "concept-a",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  title: "人工知能"
});

const shortHalfLifeLogs: QuizAttemptLog[] = [
  log({ id: "d1", answeredAt: "2026-09-01T12:00:00.000Z" }),
  log({ id: "d2", answeredAt: t0 })
];

const conceptById = new Map([["concept-a", concept()]]);
const masteryByConceptId = buildConceptMasteryMap(shortHalfLifeLogs);
const pfaByConceptId = buildConceptPfaPredictionMap(shortHalfLifeLogs);

const buildAggregatedRowsForNow = (now: Date) =>
  buildDataLabAggregatedRows({
    logs: shortHalfLifeLogs,
    groupBy: "concept",
    conceptById,
    deckById: new Map(),
    masteryByConceptId,
    pfaByConceptId,
    hlrNow: now
  });

const displayRows = buildAggregatedRowsForNow(new Date(t0));

const existingReport = (): ResearchReport =>
  createResearchReportFromSnapshot(
    buildDataLabAnalysisSnapshot(
      {
        filters: DEFAULT_DATA_LAB_FILTERS,
        filterChips: [],
        groupBy: "concept",
        metric: "accuracy",
        displayMode: "table",
        filteredLogCount: 1,
        aggregatedRows: displayRows
      },
      { now: originalCreatedAt }
    ),
    { id: "existing-rr", title: "既存", now: originalCreatedAt }
  );

const renderPanel = (
  extras: Partial<Parameters<typeof DataLabAddToResearchReportPanel>[0]> = {}
) =>
  render(
    <DataLabAddToResearchReportPanel
      filters={DEFAULT_DATA_LAB_FILTERS}
      filterChips={[]}
      groupBy="concept"
      metric="accuracy"
      scatterXMetric="averageResponseTimeMs"
      scatterYMetric="accuracy"
      displayMode="table"
      barSort="valueDesc"
      barLimit={10}
      filteredLogCount={2}
      aggregatedRows={displayRows}
      buildAggregatedRowsForNow={buildAggregatedRowsForNow}
      {...extras}
    />
  );

describe("DataLabAddToResearchReportPanel (#182)", () => {
  beforeEach(() => {
    saveResearchReport.mockClear();
    getResearchReports.mockReset();
    getResearchReport.mockReset();
    getResearchReports.mockResolvedValue([]);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(t0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("保存時の HLR retention は T1 基準であり、T0 の表示値ではない", async () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "研究レポートに追加" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "保存" })).toBeEnabled();
    });

    vi.setSystemTime(new Date(t1));
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(saveResearchReport).toHaveBeenCalledTimes(1);
    });

    const report = saveResearchReport.mock.calls[0]![0] as ResearchReport;
    const snapshot = report.blocks[0]!.snapshot;
    const expectedT1 = calculateHlrRetentionProbability(0.25, 0.25);
    const expectedT0 = 1;

    expect(snapshot.hlrComputedAt).toBe(t1);
    expect(snapshot.createdAt).toBe(t1);
    expect(report.createdAt).toBe(t1);
    expect(report.updatedAt).toBe(t1);
    expect(snapshot.rows[0]?.hlrRetentionProbability).toBe(expectedT1);
    expect(snapshot.rows[0]?.hlrRetentionProbability).not.toBe(expectedT0);
    expect(snapshot.rows[0]?.hlrElapsedDays).toBeCloseTo(0.25);
    expect(displayRows[0]?.hlrRetentionProbability).toBe(expectedT0);
  });

  it("モーダルを開いた時刻ではなく保存ボタン押下時刻を Snapshot に使う", async () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "研究レポートに追加" }));
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    vi.setSystemTime(new Date(t1));
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => {
      expect(saveResearchReport).toHaveBeenCalled();
    });

    const report = saveResearchReport.mock.calls[0]![0] as ResearchReport;
    expect(report.blocks[0]?.snapshot.createdAt).toBe(t1);
    expect(report.blocks[0]?.snapshot.hlrComputedAt).toBe(t1);
    expect(report.createdAt).not.toBe(t0);
  });

  it("既存レポートへ追加しても createdAt は維持し updatedAt と Snapshot は保存時刻にする", async () => {
    const original = existingReport();
    getResearchReports.mockResolvedValue([original]);
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "研究レポートに追加" }));
    await waitFor(() => {
      expect(screen.getByLabelText("既存の研究レポート")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("既存の研究レポート"));
    vi.setSystemTime(new Date(t1));
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(saveResearchReport).toHaveBeenCalled();
    });

    const result = saveResearchReport.mock.calls[0]![0] as ResearchReport;
    const snapshot = result.blocks[1]!.snapshot;
    expect(result.createdAt).toBe(original.createdAt);
    expect(result.createdAt).toBe(originalCreatedAt);
    expect(snapshot.createdAt).toBe(t1);
    expect(snapshot.hlrComputedAt).toBe(t1);
    expect(result.updatedAt).toBe(t1);
    expect(snapshot.rows[0]?.hlrRetentionProbability).toBe(0.5);
  });

  it("保存後に onSnapshotSavedAt へ T1 を渡す", async () => {
    const onSnapshotSavedAt = vi.fn();
    renderPanel({ onSnapshotSavedAt });
    fireEvent.click(screen.getByRole("button", { name: "研究レポートに追加" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "保存" })).toBeEnabled();
    });
    vi.setSystemTime(new Date(t1));
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => {
      expect(onSnapshotSavedAt).toHaveBeenCalledTimes(1);
    });
    expect(onSnapshotSavedAt.mock.calls[0]![0]).toEqual(new Date(t1));
  });
});
