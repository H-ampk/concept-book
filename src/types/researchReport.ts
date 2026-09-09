import type { DataLabAggregateRow, DataLabGroupBy } from "../utils/dataLab/aggregateDataLabLogs";
import type { DataLabMetric } from "../utils/dataLab/dataLabChartMetrics";
import type { DataLabDisplayMode } from "../utils/dataLab/dataLabDisplayMode";
import type { DataLabFilterChip } from "../utils/dataLab/describeDataLabFilters";
import type { DataLabFilters } from "../utils/dataLab/filterDataLabLogs";
import type { DataLabBarChartLimit, DataLabBarChartSort } from "../utils/dataLab/toDataLabBarChartRows";

export const DATA_LAB_ANALYSIS_SNAPSHOT_SCHEMA_VERSION = 1 as const;

export const MAX_RESEARCH_ANALYSIS_ROWS = 1000;

export type DataLabAnalysisSnapshot = {
  schemaVersion: typeof DATA_LAB_ANALYSIS_SNAPSHOT_SCHEMA_VERSION;
  createdAt: string;
  source: "data-lab";
  filters: DataLabFilters;
  filterChips: DataLabFilterChip[];
  filterLabels: string[];
  groupBy: DataLabGroupBy;
  metric: DataLabMetric;
  scatterXMetric?: DataLabMetric;
  scatterYMetric?: DataLabMetric;
  displayMode: DataLabDisplayMode;
  barSort?: DataLabBarChartSort;
  barLimit?: DataLabBarChartLimit;
  sourceLogCount: number;
  rows: DataLabAggregateRow[];
  totalRowCount: number;
  savedRowCount: number;
  truncated: boolean;
};

export type ResearchDataLabAnalysisBlock = {
  id: string;
  type: "data-lab-analysis";
  snapshot: DataLabAnalysisSnapshot;
  commentary: string;
};

export type ResearchReportBlock = ResearchDataLabAnalysisBlock;

export type ResearchReport = {
  id: string;
  title: string;
  blocks: ResearchReportBlock[];
  createdAt: string;
  updatedAt: string;
};
