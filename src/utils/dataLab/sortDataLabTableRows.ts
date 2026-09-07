import type { DataLabAggregateRow } from "./aggregateDataLabLogs";

export type DataLabTableSortKey =
  | "label"
  | "attemptCount"
  | "correctCount"
  | "incorrectCount"
  | "accuracy"
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
  if (key === "accuracy") {
    return compareNullable(rowA.accuracy, rowB.accuracy, direction);
  }
  if (key === "averageResponseTimeMs") {
    return compareNullable(rowA.averageResponseTimeMs, rowB.averageResponseTimeMs, direction);
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
