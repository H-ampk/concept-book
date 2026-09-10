import type { DataLabAggregateRow } from "./aggregateDataLabLogs";

export type DataLabTableSortKey =
  | "label"
  | "attemptCount"
  | "correctCount"
  | "incorrectCount"
  | "accuracy"
  | "mastery"
  | "pfaNextCorrectProbability"
  | "pfaSuccessCount"
  | "pfaFailureCount"
  | "hlrRetentionProbability"
  | "hlrHalfLifeDays"
  | "hlrElapsedDays"
  | "averageResponseTimeMs"
  | "lastAttemptAt";

export type DataLabTableSortDirection = "asc" | "desc";

export type DataLabTableSortState = {
  key: DataLabTableSortKey | null;
  direction: DataLabTableSortDirection;
};

const parseTimestamp = (iso: string | null): number | null => {
  if (iso == null || iso === "") {
    return null;
  }
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
};

const compareNullable = (
  a: number | null,
  b: number | null,
  direction: DataLabTableSortDirection
): number => {
  const aNull = a == null;
  const bNull = b == null;
  if (aNull && bNull) {
    return 0;
  }
  if (aNull) {
    return 1;
  }
  if (bNull) {
    return -1;
  }
  const diff = a - b;
  if (diff === 0) {
    return 0;
  }
  return direction === "asc" ? diff : -diff;
};

const nullableValueForSort = (row: DataLabAggregateRow, key: DataLabTableSortKey): number | null => {
  switch (key) {
    case "accuracy":
      return row.accuracy;
    case "mastery":
      return row.masteryProbability ?? null;
    case "pfaNextCorrectProbability":
      return row.pfaNextCorrectProbability ?? null;
    case "pfaSuccessCount":
      return row.pfaSuccessCount ?? null;
    case "pfaFailureCount":
      return row.pfaFailureCount ?? null;
    case "hlrRetentionProbability":
      return row.hlrRetentionProbability ?? null;
    case "hlrHalfLifeDays":
      return row.hlrHalfLifeDays ?? null;
    case "hlrElapsedDays":
      return row.hlrElapsedDays ?? null;
    case "averageResponseTimeMs":
      return row.averageResponseTimeMs;
    default:
      return null;
  }
};

const compareValue = (
  rowA: DataLabAggregateRow,
  rowB: DataLabAggregateRow,
  key: DataLabTableSortKey,
  direction: DataLabTableSortDirection
): number => {
  if (key === "label") {
    const byLabel = rowA.label.localeCompare(rowB.label, "ja");
    if (byLabel === 0) {
      return 0;
    }
    return direction === "asc" ? byLabel : -byLabel;
  }
  if (key === "lastAttemptAt") {
    return compareNullable(parseTimestamp(rowA.lastAttemptAt), parseTimestamp(rowB.lastAttemptAt), direction);
  }
  if (
    key === "accuracy" ||
    key === "mastery" ||
    key === "pfaNextCorrectProbability" ||
    key === "pfaSuccessCount" ||
    key === "pfaFailureCount" ||
    key === "hlrRetentionProbability" ||
    key === "hlrHalfLifeDays" ||
    key === "hlrElapsedDays" ||
    key === "averageResponseTimeMs"
  ) {
    return compareNullable(nullableValueForSort(rowA, key), nullableValueForSort(rowB, key), direction);
  }
  const diff = rowA[key] - rowB[key];
  if (diff === 0) {
    return 0;
  }
  return direction === "asc" ? diff : -diff;
};

export const sortDataLabTableRows = (
  rows: DataLabAggregateRow[],
  sort: DataLabTableSortState
): DataLabAggregateRow[] => {
  if (sort.key == null) {
    return rows;
  }
  const indexed = rows.map((row, index) => ({ row, index }));
  indexed.sort((a, b) => {
    const compared = compareValue(a.row, b.row, sort.key as DataLabTableSortKey, sort.direction);
    if (compared !== 0) {
      return compared;
    }
    return a.index - b.index;
  });
  return indexed.map((item) => item.row);
};
