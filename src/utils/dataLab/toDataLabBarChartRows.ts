import type { DataLabAggregateRow, DataLabGroupBy } from "./aggregateDataLabLogs";
import { getDataLabMetricValue, type DataLabMetric } from "./dataLabChartMetrics";

export type DataLabBarChartCategoryGroupBy = Extract<DataLabGroupBy, "concept" | "domain" | "deck">;

export type DataLabBarChartSort = "valueDesc" | "valueAsc" | "name" | "original";

export type DataLabBarChartLimit = 10 | 20 | 50 | "all";

export type DataLabBarChartRow = {
  key: string;
  label: string;
  value: number;
  attemptCount: number;
};

export const DATA_LAB_BAR_CHART_SORT_OPTIONS: { value: DataLabBarChartSort; label: string }[] = [
  { value: "valueDesc", label: "値の高い順" },
  { value: "valueAsc", label: "値の低い順" },
  { value: "name", label: "名前順" },
  { value: "original", label: "元の順序" }
];

export const DATA_LAB_BAR_CHART_LIMIT_OPTIONS: { value: DataLabBarChartLimit; label: string }[] = [
  { value: 10, label: "10" },
  { value: 20, label: "20" },
  { value: 50, label: "50" },
  { value: "all", label: "すべて" }
];

export const isDataLabBarChartGroupBy = (
  groupBy: DataLabGroupBy
): groupBy is DataLabBarChartCategoryGroupBy =>
  groupBy === "concept" || groupBy === "domain" || groupBy === "deck";

const compareByLabelThenKey = (a: { label: string; key: string }, b: { label: string; key: string }): number => {
  const byLabel = a.label.localeCompare(b.label, "ja");
  if (byLabel !== 0) {
    return byLabel;
  }
  return a.key.localeCompare(b.key, "ja");
};

export const toDataLabBarChartRows = (
  rows: DataLabAggregateRow[],
  metric: DataLabMetric,
  sort: DataLabBarChartSort = "valueDesc",
  limit: DataLabBarChartLimit = 10
): DataLabBarChartRow[] => {
  const mapped: Array<DataLabBarChartRow & { index: number }> = [];
  rows.forEach((row, index) => {
    const value = getDataLabMetricValue(row, metric);
    if (value == null) {
      return;
    }
    mapped.push({
      key: row.key,
      label: row.label,
      value,
      attemptCount: row.attemptCount,
      index
    });
  });

  mapped.sort((a, b) => {
    if (sort === "original") {
      return a.index - b.index;
    }
    if (sort === "name") {
      return compareByLabelThenKey(a, b);
    }
    const byValue = sort === "valueDesc" ? b.value - a.value : a.value - b.value;
    if (byValue !== 0) {
      return byValue;
    }
    return compareByLabelThenKey(a, b);
  });

  const count = limit === "all" ? mapped.length : limit;
  return mapped.slice(0, count).map(({ key, label, value, attemptCount }) => ({
    key,
    label,
    value,
    attemptCount
  }));
};
