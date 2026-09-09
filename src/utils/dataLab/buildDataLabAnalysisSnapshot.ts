import type { DataLabAggregateRow, DataLabGroupBy } from "./aggregateDataLabLogs";
import type { DataLabMetric } from "./dataLabChartMetrics";
import type { DataLabDisplayMode } from "./dataLabDisplayMode";
import type { DataLabFilterChip } from "./describeDataLabFilters";
import type { DataLabFilters } from "./filterDataLabLogs";
import type { DataLabBarChartLimit, DataLabBarChartSort } from "./toDataLabBarChartRows";
import {
  DATA_LAB_ANALYSIS_SNAPSHOT_SCHEMA_VERSION,
  MAX_RESEARCH_ANALYSIS_ROWS,
  type DataLabAnalysisSnapshot
} from "../../types/researchReport";
import { nowIso } from "../date";

export type BuildDataLabAnalysisSnapshotInput = {
  filters: DataLabFilters;
  filterChips: DataLabFilterChip[];
  groupBy: DataLabGroupBy;
  metric: DataLabMetric;
  scatterXMetric?: DataLabMetric;
  scatterYMetric?: DataLabMetric;
  displayMode: DataLabDisplayMode;
  barSort?: DataLabBarChartSort;
  barLimit?: DataLabBarChartLimit;
  filteredLogCount: number;
  aggregatedRows: DataLabAggregateRow[];
};

export type BuildDataLabAnalysisSnapshotOptions = {
  now?: string;
  maxRows?: number;
};

const cloneFilters = (filters: DataLabFilters): DataLabFilters => ({
  dateFrom: filters.dateFrom,
  dateTo: filters.dateTo,
  conceptIds: [...filters.conceptIds],
  domainTags: [...filters.domainTags],
  deckIds: [...filters.deckIds],
  correctness: filters.correctness
});

const cloneFilterChips = (chips: DataLabFilterChip[]): DataLabFilterChip[] =>
  chips.map((chip) => ({ id: chip.id, label: chip.label }));

const cloneRow = (row: DataLabAggregateRow): DataLabAggregateRow => ({ ...row });

export const buildDataLabAnalysisSnapshot = (
  input: BuildDataLabAnalysisSnapshotInput,
  options?: BuildDataLabAnalysisSnapshotOptions
): DataLabAnalysisSnapshot => {
  const maxRows = options?.maxRows ?? MAX_RESEARCH_ANALYSIS_ROWS;
  const totalRowCount = input.aggregatedRows.length;
  const truncated = totalRowCount > maxRows;
  const savedRows = input.aggregatedRows.slice(0, maxRows).map(cloneRow);
  const chips = cloneFilterChips(input.filterChips);

  const snapshot: DataLabAnalysisSnapshot = {
    schemaVersion: DATA_LAB_ANALYSIS_SNAPSHOT_SCHEMA_VERSION,
    createdAt: options?.now ?? nowIso(),
    source: "data-lab",
    filters: cloneFilters(input.filters),
    filterChips: chips,
    filterLabels: chips.map((chip) => chip.label),
    groupBy: input.groupBy,
    metric: input.metric,
    displayMode: input.displayMode,
    sourceLogCount: input.filteredLogCount,
    rows: savedRows,
    totalRowCount,
    savedRowCount: savedRows.length,
    truncated
  };

  if (input.displayMode === "scatter") {
    snapshot.scatterXMetric = input.scatterXMetric;
    snapshot.scatterYMetric = input.scatterYMetric;
  }

  if (input.displayMode === "bar") {
    snapshot.barSort = input.barSort;
    snapshot.barLimit = input.barLimit;
  }

  return snapshot;
};
