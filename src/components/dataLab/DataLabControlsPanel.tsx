import type { DataLabGroupBy } from "../../utils/dataLab/aggregateDataLabLogs";
import { DATA_LAB_METRIC_OPTIONS, type DataLabMetric } from "../../utils/dataLab/dataLabChartMetrics";
import { DATA_LAB_DISPLAY_MODE_OPTIONS, type DataLabDisplayMode } from "../../utils/dataLab/dataLabDisplayMode";
import { DATA_LAB_GROUP_BY_OPTIONS } from "../../utils/dataLab/dataLabGroupByLabels";

const inputClass =
  "w-full rounded-md border border-celestial-border/60 bg-nordic-navy/50 px-3 py-2 text-sm text-celestial-textMain focus:outline-none focus-visible:ring-2 focus-visible:ring-celestial-gold/55";

type Props = {
  groupBy: DataLabGroupBy;
  onGroupByChange: (groupBy: DataLabGroupBy) => void;
  metric: DataLabMetric;
  onMetricChange: (metric: DataLabMetric) => void;
  displayMode: DataLabDisplayMode;
  onDisplayModeChange: (displayMode: DataLabDisplayMode) => void;
};

export const DataLabControlsPanel = ({
  groupBy,
  onGroupByChange,
  metric,
  onMetricChange,
  displayMode,
  onDisplayModeChange
}: Props) => {
  return (
    <section
      className="relative min-w-0 max-w-full rounded-3xl border border-celestial-border bg-celestial-panel/90 p-5 shadow-celestial backdrop-blur-md decorated-card sm:p-6"
      aria-labelledby="data-lab-controls-title"
    >
      <span className="card-corner card-corner-top-left" aria-hidden="true" />
      <span className="card-corner card-corner-top-right" aria-hidden="true" />
      <span className="card-corner card-corner-bottom-left" aria-hidden="true" />
      <span className="card-corner card-corner-bottom-right" aria-hidden="true" />

      <div className="relative z-[1] space-y-4">
        <div className="space-y-1">
          <h2 id="data-lab-controls-title" className="text-sm font-semibold text-celestial-softGold">
            分析条件
          </h2>
          <p className="text-xs text-celestial-textSub">
            集計軸・指標・表示を切り替えると、分析結果が更新されます。
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
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
              {DATA_LAB_METRIC_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

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
      </div>
    </section>
  );
};
