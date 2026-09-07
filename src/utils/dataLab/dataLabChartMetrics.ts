import type { DataLabAggregateRow } from "./aggregateDataLabLogs";
import {
  DATA_LAB_MISSING_VALUE,
  formatDataLabAccuracy,
  formatDataLabAverageResponseTime
} from "./formatDataLabTable";

export type DataLabMetric =
  | "attemptCount"
  | "correctCount"
  | "incorrectCount"
  | "accuracy"
  | "averageResponseTimeMs";

export const DATA_LAB_METRIC_LABELS: Record<DataLabMetric, string> = {
  attemptCount: "回答数",
  correctCount: "正答数",
  incorrectCount: "誤答数",
  accuracy: "正答率",
  averageResponseTimeMs: "平均回答時間"
};

export const DATA_LAB_METRIC_OPTIONS: { value: DataLabMetric; label: string }[] = [
  { value: "attemptCount", label: DATA_LAB_METRIC_LABELS.attemptCount },
  { value: "correctCount", label: DATA_LAB_METRIC_LABELS.correctCount },
  { value: "incorrectCount", label: DATA_LAB_METRIC_LABELS.incorrectCount },
  { value: "accuracy", label: DATA_LAB_METRIC_LABELS.accuracy },
  { value: "averageResponseTimeMs", label: DATA_LAB_METRIC_LABELS.averageResponseTimeMs }
];

export const getDataLabMetricValue = (
  row: DataLabAggregateRow,
  metric: DataLabMetric
): number | null => {
  switch (metric) {
    case "attemptCount":
      return row.attemptCount;
    case "correctCount":
      return row.correctCount;
    case "incorrectCount":
      return row.incorrectCount;
    case "accuracy":
      return row.accuracy;
    case "averageResponseTimeMs":
      return row.averageResponseTimeMs;
  }
};

export const formatDataLabMetricValue = (metric: DataLabMetric, value: number | null): string => {
  if (value == null) {
    return DATA_LAB_MISSING_VALUE;
  }
  if (metric === "accuracy") {
    return formatDataLabAccuracy(value);
  }
  if (metric === "averageResponseTimeMs") {
    return formatDataLabAverageResponseTime(value);
  }
  return String(value);
};

export const formatDataLabMetricYTick = (metric: DataLabMetric, value: number): string =>
  formatDataLabMetricValue(metric, value);

export const formatDataLabMetricTooltipValue = (metric: DataLabMetric, value: number | null): string =>
  formatDataLabMetricValue(metric, value);

export const getDataLabMetricYDomain = (metric: DataLabMetric): [number, number] | [number, "auto"] => {
  if (metric === "accuracy") {
    return [0, 1];
  }
  return [0, "auto"];
};

/** 横棒グラフの値軸（X）でも同じ domain を使う */
export const getDataLabMetricValueAxisDomain = getDataLabMetricYDomain;
