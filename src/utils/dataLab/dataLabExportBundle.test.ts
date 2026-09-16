import { strFromU8, strToU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import packageJson from "../../../package.json";
import { createEmptyConceptInput, type Concept } from "../../types/concept";
import { QUIZ_ATTEMPT_LOG_SCHEMA_VERSION, type QuizAttemptLog, type QuizDeck } from "../../types/quiz";
import type { DataLabAggregateRow } from "./aggregateDataLabLogs";
import {
  buildDataLabAggregateCsv,
  buildDataLabLogCsv,
  buildDataLabPredictionCsv,
  dataLabAggregateCsvFilename,
  dataLabLogCsvFilename,
  dataLabPredictionCsvFilename
} from "./dataLabCsvExport";
import {
  DATA_LAB_EXPORT_METADATA_FILENAME,
  DATA_LAB_EXPORT_METADATA_SCHEMA_VERSION,
  DATA_LAB_EXPORT_SOURCE,
  buildDataLabExportMetadata,
  buildDataLabExportZip,
  cloneDataLabFilters,
  dataLabExportZipFilename,
  uniqueSortedPredictionModels,
  type DataLabExportMetadata
} from "./dataLabExportBundle";
import { DEFAULT_DATA_LAB_FILTERS, type DataLabFilters } from "./filterDataLabLogs";
import type { LearningModelPredictionPoint } from "../learningModelEvaluation/types";

const log = (overrides: Partial<QuizAttemptLog> = {}): QuizAttemptLog => ({
  id: "log-1",
  questionId: "q1",
  questionType: "multiple-choice",
  questionPromptSnapshot: "問い",
  selectedChoiceId: "c1",
  selectedChoiceTextSnapshot: "選択",
  correctChoiceId: "c2",
  correctChoiceTextSnapshot: "正解",
  correct: true,
  startedAt: "2026-08-15T03:00:00.000Z",
  answeredAt: "2026-08-15T03:00:01.000Z",
  timeMs: 4200,
  schemaVersion: QUIZ_ATTEMPT_LOG_SCHEMA_VERSION,
  conceptId: "concept-a",
  deckId: "deck-1",
  ...overrides
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
  key: "k1",
  label: "ラベル",
  attemptCount: 2,
  correctCount: 2,
  incorrectCount: 0,
  accuracy: 1,
  averageResponseTimeMs: 10,
  firstAttemptAt: "2026-08-01T00:00:00.000Z",
  lastAttemptAt: "2026-08-15T00:00:00.000Z",
  conceptId: "concept-a",
  masteryProbability: 0.8
});

const point = (
  overrides: Partial<LearningModelPredictionPoint> = {}
): LearningModelPredictionPoint => ({
  conceptId: "concept-a",
  attemptId: "attempt-1",
  answeredAt: "2026-01-01T00:00:00.000Z",
  predictedCorrectProbability: 0.7,
  actualCorrect: true,
  model: "bkt",
  historyCount: 2,
  ...overrides
});

const filters = (overrides: Partial<DataLabFilters> = {}): DataLabFilters => ({
  ...DEFAULT_DATA_LAB_FILTERS,
  ...overrides
});

const unzipBundle = (zip: Uint8Array) => {
  const files = unzipSync(zip);
  return {
    names: Object.keys(files).sort(),
    files
  };
};

const readZipText = (files: Record<string, Uint8Array>, name: string): string => {
  const bytes = files[name];
  if (!bytes) {
    throw new Error(`ZIP entry missing: ${name}`);
  }
  return strFromU8(bytes);
};

const readMetadata = (files: Record<string, Uint8Array>): DataLabExportMetadata =>
  JSON.parse(readZipText(files, DATA_LAB_EXPORT_METADATA_FILENAME)) as DataLabExportMetadata;

describe("cloneDataLabFilters", () => {
  it("配列は参照を共有せずコピーする", () => {
    const original = filters({
      conceptIds: ["c1"],
      domainTags: ["d1"],
      deckIds: ["deck-1"]
    });
    const cloned = cloneDataLabFilters(original);
    cloned.conceptIds.push("c2");
    cloned.domainTags.push("d2");
    cloned.deckIds.push("deck-2");
    expect(original.conceptIds).toEqual(["c1"]);
    expect(original.domainTags).toEqual(["d1"]);
    expect(original.deckIds).toEqual(["deck-1"]);
  });
});

describe("dataLabExportZipFilename", () => {
  it("CSV ファイル名の拡張子だけ ZIP にする", () => {
    expect(dataLabExportZipFilename("conceptbook-datalab-predictions-2026-09-16.csv")).toBe(
      "conceptbook-datalab-predictions-2026-09-16.zip"
    );
  });
});

describe("uniqueSortedPredictionModels", () => {
  it("重複を除き決定的な順序にする", () => {
    expect(
      uniqueSortedPredictionModels([
        point({ model: "pfa" }),
        point({ model: "bkt" }),
        point({ model: "pfa" }),
        point({ model: "bkt" })
      ])
    ).toEqual(["bkt", "pfa"]);
  });
});

describe("buildDataLabExportZip", () => {
  const now = new Date(2026, 8, 16, 15, 0, 0);
  const exportedAt = "2026-09-16T06:00:00.000Z";
  const conceptById = new Map([["concept-a", concept()]]);
  const deckById = new Map([["deck-1", deck()]]);
  const correctLogs = [log({ id: "ok-1", correct: true }), log({ id: "ok-2", correct: true })];

  it("logs ZIP 内 CSV は既存 builder と同一で、BOM を残す", () => {
    const csv = buildDataLabLogCsv(correctLogs, conceptById, deckById);
    const dataFile = dataLabLogCsvFilename(now);
    const zip = buildDataLabExportZip(
      dataFile,
      csv,
      buildDataLabExportMetadata({
        target: "logs",
        exportedAt,
        dataFile,
        rowCount: correctLogs.length,
        filters: filters()
      })
    );
    const { names, files } = unzipBundle(zip);
    expect(names).toEqual([dataFile, DATA_LAB_EXPORT_METADATA_FILENAME].sort());
    expect(files[dataFile]).toEqual(strToU8(csv));
    expect(Array.from(files[dataFile] ?? []).slice(0, 3)).toEqual([0xef, 0xbb, 0xbf]);
    const metadata = readMetadata(files);
    expect(metadata.schemaVersion).toBe(DATA_LAB_EXPORT_METADATA_SCHEMA_VERSION);
    expect(metadata.source).toBe(DATA_LAB_EXPORT_SOURCE);
    expect(metadata.appVersion).toBe(packageJson.version);
    expect(metadata.target).toBe("logs");
    expect(metadata.dataFile).toBe(dataFile);
    expect(metadata.rowCount).toBe(2);
    expect(metadata.filters).toEqual(metadata.effectiveFilters);
    expect(metadata.predictionEvaluation).toBeUndefined();
    expect(metadata.aggregateModelHistory).toBeUndefined();
  });

  it("aggregate / predictions ZIP 内 CSV も既存 builder と同一", () => {
    const rows = [aggregateRow()];
    const aggregateCsv = buildDataLabAggregateCsv(rows);
    const aggregateFile = dataLabAggregateCsvFilename("concept", now);
    const aggregateZip = buildDataLabExportZip(
      aggregateFile,
      aggregateCsv,
      buildDataLabExportMetadata({
        target: "aggregate",
        exportedAt,
        dataFile: aggregateFile,
        rowCount: rows.length,
        filters: filters(),
        groupBy: "concept",
        hlrComputedAt: "2026-09-16T03:00:00.000Z"
      })
    );
    expect(unzipBundle(aggregateZip).files[aggregateFile]).toEqual(strToU8(aggregateCsv));

    const points = [point({ model: "bkt" }), point({ model: "pfa", attemptId: "attempt-2" })];
    const predictionCsv = buildDataLabPredictionCsv(points);
    const predictionFile = dataLabPredictionCsvFilename(now);
    const predictionZip = buildDataLabExportZip(
      predictionFile,
      predictionCsv,
      buildDataLabExportMetadata({
        target: "predictions",
        exportedAt,
        dataFile: predictionFile,
        rowCount: points.length,
        filters: filters(),
        predictionPoints: points
      })
    );
    expect(unzipBundle(predictionZip).files[predictionFile]).toEqual(strToU8(predictionCsv));
  });

  it("同じ CSV でも dateFrom が違えば metadata が異なる", () => {
    const csv = buildDataLabLogCsv(correctLogs, conceptById, deckById);
    const dataFile = dataLabLogCsvFilename(now);
    const withoutDate = buildDataLabExportMetadata({
      target: "logs",
      exportedAt,
      dataFile,
      rowCount: correctLogs.length,
      filters: filters({ dateFrom: "" })
    });
    const withDate = buildDataLabExportMetadata({
      target: "logs",
      exportedAt,
      dataFile,
      rowCount: correctLogs.length,
      filters: filters({ dateFrom: "2026-09-01" })
    });
    expect(csv).toBe(buildDataLabLogCsv(correctLogs, conceptById, deckById));
    expect(withoutDate.filters.dateFrom).toBe("");
    expect(withDate.filters.dateFrom).toBe("2026-09-01");
    expect(JSON.stringify(withoutDate)).not.toBe(JSON.stringify(withDate));
  });

  it("CSV が全部正答でも correctness=all と correct を metadata で区別できる", () => {
    const csv = buildDataLabLogCsv(correctLogs, conceptById, deckById);
    const dataFile = dataLabLogCsvFilename(now);
    const allFilters = filters({ correctness: "all" });
    const correctFilters = filters({ correctness: "correct" });
    const allMeta = buildDataLabExportMetadata({
      target: "logs",
      exportedAt,
      dataFile,
      rowCount: correctLogs.length,
      filters: allFilters
    });
    const correctMeta = buildDataLabExportMetadata({
      target: "logs",
      exportedAt,
      dataFile,
      rowCount: correctLogs.length,
      filters: correctFilters
    });
    expect(csv).toBe(buildDataLabLogCsv(correctLogs, conceptById, deckById));
    expect(allMeta.filters.correctness).toBe("all");
    expect(correctMeta.filters.correctness).toBe("correct");
    expect(allMeta.effectiveFilters.correctness).toBe("all");
    expect(correctMeta.effectiveFilters.correctness).toBe("correct");
  });

  it("prediction では画面の correctness=correct でも effectiveFilters は all で、correctness は未適用", () => {
    const points = [point()];
    const metadata = buildDataLabExportMetadata({
      target: "predictions",
      exportedAt,
      dataFile: dataLabPredictionCsvFilename(now),
      rowCount: points.length,
      filters: filters({ correctness: "correct", dateFrom: "2026-09-01" }),
      predictionPoints: points
    });
    expect(metadata.filters.correctness).toBe("correct");
    expect(metadata.filters.dateFrom).toBe("2026-09-01");
    expect(metadata.effectiveFilters.correctness).toBe("all");
    expect(metadata.effectiveFilters.dateFrom).toBe("2026-09-01");
    expect(metadata.predictionEvaluation?.correctnessFilterApplied).toBe(false);
    expect(metadata.predictionEvaluation?.historySource).toBe("all-prior-valid-same-concept-logs");
    expect(metadata.predictionEvaluation?.includesTargetAttemptInHistory).toBe(false);
    expect(metadata.predictionEvaluation?.includesSameTimestampGroupInHistory).toBe(false);
    expect(metadata.predictionEvaluation?.models).toEqual(["bkt"]);
  });

  it("prediction models は export 対象から unique かつ決定的順", () => {
    const points = [
      point({ model: "pfa", attemptId: "a" }),
      point({ model: "bkt", attemptId: "a" }),
      point({ model: "pfa", attemptId: "b" })
    ];
    const metadata = buildDataLabExportMetadata({
      target: "predictions",
      exportedAt,
      dataFile: dataLabPredictionCsvFilename(now),
      rowCount: points.length,
      filters: filters(),
      predictionPoints: points
    });
    expect(metadata.predictionEvaluation?.models).toEqual(["bkt", "pfa"]);
  });

  it("aggregate は groupBy と学習モデル履歴ソース、hlrComputedAt を残す", () => {
    const exportedAtIso = "2026-09-16T12:00:00.000Z";
    const hlrComputedAt = "2026-09-16T03:00:00.000Z";
    const metadata = buildDataLabExportMetadata({
      target: "aggregate",
      exportedAt: exportedAtIso,
      dataFile: dataLabAggregateCsvFilename("deck", now),
      rowCount: 1,
      filters: filters({ conceptIds: ["concept-a"] }),
      groupBy: "deck",
      hlrComputedAt
    });
    expect(metadata.groupBy).toBe("deck");
    expect(metadata.filters).toEqual(metadata.effectiveFilters);
    expect(metadata.aggregateModelHistory).toEqual({
      aggregateRowsSource: "filtered-logs",
      bktHistorySource: "all-logs",
      pfaHistorySource: "all-logs",
      hlrHistorySource: "all-logs",
      hlrComputedAt
    });
    expect(metadata.exportedAt).toBe(exportedAtIso);
    expect(metadata.aggregateModelHistory?.hlrComputedAt).toBe(hlrComputedAt);
    expect(metadata.exportedAt).not.toBe(metadata.aggregateModelHistory?.hlrComputedAt);
  });
});
