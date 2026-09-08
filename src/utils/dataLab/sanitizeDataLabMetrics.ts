import type { DataLabGroupBy } from "./aggregateDataLabLogs";
import type { DataLabMetric } from "./dataLabChartMetrics";

export const DATA_LAB_FALLBACK_METRIC: DataLabMetric = "accuracy";
export const DATA_LAB_SCATTER_SECONDARY_FALLBACK_METRIC: DataLabMetric = "averageResponseTimeMs";

export const isDataLabMasteryMetricAvailable = (groupBy: DataLabGroupBy): boolean =>
  groupBy === "concept";

export const coerceDataLabMetricForGroupBy = (
  metric: DataLabMetric,
  groupBy: DataLabGroupBy
): DataLabMetric => {
  if (metric === "mastery" && !isDataLabMasteryMetricAvailable(groupBy)) {
    return DATA_LAB_FALLBACK_METRIC;
  }
  return metric;
};

const scatterFallbackAvoiding = (occupied: DataLabMetric): DataLabMetric => {
  if (occupied === DATA_LAB_SCATTER_SECONDARY_FALLBACK_METRIC) {
    return "attemptCount";
  }
  return DATA_LAB_SCATTER_SECONDARY_FALLBACK_METRIC;
};

export const sanitizeDataLabAnalysisMetrics = ({
  groupBy,
  metric,
  scatterXMetric,
  scatterYMetric
}: {
  groupBy: DataLabGroupBy;
  metric: DataLabMetric;
  scatterXMetric: DataLabMetric;
  scatterYMetric: DataLabMetric;
}): {
  metric: DataLabMetric;
  scatterXMetric: DataLabMetric;
  scatterYMetric: DataLabMetric;
} => {
  let nextMetric = coerceDataLabMetricForGroupBy(metric, groupBy);
  let nextX = coerceDataLabMetricForGroupBy(scatterXMetric, groupBy);
  let nextY = coerceDataLabMetricForGroupBy(scatterYMetric, groupBy);

  if (nextX === nextY) {
    if (scatterXMetric === "mastery") {
      nextX = scatterFallbackAvoiding(nextY);
    } else if (scatterYMetric === "mastery") {
      nextY = scatterFallbackAvoiding(nextX);
    }
  }

  return {
    metric: nextMetric,
    scatterXMetric: nextX,
    scatterYMetric: nextY
  };
};
