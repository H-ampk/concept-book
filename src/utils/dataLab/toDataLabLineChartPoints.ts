import type { DataLabAggregateRow, DataLabGroupBy } from "./aggregateDataLabLogs";
import { getDataLabMetricValue, type DataLabMetric } from "./dataLabChartMetrics";

export type DataLabLineChartTimeGroupBy = Extract<DataLabGroupBy, "day" | "week" | "month">;

export type DataLabLineChartPoint = {
  key: string;
  xLabel: string;
  tooltipPeriod: string;
  value: number | null;
  attemptCount: number;
};

type YmdParts = { y: number; m: number; d: number };

export const isDataLabLineChartGroupBy = (
  groupBy: DataLabGroupBy
): groupBy is DataLabLineChartTimeGroupBy =>
  groupBy === "day" || groupBy === "week" || groupBy === "month";

const parseYmd = (value: string | null | undefined): YmdParts | null => {
  if (!value) {
    return null;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
};

const parseYm = (value: string | null | undefined): { y: number; m: number } | null => {
  if (!value) {
    return null;
  }
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }
  return { y: Number(match[1]), m: Number(match[2]) };
};

const pad2 = (n: number): string => String(n).padStart(2, "0");

const formatMd = (parts: YmdParts, includeYear: boolean): string =>
  includeYear ? `${parts.y}/${parts.m}/${parts.d}` : `${parts.m}/${parts.d}`;

const formatYmdSlash = (parts: YmdParts): string => `${parts.y}/${pad2(parts.m)}/${pad2(parts.d)}`;

const yearsInDayRows = (rows: DataLabAggregateRow[]): Set<number> => {
  const years = new Set<number>();
  for (const row of rows) {
    const parts = parseYmd(row.periodStart ?? row.key);
    if (parts) {
      years.add(parts.y);
    }
  }
  return years;
};

const formatDayXLabel = (row: DataLabAggregateRow, includeYear: boolean): string => {
  const parts = parseYmd(row.periodStart ?? row.key);
  if (!parts) {
    return row.label;
  }
  return formatMd(parts, includeYear);
};

const formatDayTooltipPeriod = (row: DataLabAggregateRow): string => {
  const parts = parseYmd(row.periodStart ?? row.key);
  if (!parts) {
    return row.label;
  }
  return formatYmdSlash(parts);
};

const formatWeekXLabel = (row: DataLabAggregateRow): string => {
  const start = parseYmd(row.periodStart ?? null);
  const end = parseYmd(row.periodEnd ?? null);
  if (!start || !end) {
    return row.label;
  }
  const includeYear = start.y !== end.y;
  return `${formatMd(start, includeYear)}〜${formatMd(end, includeYear)}`;
};

const formatWeekTooltipPeriod = (row: DataLabAggregateRow): string => {
  const start = parseYmd(row.periodStart ?? null);
  const end = parseYmd(row.periodEnd ?? null);
  if (!start || !end) {
    return row.label;
  }
  return `${formatYmdSlash(start)}〜${formatYmdSlash(end)}`;
};

const formatMonthXLabel = (row: DataLabAggregateRow): string => {
  const ym = parseYm(row.key) ?? parseYm((row.periodStart ?? "").slice(0, 7));
  if (!ym) {
    return row.label;
  }
  return `${ym.y}/${pad2(ym.m)}`;
};

export const formatDataLabLineChartXLabel = (
  row: DataLabAggregateRow,
  groupBy: DataLabLineChartTimeGroupBy,
  includeYearOnDay: boolean
): string => {
  if (groupBy === "day") {
    return formatDayXLabel(row, includeYearOnDay);
  }
  if (groupBy === "week") {
    return formatWeekXLabel(row);
  }
  return formatMonthXLabel(row);
};

export const formatDataLabLineChartTooltipPeriod = (
  row: DataLabAggregateRow,
  groupBy: DataLabLineChartTimeGroupBy
): string => {
  if (groupBy === "day") {
    return formatDayTooltipPeriod(row);
  }
  if (groupBy === "week") {
    return formatWeekTooltipPeriod(row);
  }
  return formatMonthXLabel(row);
};

export const getDataLabLineChartXTickInterval = (pointCount: number): number => {
  if (pointCount <= 8) {
    return 0;
  }
  return Math.max(0, Math.ceil(pointCount / 8) - 1);
};

export const toDataLabLineChartPoints = (
  rows: DataLabAggregateRow[],
  groupBy: DataLabLineChartTimeGroupBy,
  metric: DataLabMetric
): DataLabLineChartPoint[] => {
  const includeYearOnDay = yearsInDayRows(rows).size > 1;
  return rows.map((row) => ({
    key: row.key,
    xLabel: formatDataLabLineChartXLabel(row, groupBy, includeYearOnDay),
    tooltipPeriod: formatDataLabLineChartTooltipPeriod(row, groupBy),
    value: getDataLabMetricValue(row, metric),
    attemptCount: row.attemptCount
  }));
};
