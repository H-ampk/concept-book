import type { DataLabAnalysisSnapshot } from "../../types/researchReport";
import { DATA_LAB_DISPLAY_MODE_OPTIONS } from "../dataLab/dataLabDisplayMode";
import { DATA_LAB_GROUP_BY_CONTROL_LABELS } from "../dataLab/dataLabGroupByLabels";
import { DATA_LAB_METRIC_LABELS } from "../dataLab/dataLabChartMetrics";
import { DATA_LAB_BAR_CHART_LIMIT_OPTIONS, DATA_LAB_BAR_CHART_SORT_OPTIONS } from "../dataLab/toDataLabBarChartRows";
import { shortDateTime } from "../date";

export type ResearchAnalysisSnapshotView = {
  createdAtLabel: string;
  filterLabels: string[];
  groupByLabel: string;
  metricLabel: string;
  displayModeLabel: string;
  scatterXLabel?: string;
  scatterYLabel?: string;
  barSortLabel?: string;
  barLimitLabel?: string;
  sourceLogCount: number;
  rowLabels: string[];
  truncationLabel: string | null;
};

const displayModeLabel = (snapshot: DataLabAnalysisSnapshot): string =>
  DATA_LAB_DISPLAY_MODE_OPTIONS.find((option) => option.value === snapshot.displayMode)?.label ??
  snapshot.displayMode;

export const formatResearchAnalysisSnapshotView = (
  snapshot: DataLabAnalysisSnapshot
): ResearchAnalysisSnapshotView => {
  const truncationLabel = snapshot.truncated
    ? `${snapshot.savedRowCount} / ${snapshot.totalRowCount} 行を保存`
    : null;

  return {
    createdAtLabel: shortDateTime(snapshot.createdAt),
    filterLabels: [...snapshot.filterLabels],
    groupByLabel: DATA_LAB_GROUP_BY_CONTROL_LABELS[snapshot.groupBy],
    metricLabel: DATA_LAB_METRIC_LABELS[snapshot.metric],
    displayModeLabel: displayModeLabel(snapshot),
    scatterXLabel:
      snapshot.displayMode === "scatter" && snapshot.scatterXMetric
        ? DATA_LAB_METRIC_LABELS[snapshot.scatterXMetric]
        : undefined,
    scatterYLabel:
      snapshot.displayMode === "scatter" && snapshot.scatterYMetric
        ? DATA_LAB_METRIC_LABELS[snapshot.scatterYMetric]
        : undefined,
    barSortLabel:
      snapshot.displayMode === "bar" && snapshot.barSort
        ? DATA_LAB_BAR_CHART_SORT_OPTIONS.find((option) => option.value === snapshot.barSort)?.label
        : undefined,
    barLimitLabel:
      snapshot.displayMode === "bar" && snapshot.barLimit != null
        ? DATA_LAB_BAR_CHART_LIMIT_OPTIONS.find((option) => option.value === snapshot.barLimit)?.label
        : undefined,
    sourceLogCount: snapshot.sourceLogCount,
    rowLabels: snapshot.rows.map((row) => row.label),
    truncationLabel
  };
};
