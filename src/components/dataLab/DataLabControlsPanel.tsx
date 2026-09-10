import type { DataLabGroupBy } from "../../utils/dataLab/aggregateDataLabLogs";
import { getDataLabMetricOptions, type DataLabMetric } from "../../utils/dataLab/dataLabChartMetrics";
import { DATA_LAB_DISPLAY_MODE_OPTIONS, type DataLabDisplayMode } from "../../utils/dataLab/dataLabDisplayMode";
import { DATA_LAB_GROUP_BY_OPTIONS } from "../../utils/dataLab/dataLabGroupByLabels";
import { DATA_LAB_LEARNING_MODEL_CURRENT_METRICS_NOTE } from "../../utils/dataLab/describeDataLabMetricAggregation";
import {
  DATA_LAB_BAR_CHART_LIMIT_OPTIONS,
  DATA_LAB_BAR_CHART_SORT_OPTIONS,
  type DataLabBarChartLimit,
  type DataLabBarChartSort
} from "../../utils/dataLab/toDataLabBarChartRows";

const inputClass =
  "w-full rounded-md border border-celestial-border/60 bg-nordic-navy/50 px-3 py-2 text-sm text-celestial-textMain focus:outline-none focus-visible:ring-2 focus-visible:ring-celestial-gold/55";

type Props = {
  groupBy: DataLabGroupBy;
  onGroupByChange: (groupBy: DataLabGroupBy) => void;
  metric: DataLabMetric;
  onMetricChange: (metric: DataLabMetric) => void;
  scatterXMetric: DataLabMetric;
  onScatterXMetricChange: (metric: DataLabMetric) => void;
  scatterYMetric: DataLabMetric;
  onScatterYMetricChange: (metric: DataLabMetric) => void;
  displayMode: DataLabDisplayMode;
  onDisplayModeChange: (displayMode: DataLabDisplayMode) => void;
  barSort: DataLabBarChartSort;
  onBarSortChange: (sort: DataLabBarChartSort) => void;
  barLimit: DataLabBarChartLimit;
  onBarLimitChange: (limit: DataLabBarChartLimit) => void;
};

const parseBarLimit = (value: string): DataLabBarChartLimit => {
  if (value === "all") {
    return "all";
  }
  if (value === "20") {
    return 20;
  }
  if (value === "50") {
    return 50;
  }
  return 10;
};

export const DataLabControlsPanel = ({
  groupBy,
  onGroupByChange,
  metric,
  onMetricChange,
  scatterXMetric,
  onScatterXMetricChange,
  scatterYMetric,
  onScatterYMetricChange,
  displayMode,
  onDisplayModeChange,
  barSort,
  onBarSortChange,
  barLimit,
  onBarLimitChange
}: Props) => {
  const metricOptions = getDataLabMetricOptions(groupBy);

  return (
    <section
      className="relative min-w-0 max-w-full rounded-3xl border border-celestial-border bg-celestial-panel/90 p-5 shadow-celestial backdrop-blur-md decorated-card sm:p-6"
      aria-labelledby="data-lab-controls-title"
    >
      <div className="relative z-[1] space-y-4">
        <div className="space-y-1">
          <h2 id="data-lab-controls-title" className="text-sm font-semibold text-celestial-softGold">
            分析条件
          </h2>
          <p className="text-xs text-celestial-textSub">
            集計軸・指標・表示を切り替えると、分析結果が更新されます。
          </p>
          {groupBy === "concept" ? (
            <p className="text-xs leading-relaxed text-celestial-textSub">
              {DATA_LAB_LEARNING_MODEL_CURRENT_METRICS_NOTE}
            </p>
          ) : null}
        </div>

        <div
          className={
            displayMode === "scatter"
              ? "grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4"
              : "grid grid-cols-1 gap-3 md:grid-cols-3"
          }
        >
          <div className="min-w-0">
            <label htmlFor="data-lab-control-axis" className="mb-1.5 block text-xs font-medium text-celestial-textSub">
              集計軸
            </label>
            <select
              id="data-lab-control-axis"
              value={groupBy}
              onChange={(event) => onGroupByChange(event.target.value as DataLabGroupBy)}
              className={inputClass}
            >
              {DATA_LAB_GROUP_BY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {displayMode === "scatter" ? (
            <>
              <div className="min-w-0">
                <label htmlFor="data-lab-control-scatter-x" className="mb-1.5 block text-xs font-medium text-celestial-textSub">
                  X軸
                </label>
                <select
                  id="data-lab-control-scatter-x"
                  value={scatterXMetric}
                  onChange={(event) => {
                    const next = event.target.value as DataLabMetric;
                    if (next === scatterYMetric) {
                      return;
                    }
                    onScatterXMetricChange(next);
                  }}
                  className={inputClass}
                >
                  {metricOptions.map((option) => (
                    <option key={option.value} value={option.value} disabled={option.value === scatterYMetric}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-0">
                <label htmlFor="data-lab-control-scatter-y" className="mb-1.5 block text-xs font-medium text-celestial-textSub">
                  Y軸
                </label>
                <select
                  id="data-lab-control-scatter-y"
                  value={scatterYMetric}
                  onChange={(event) => {
                    const next = event.target.value as DataLabMetric;
                    if (next === scatterXMetric) {
                      return;
                    }
                    onScatterYMetricChange(next);
                  }}
                  className={inputClass}
                >
                  {metricOptions.map((option) => (
                    <option key={option.value} value={option.value} disabled={option.value === scatterXMetric}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <div className="min-w-0">
              <label htmlFor="data-lab-control-metric" className="mb-1.5 block text-xs font-medium text-celestial-textSub">
                指標
              </label>
              <select
                id="data-lab-control-metric"
                value={metric}
                onChange={(event) => onMetricChange(event.target.value as DataLabMetric)}
                className={inputClass}
              >
                {metricOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="min-w-0">
            <label htmlFor="data-lab-control-display" className="mb-1.5 block text-xs font-medium text-celestial-textSub">
              表示
            </label>
            <select
              id="data-lab-control-display"
              value={displayMode}
              onChange={(event) => onDisplayModeChange(event.target.value as DataLabDisplayMode)}
              className={inputClass}
            >
              {DATA_LAB_DISPLAY_MODE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {displayMode === "bar" ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="min-w-0">
              <label htmlFor="data-lab-control-bar-sort" className="mb-1.5 block text-xs font-medium text-celestial-textSub">
                並び順
              </label>
              <select
                id="data-lab-control-bar-sort"
                value={barSort}
                onChange={(event) => onBarSortChange(event.target.value as DataLabBarChartSort)}
                className={inputClass}
              >
                {DATA_LAB_BAR_CHART_SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-0">
              <label htmlFor="data-lab-control-bar-limit" className="mb-1.5 block text-xs font-medium text-celestial-textSub">
                表示件数
              </label>
              <select
                id="data-lab-control-bar-limit"
                value={String(barLimit)}
                onChange={(event) => onBarLimitChange(parseBarLimit(event.target.value))}
                className={inputClass}
              >
                {DATA_LAB_BAR_CHART_LIMIT_OPTIONS.map((option) => (
                  <option key={String(option.value)} value={String(option.value)}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
};
