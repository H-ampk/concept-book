import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { strFromU8, unzipSync } from "fflate";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyConceptInput, type Concept } from "../../types/concept";
import { QUIZ_ATTEMPT_LOG_SCHEMA_VERSION, type QuizAttemptLog, type QuizDeck } from "../../types/quiz";
import type { DataLabAggregateRow } from "../../utils/dataLab/aggregateDataLabLogs";
import { DEFAULT_DATA_LAB_FILTERS } from "../../utils/dataLab/filterDataLabLogs";
import type { LearningModelPredictionPoint } from "../../utils/learningModelEvaluation/types";
import { DataLabExportPanel } from "./DataLabExportPanel";

const { downloadBlob } = vi.hoisted(() => ({
  downloadBlob: vi.fn()
}));

vi.mock("../../utils/downloadFile", () => ({
  downloadBlob
}));

const log = (): QuizAttemptLog => ({
  id: "log-1",
  questionId: "q1",
  questionType: "multiple-choice",
  questionPromptSnapshot: "問い",
  selectedChoiceId: "c1",
  selectedChoiceTextSnapshot: "選択",
  correctChoiceId: "c1",
  correctChoiceTextSnapshot: "正解",
  correct: true,
  startedAt: "2026-08-15T03:00:00.000Z",
  answeredAt: "2026-08-15T03:00:01.000Z",
  timeMs: 10,
  schemaVersion: QUIZ_ATTEMPT_LOG_SCHEMA_VERSION,
  conceptId: "concept-a"
});

const concept = (): Concept => ({
  ...createEmptyConceptInput(),
  id: "concept-a",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  title: "人工知能"
});

const deck = (): QuizDeck => ({
  id: "deck-1",
  title: "AI基礎",
  questionIds: [],
  visibility: "private",
  schemaVersion: 1,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
});

const aggregateRow = (): DataLabAggregateRow => ({
  groupBy: "concept",
  key: "concept-a",
  label: "人工知能",
  attemptCount: 1,
  correctCount: 1,
  incorrectCount: 0,
  accuracy: 1,
  averageResponseTimeMs: 10,
  firstAttemptAt: "2026-08-15T03:00:00.000Z",
  lastAttemptAt: "2026-08-15T03:00:01.000Z",
  conceptId: "concept-a"
});

const predictionPoint = (): LearningModelPredictionPoint => ({
  conceptId: "concept-a",
  attemptId: "log-1",
  answeredAt: "2026-08-15T03:00:01.000Z",
  predictedCorrectProbability: 0.5,
  actualCorrect: true,
  model: "bkt",
  historyCount: 0
});

const renderPanel = () =>
  render(
    <DataLabExportPanel
      filteredLogs={[log()]}
      aggregatedRows={[aggregateRow()]}
      predictionPoints={[predictionPoint()]}
      groupBy="concept"
      conceptById={new Map([["concept-a", concept()]])}
      deckById={new Map([["deck-1", deck()]])}
      filters={DEFAULT_DATA_LAB_FILTERS}
      hlrComputedAt="2026-09-16T03:00:00.000Z"
    />
  );

const zipEntry = (files: Record<string, Uint8Array>, name: string): Uint8Array => {
  const bytes = files[name];
  if (!bytes) {
    throw new Error(`missing ${name}`);
  }
  return bytes;
};

const unzipDownloaded = async () => {
  expect(downloadBlob).toHaveBeenCalledTimes(1);
  const [filename, blob] = downloadBlob.mock.calls[0] as [string, Blob];
  expect(blob.type).toBe("application/zip");
  const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
  return { filename, files };
};

describe("DataLabExportPanel", () => {
  beforeEach(() => {
    downloadBlob.mockReset();
  });

  it("ZIP filename と application/zip で downloadBlob する", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole("button", { name: "ZIPを保存" }));
    const { filename, files } = await unzipDownloaded();
    expect(filename).toMatch(/^conceptbook-datalab-concept-\d{4}-\d{2}-\d{2}\.zip$/);
    expect(Object.keys(files).some((name) => name.endsWith(".csv"))).toBe(true);
    expect(Object.keys(files)).toContain("metadata.json");
    const metadata = JSON.parse(strFromU8(zipEntry(files, "metadata.json"))) as { target: string };
    expect(metadata.target).toBe("aggregate");
  });

  it("対象に応じた ZIP を生成する", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.selectOptions(screen.getByLabelText("CSVエクスポート対象"), "logs");
    await user.click(screen.getByRole("button", { name: "ZIPを保存" }));
    const logsExport = await unzipDownloaded();
    expect(logsExport.filename).toMatch(/^conceptbook-datalab-logs-\d{4}-\d{2}-\d{2}\.zip$/);
    expect(JSON.parse(strFromU8(zipEntry(logsExport.files, "metadata.json"))).target).toBe("logs");

    downloadBlob.mockReset();
    await user.selectOptions(screen.getByLabelText("CSVエクスポート対象"), "predictions");
    await user.click(screen.getByRole("button", { name: "ZIPを保存" }));
    const predictionsExport = await unzipDownloaded();
    expect(predictionsExport.filename).toMatch(/^conceptbook-datalab-predictions-\d{4}-\d{2}-\d{2}\.zip$/);
    expect(JSON.parse(strFromU8(zipEntry(predictionsExport.files, "metadata.json"))).target).toBe(
      "predictions"
    );
  });
});
