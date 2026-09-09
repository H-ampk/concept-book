import type { DataLabAggregateRow, DataLabGroupBy } from "./aggregateDataLabLogs";
import { formatDataLabMetricValue, getDataLabMetricValue, type DataLabMetric } from "./dataLabChartMetrics";

export type DataLabHistogramGroupBy = Extract<DataLabGroupBy, "concept" | "domain" | "deck">;

export type DataLabHistogramBin = {
  min: number;
  max: number;
  count: number;
  label: string;
  /** true なら max を含む。通常は最後の bin のみ（同一値のときは唯一の bin） */
  maxInclusive: boolean;
};

export const DATA_LAB_HISTOGRAM_MIN_BIN_COUNT = 1;
export const DATA_LAB_HISTOGRAM_MAX_BIN_COUNT = 20;

export const isDataLabHistogramGroupBy = (
  groupBy: DataLabGroupBy
): groupBy is DataLabHistogramGroupBy =>
  groupBy === "concept" || groupBy === "domain" || groupBy === "deck";

export const getDataLabHistogramBinCount = (valueCount: number): number => {
  if (valueCount <= 0) {
    return 0;
  }
  return Math.min(
    DATA_LAB_HISTOGRAM_MAX_BIN_COUNT,
    Math.max(DATA_LAB_HISTOGRAM_MIN_BIN_COUNT, Math.ceil(Math.sqrt(valueCount)))
  );
};

export const formatDataLabHistogramBinLabel = (
  metric: DataLabMetric,
  min: number,
  max: number
): string => {
  const minLabel = formatDataLabMetricValue(metric, min);
  if (min === max) {
    return minLabel;
  }
  return `${minLabel}〜${formatDataLabMetricValue(metric, max)}`;
};

export const isValueInDataLabHistogramBin = (value: number, bin: DataLabHistogramBin): boolean => {
  if (value < bin.min) {
    return false;
  }
  if (bin.maxInclusive) {
    return value <= bin.max;
  }
  return value < bin.max;
};

const collectMetricValues = (rows: DataLabAggregateRow[], metric: DataLabMetric): number[] => {
  const values: number[] = [];
  for (const row of rows) {
    const value = getDataLabMetricValue(row, metric);
    if (value == null || !Number.isFinite(value)) {
      continue;
    }
    values.push(value);
  }
  return values;
};

const histogramBinIndex = (value: number, min: number, max: number, binCount: number): number => {
  if (value <= min) {
    return 0;
  }
  if (value >= max) {
    return binCount - 1;
  }
  const index = Math.floor(((value - min) / (max - min)) * binCount);
  return Math.min(binCount - 1, Math.max(0, index));
};

export const toDataLabHistogramBins = (
  rows: DataLabAggregateRow[],
  metric: DataLabMetric
): DataLabHistogramBin[] => {
  const values = collectMetricValues(rows, metric);
  if (values.length === 0) {
    return [];
  }

  let min = values[0]!;
  let max = values[0]!;
  for (const value of values) {
    if (value < min) {
      min = value;
    }
    if (value > max) {
      max = value;
    }
  }

  if (min === max) {
    return [
      {
        min,
        max,
        count: values.length,
        label: formatDataLabHistogramBinLabel(metric, min, max),
        maxInclusive: true
      }
    ];
  }

  const binCount = getDataLabHistogramBinCount(values.length);
  const span = max - min;
  const counts = new Array<number>(binCount).fill(0);
  for (const value of values) {
    counts[histogramBinIndex(value, min, max, binCount)] += 1;
  }

  return counts.map((count, index) => {
    const binMin = min + (index * span) / binCount;
    const isLast = index === binCount - 1;
    const binMax = isLast ? max : min + ((index + 1) * span) / binCount;
    return {
      min: binMin,
      max: binMax,
      count,
      label: formatDataLabHistogramBinLabel(metric, binMin, binMax),
      maxInclusive: isLast
    };
  });
};
