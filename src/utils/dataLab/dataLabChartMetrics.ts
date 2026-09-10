import type { DataLabAggregateRow, DataLabGroupBy } from "./aggregateDataLabLogs";
import {
  DATA_LAB_MISSING_VALUE,
  formatDataLabAccuracy,
  formatDataLabAverageResponseTime,
  formatDataLabDays,
  formatDataLabMastery,
  formatDataLabNullableCount
} from "./formatDataLabTable";

export type DataLabMetric =
  | "attemptCount"
  | "correctCount"
  | "incorrectCount"
  | "accuracy"
  | "mastery"
  | "pfaNextCorrectProbability"
  | "hlrRetentionProbability"
  | "hlrHalfLifeDays"
  | "hlrElapsedDays"
  | "averageResponseTimeMs";

export const DATA_LAB_CONCEPT_MODEL_METRICS = [
  "mastery",
  "pfaNextCorrectProbability",
  "hlrRetentionProbability",
  "hlrHalfLifeDays",
  "hlrElapsedDays"
] as const satisfies readonly DataLabMetric[];

export type DataLabConceptModelMetric = (typeof DATA_LAB_CONCEPT_MODEL_METRICS)[number];

export const isDataLabConceptModelMetric = (metric: DataLabMetric): metric is DataLabConceptModelMetric =>
  (DATA_LAB_CONCEPT_MODEL_METRICS as readonly DataLabMetric[]).includes(metric);

const DATA_LAB_UNIT_INTERVAL_METRICS: ReadonlySet<DataLabMetric> = new Set([
  "accuracy",
  "mastery",
  "pfaNextCorrectProbability",
  "hlrRetentionProbability"
]);

export const DATA_LAB_METRIC_LABELS: Record<DataLabMetric, string> = {
  attemptCount: "回答数",
  correctCount: "正答数",
  incorrectCount: "誤答数",
  accuracy: "正答率",
  mastery: "BKT 理解度",
  pfaNextCorrectProbability: "PFA 次回正答確率",
  hlrRetentionProbability: "HLR 記憶保持率",
  hlrHalfLifeDays: "HLR 半減期",
  hlrElapsedDays: "HLR 最終学習からの経過日数",
  averageResponseTimeMs: "平均回答時間"
};

export const DATA_LAB_METRIC_OPTIONS: { value: DataLabMetric; label: string }[] = [
  { value: "attemptCount", label: DATA_LAB_METRIC_LABELS.attemptCount },
  { value: "correctCount", label: DATA_LAB_METRIC_LABELS.correctCount },
  { value: "incorrectCount", label: DATA_LAB_METRIC_LABELS.incorrectCount },
  { value: "accuracy", label: DATA_LAB_METRIC_LABELS.accuracy },
  { value: "mastery", label: DATA_LAB_METRIC_LABELS.mastery },
  { value: "pfaNextCorrectProbability", label: DATA_LAB_METRIC_LABELS.pfaNextCorrectProbability },
  { value: "hlrRetentionProbability", label: DATA_LAB_METRIC_LABELS.hlrRetentionProbability },
  { value: "hlrHalfLifeDays", label: DATA_LAB_METRIC_LABELS.hlrHalfLifeDays },
  { value: "hlrElapsedDays", label: DATA_LAB_METRIC_LABELS.hlrElapsedDays },
  { value: "averageResponseTimeMs", label: DATA_LAB_METRIC_LABELS.averageResponseTimeMs }
];

export const getDataLabMetricOptions = (
  groupBy: DataLabGroupBy
): { value: DataLabMetric; label: string }[] =>
  DATA_LAB_METRIC_OPTIONS.filter(
    (option) => !isDataLabConceptModelMetric(option.value) || groupBy === "concept"
  );

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
    case "mastery":
      return row.masteryProbability ?? null;
    case "pfaNextCorrectProbability":
      return row.pfaNextCorrectProbability ?? null;
    case "hlrRetentionProbability":
      return row.hlrRetentionProbability ?? null;
    case "hlrHalfLifeDays":
      return row.hlrHalfLifeDays ?? null;
    case "hlrElapsedDays":
      return row.hlrElapsedDays ?? null;
    case "averageResponseTimeMs":
      return row.averageResponseTimeMs;
  }
};

export const formatDataLabMetricValue = (metric: DataLabMetric, value: number | null): string => {
  if (value == null) {
    return DATA_LAB_MISSING_VALUE;
  }
  if (metric === "accuracy" || metric === "pfaNextCorrectProbability" || metric === "hlrRetentionProbability") {
    return formatDataLabAccuracy(value);
  }
  if (metric === "mastery") {
    return formatDataLabMastery(value);
  }
  if (metric === "hlrHalfLifeDays" || metric === "hlrElapsedDays") {
    return formatDataLabDays(value);
  }
  if (metric === "averageResponseTimeMs") {
    return formatDataLabAverageResponseTime(value);
  }
  return formatDataLabNullableCount(value);
};

export const formatDataLabMetricYTick = (metric: DataLabMetric, value: number): string =>
  formatDataLabMetricValue(metric, value);

export const formatDataLabMetricTooltipValue = (metric: DataLabMetric, value: number | null): string =>
  formatDataLabMetricValue(metric, value);

export const getDataLabMetricYDomain = (metric: DataLabMetric): [number, number] | [number, "auto"] => {
  if (DATA_LAB_UNIT_INTERVAL_METRICS.has(metric)) {
    return [0, 1];
  }
  return [0, "auto"];
};

/** 横棒グラフの値軸（X）でも同じ domain を使う */
export const getDataLabMetricValueAxisDomain = getDataLabMetricYDomain;

/** 散布図など、X/Y どちらでも同じ domain を使う */
export const getDataLabMetricAxisDomain = getDataLabMetricYDomain;

export const getDataLabMetricAxisLabel = (metric: DataLabMetric): string => {
  if (metric === "accuracy") {
    return "正答率（%）";
  }
  if (metric === "mastery") {
    return "BKT 理解度（%）";
  }
  if (metric === "pfaNextCorrectProbability") {
    return "PFA 次回正答確率（%）";
  }
  if (metric === "hlrRetentionProbability") {
    return "HLR 記憶保持率（%）";
  }
  if (metric === "hlrHalfLifeDays") {
    return "HLR 半減期（日）";
  }
  if (metric === "hlrElapsedDays") {
    return "HLR 最終学習からの経過日数（日）";
  }
  if (metric === "averageResponseTimeMs") {
    return "平均回答時間（秒）";
  }
  return DATA_LAB_METRIC_LABELS[metric];
};
