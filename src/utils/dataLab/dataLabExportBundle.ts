import { strToU8, zipSync } from "fflate";
import packageJson from "../../../package.json";
import type { LearningModelPredictionPoint } from "../learningModelEvaluation/types";
import type { DataLabGroupBy } from "./aggregateDataLabLogs";
import type { DataLabFilters } from "./filterDataLabLogs";
import { toDataLabPredictionEvaluationFilters } from "./toDataLabPredictionEvaluationFilters";

export const DATA_LAB_EXPORT_METADATA_SCHEMA_VERSION = 1;
export const DATA_LAB_EXPORT_SOURCE = "data-lab" as const;
export const DATA_LAB_EXPORT_METADATA_FILENAME = "metadata.json";
export const DATA_LAB_EXPORT_ZIP_MIME = "application/zip";
export const DATA_LAB_EXPORT_ZIP_LEVEL = 5;

export type DataLabExportTarget = "logs" | "aggregate" | "predictions";

export const cloneDataLabFilters = (filters: DataLabFilters): DataLabFilters => ({
  dateFrom: filters.dateFrom,
  dateTo: filters.dateTo,
  conceptIds: [...filters.conceptIds],
  domainTags: [...filters.domainTags],
  deckIds: [...filters.deckIds],
  correctness: filters.correctness
});

export type DataLabAggregateModelHistory = {
  aggregateRowsSource: "filtered-logs";
  bktHistorySource: "all-logs";
  pfaHistorySource: "all-logs";
  hlrHistorySource: "all-logs";
  hlrComputedAt: string;
};

export type DataLabPredictionHistorySource = "all-prior-valid-same-concept-logs";

export type DataLabPredictionEvaluationProvenance = {
  models: string[];
  correctnessFilterApplied: false;
  historySource: DataLabPredictionHistorySource;
  includesTargetAttemptInHistory: false;
  includesSameTimestampGroupInHistory: false;
};

export type DataLabExportMetadata = {
  schemaVersion: number;
  source: typeof DATA_LAB_EXPORT_SOURCE;
  exportedAt: string;
  appVersion: string;
  target: DataLabExportTarget;
  dataFile: string;
  rowCount: number;
  filters: DataLabFilters;
  effectiveFilters: DataLabFilters;
  groupBy?: DataLabGroupBy;
  aggregateModelHistory?: DataLabAggregateModelHistory;
  predictionEvaluation?: DataLabPredictionEvaluationProvenance;
};

type DataLabExportMetadataBaseInput = {
  exportedAt: string;
  dataFile: string;
  rowCount: number;
  filters: DataLabFilters;
};

export type BuildDataLabExportMetadataInput =
  | (DataLabExportMetadataBaseInput & { target: "logs" })
  | (DataLabExportMetadataBaseInput & {
      target: "aggregate";
      groupBy: DataLabGroupBy;
      hlrComputedAt: string;
    })
  | (DataLabExportMetadataBaseInput & {
      target: "predictions";
      predictionPoints: LearningModelPredictionPoint[];
    });

export const uniqueSortedPredictionModels = (points: LearningModelPredictionPoint[]): string[] =>
  [...new Set(points.map((point) => point.model))].sort((a, b) => a.localeCompare(b));

const predictionEvaluationProvenance = (
  points: LearningModelPredictionPoint[]
): DataLabPredictionEvaluationProvenance => ({
  models: uniqueSortedPredictionModels(points),
  correctnessFilterApplied: false,
  historySource: "all-prior-valid-same-concept-logs",
  includesTargetAttemptInHistory: false,
  includesSameTimestampGroupInHistory: false
});

export const buildDataLabExportMetadata = (
  input: BuildDataLabExportMetadataInput
): DataLabExportMetadata => {
  const filters = cloneDataLabFilters(input.filters);
  const effectiveFilters =
    input.target === "predictions"
      ? cloneDataLabFilters(toDataLabPredictionEvaluationFilters(input.filters))
      : cloneDataLabFilters(input.filters);

  const metadata: DataLabExportMetadata = {
    schemaVersion: DATA_LAB_EXPORT_METADATA_SCHEMA_VERSION,
    source: DATA_LAB_EXPORT_SOURCE,
    exportedAt: input.exportedAt,
    appVersion: packageJson.version,
    target: input.target,
    dataFile: input.dataFile,
    rowCount: input.rowCount,
    filters,
    effectiveFilters
  };

  if (input.target === "aggregate") {
    metadata.groupBy = input.groupBy;
    metadata.aggregateModelHistory = {
      aggregateRowsSource: "filtered-logs",
      bktHistorySource: "all-logs",
      pfaHistorySource: "all-logs",
      hlrHistorySource: "all-logs",
      hlrComputedAt: input.hlrComputedAt
    };
  }

  if (input.target === "predictions") {
    metadata.predictionEvaluation = predictionEvaluationProvenance(input.predictionPoints);
  }

  return metadata;
};

export const serializeDataLabExportMetadata = (metadata: DataLabExportMetadata): string =>
  JSON.stringify(metadata, null, 2);

export const dataLabExportZipFilename = (csvFilename: string): string =>
  csvFilename.replace(/\.csv$/i, ".zip");

export const buildDataLabExportZip = (
  csvFilename: string,
  csv: string,
  metadata: DataLabExportMetadata
): Uint8Array =>
  zipSync(
    {
      [csvFilename]: strToU8(csv),
      [DATA_LAB_EXPORT_METADATA_FILENAME]: strToU8(serializeDataLabExportMetadata(metadata))
    },
    { level: DATA_LAB_EXPORT_ZIP_LEVEL }
  );
