import type { DataLabAggregateRow, DataLabGroupBy } from "./aggregateDataLabLogs";
import { getDataLabMetricValue, type DataLabMetric } from "./dataLabChartMetrics";

export type DataLabScatterGroupBy = Extract<DataLabGroupBy, "concept" | "domain" | "deck">;

export type DataLabScatterPoint = {
  key: string;
  label: string;
  x: number;
  y: number;
  attemptCount: number;
  correctCount: number;
  incorrectCount: number;
  accuracy: number | null;
  averageResponseTimeMs: number | null;
};

export const isDataLabScatterGroupBy = (
  groupBy: DataLabGroupBy
): groupBy is DataLabScatterGroupBy =>
  groupBy === "concept" || groupBy === "domain" || groupBy === "deck";

export const toDataLabScatterPoints = (
  rows: DataLabAggregateRow[],
  xMetric: DataLabMetric,
  yMetric: DataLabMetric
): DataLabScatterPoint[] => {
  const points: DataLabScatterPoint[] = [];
  for (const row of rows) {
    const x = getDataLabMetricValue(row, xMetric);
    const y = getDataLabMetricValue(row, yMetric);
    if (x == null || y == null) {
      continue;
    }
    points.push({
      key: row.key,
      label: row.label,
      x,
      y,
      attemptCount: row.attemptCount,
      correctCount: row.correctCount,
      incorrectCount: row.incorrectCount,
      accuracy: row.accuracy,
      averageResponseTimeMs: row.averageResponseTimeMs
    });
  }
  return points;
};
