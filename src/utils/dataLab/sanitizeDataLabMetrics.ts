import type { DataLabGroupBy } from "./aggregateDataLabLogs";
import { isDataLabConceptModelMetric, type DataLabMetric } from "./dataLabChartMetrics";

export const DATA_LAB_FALLBACK_METRIC: DataLabMetric = "accuracy";
export const DATA_LAB_SCATTER_SECONDARY_FALLBACK_METRIC: DataLabMetric = "averageResponseTimeMs";

export const isDataLabConceptModelMetricAvailable = (groupBy: DataLabGroupBy): boolean =>
  groupBy === "concept";

/** @deprecated isDataLabConceptModelMetricAvailable を使う */
export const isDataLabMasteryMetricAvailable = isDataLabConceptModelMetricAvailable;

export const coerceDataLabMetricForGroupBy = (
  metric: DataLabMetric,
  groupBy: DataLabGroupBy
): DataLabMetric => {
  if (isDataLabConceptModelMetric(metric) && !isDataLabConceptModelMetricAvailable(groupBy)) {
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
    if (isDataLabConceptModelMetric(scatterXMetric)) {
      nextX = scatterFallbackAvoiding(nextY);
    } else if (isDataLabConceptModelMetric(scatterYMetric)) {
      nextY = scatterFallbackAvoiding(nextX);
    }
  }

  return {
    metric: nextMetric,
    scatterXMetric: nextX,
    scatterYMetric: nextY
  };
};
