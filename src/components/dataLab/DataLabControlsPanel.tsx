import type { DataLabGroupBy } from "../../utils/dataLab/aggregateDataLabLogs";
import { DATA_LAB_GROUP_BY_OPTIONS } from "../../utils/dataLab/dataLabGroupByLabels";

const inputClass =
  "w-full rounded-md border border-celestial-border/60 bg-nordic-navy/50 px-3 py-2 text-sm text-celestial-textMain focus:outline-none focus-visible:ring-2 focus-visible:ring-celestial-gold/55";

type Props = {
  groupBy: DataLabGroupBy;
  onGroupByChange: (groupBy: DataLabGroupBy) => void;
};

export const DataLabControlsPanel = ({ groupBy, onGroupByChange }: Props) => {
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
          <p className="text-xs text-celestial-textSub">集計軸を切り替えると、分析結果のテーブルが更新されます。</p>
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
            <button
              id="data-lab-control-metric"
              type="button"
              disabled
              className="w-full cursor-not-allowed rounded-md border border-celestial-border/60 bg-nordic-navy/40 px-3 py-2 text-left text-sm text-celestial-textSub opacity-70"
            >
              基本指標
            </button>
          </div>

          <div className="min-w-0">
            <label htmlFor="data-lab-control-display" className="mb-1.5 block text-xs font-medium text-celestial-textSub">
              表示
            </label>
            <button
              id="data-lab-control-display"
              type="button"
              disabled
              className="w-full cursor-not-allowed rounded-md border border-celestial-border/60 bg-nordic-navy/40 px-3 py-2 text-left text-sm text-celestial-textSub opacity-70"
            >
              テーブル
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
