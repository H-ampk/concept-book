import {
  DATA_LAB_EMPTY_LEARNING_MODEL_METRICS,
  type DataLabAggregateRow,
  type DataLabGroupBy
} from "./aggregateDataLabLogs";
import {
  addLocalDays,
  addLocalMonths,
  isoWeekKeyAndRange,
  lastLocalDayOfMonth,
  localYm,
  localYmd,
  parseLocalYmd
} from "./dataLabTimePeriod";

type TimeGroupBy = Extract<DataLabGroupBy, "day" | "week" | "month">;

const isTimeGroupBy = (groupBy: DataLabGroupBy): groupBy is TimeGroupBy =>
  groupBy === "day" || groupBy === "week" || groupBy === "month";

export type FillDataLabTimeSeriesOptions = {
  groupBy: DataLabGroupBy;
  dateFrom?: string;
  dateTo?: string;
};

const emptyPeriodRow = (
  groupBy: TimeGroupBy,
  key: string,
  label: string,
  periodStart: string,
  periodEnd: string
): DataLabAggregateRow => ({
  groupBy,
  key,
  label,
  attemptCount: 0,
  correctCount: 0,
  incorrectCount: 0,
  accuracy: null,
  ...DATA_LAB_EMPTY_LEARNING_MODEL_METRICS,
  averageResponseTimeMs: null,
  firstAttemptAt: null,
  lastAttemptAt: null,
  periodStart,
  periodEnd
});

const rowBoundDate = (row: DataLabAggregateRow, edge: "start" | "end"): Date | null => {
  const raw = edge === "start" ? (row.periodStart ?? row.key) : (row.periodEnd ?? row.periodStart ?? row.key);
  if (!raw) {
    return null;
  }
  if (row.groupBy === "month" && /^\d{4}-\d{2}$/.test(raw)) {
    const start = parseLocalYmd(`${raw}-01`);
    if (!start) {
      return null;
    }
    if (edge === "start") {
      return start;
    }
    return parseLocalYmd(lastLocalDayOfMonth(start));
  }
  return parseLocalYmd(raw.slice(0, 10));
};

const minMaxFromRows = (rows: DataLabAggregateRow[]): { start: Date; end: Date } | null => {
  let start: Date | null = null;
  let end: Date | null = null;
  for (const row of rows) {
    const rowStart = rowBoundDate(row, "start");
    const rowEnd = rowBoundDate(row, "end");
    if (rowStart && (!start || rowStart.getTime() < start.getTime())) {
      start = rowStart;
    }
    if (rowEnd && (!end || rowEnd.getTime() > end.getTime())) {
      end = rowEnd;
    }
  }
  if (!start || !end) {
    return null;
  }
  return { start, end };
};

const parseFilterYmd = (value: string | undefined): Date | null => {
  if (!value || !value.trim()) {
    return null;
  }
  return parseLocalYmd(value);
};

const resolveFillRange = (
  rows: DataLabAggregateRow[],
  dateFrom: string | undefined,
  dateTo: string | undefined
): { start: Date; end: Date } | null => {
  const from = parseFilterYmd(dateFrom);
  const to = parseFilterYmd(dateTo);
  const data = minMaxFromRows(rows);
  if (from && to) {
    return { start: from, end: to };
  }
  if (!data) {
    return null;
  }
  if (from && !to) {
    return { start: from, end: data.end };
  }
  if (!from && to) {
    return { start: data.start, end: to };
  }
  return data;
};

const enumerateDayRows = (
  start: Date,
  end: Date,
  existing: Map<string, DataLabAggregateRow>
): DataLabAggregateRow[] => {
  const filled: DataLabAggregateRow[] = [];
  for (let cursor = start; cursor.getTime() <= end.getTime(); cursor = addLocalDays(cursor, 1)) {
    const key = localYmd(cursor);
    const existingRow = existing.get(key);
    if (existingRow) {
      filled.push(existingRow);
      continue;
    }
    filled.push(emptyPeriodRow("day", key, key, key, key));
  }
  return filled;
};

const enumerateWeekRows = (
  start: Date,
  end: Date,
  existing: Map<string, DataLabAggregateRow>
): DataLabAggregateRow[] => {
  const filled: DataLabAggregateRow[] = [];
  const first = isoWeekKeyAndRange(start);
  const last = isoWeekKeyAndRange(end);
  const firstMonday = parseLocalYmd(first.periodStart);
  const lastMonday = parseLocalYmd(last.periodStart);
  if (!firstMonday || !lastMonday) {
    return [...existing.values()];
  }
  for (
    let cursor = firstMonday;
    cursor.getTime() <= lastMonday.getTime();
    cursor = addLocalDays(cursor, 7)
  ) {
    const week = isoWeekKeyAndRange(cursor);
    const existingRow = existing.get(week.key);
    if (existingRow) {
      filled.push(existingRow);
      continue;
    }
    filled.push(emptyPeriodRow("week", week.key, week.label, week.periodStart, week.periodEnd));
  }
  return filled;
};

const enumerateMonthRows = (
  start: Date,
  end: Date,
  existing: Map<string, DataLabAggregateRow>
): DataLabAggregateRow[] => {
  const filled: DataLabAggregateRow[] = [];
  const first = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  for (let cursor = first; cursor.getTime() <= last.getTime(); cursor = addLocalMonths(cursor, 1)) {
    const key = localYm(cursor);
    const existingRow = existing.get(key);
    if (existingRow) {
      filled.push(existingRow);
      continue;
    }
    const periodStart = `${key}-01`;
    const periodEnd = lastLocalDayOfMonth(cursor);
    filled.push(emptyPeriodRow("month", key, key, periodStart, periodEnd));
  }
  return filled;
};

/**
 * 日 / 週 / 月の集計行に、ログのない期間を表示用の空行として補う。
 * 集計そのもの（`aggregateDataLabLogs`）は変更しない。
 */
export const fillDataLabTimeSeries = (
  rows: DataLabAggregateRow[],
  { groupBy, dateFrom, dateTo }: FillDataLabTimeSeriesOptions
): DataLabAggregateRow[] => {
  if (!isTimeGroupBy(groupBy)) {
    return rows;
  }
  if (rows.length === 0) {
    return rows;
  }

  const range = resolveFillRange(rows, dateFrom, dateTo);
  if (!range || range.start.getTime() > range.end.getTime()) {
    return rows;
  }

  const existing = new Map(rows.map((row) => [row.key, row]));
  if (groupBy === "day") {
    return enumerateDayRows(range.start, range.end, existing);
  }
  if (groupBy === "week") {
    return enumerateWeekRows(range.start, range.end, existing);
  }
  return enumerateMonthRows(range.start, range.end, existing);
};
