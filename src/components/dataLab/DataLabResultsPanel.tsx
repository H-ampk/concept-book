import type { DataLabAggregateRow, DataLabGroupBy } from "../../utils/dataLab/aggregateDataLabLogs";
import { DATA_LAB_METRIC_LABELS, type DataLabMetric } from "../../utils/dataLab/dataLabChartMetrics";
import type { DataLabDisplayMode } from "../../utils/dataLab/dataLabDisplayMode";
import { DATA_LAB_GROUP_BY_CONTROL_LABELS } from "../../utils/dataLab/dataLabGroupByLabels";
import {
  isDataLabBarChartGroupBy,
  toDataLabBarChartRows,
  type DataLabBarChartLimit,
  type DataLabBarChartSort
} from "../../utils/dataLab/toDataLabBarChartRows";
import { isDataLabLineChartGroupBy } from "../../utils/dataLab/toDataLabLineChartPoints";
import { DataLabBarChart } from "./DataLabBarChart";
import { DataLabLineChart } from "./DataLabLineChart";
import { DataLabTable } from "./DataLabTable";

type Props = {
  totalLogs: number;
  displayedLogs: number;
  groupBy: DataLabGroupBy;
  metric: DataLabMetric;
  displayMode: DataLabDisplayMode;
  barSort?: DataLabBarChartSort;
  barLimit?: DataLabBarChartLimit;
  aggregatedRows: DataLabAggregateRow[];
  onGoToQuizPlay?: () => void;
};

const EmptyNotice = ({
  title,
  description,
  testId
}: {
  title: string;
  description?: string;
  testId?: string;
}) => (
  <div
    className="rounded-xl border border-celestial-border/60 bg-nordic-navy/40 px-5 py-10 text-center"
    data-testid={testId}
  >
    <p className="text-base font-medium text-celestial-textMain">{title}</p>
    {description ? <p className="mt-3 text-sm leading-relaxed text-celestial-textSub">{description}</p> : null}
  </div>
);

export const DataLabResultsPanel = ({
  totalLogs,
  displayedLogs,
  groupBy,
  metric,
  displayMode,
  barSort = "valueDesc",
  barLimit = 10,
  aggregatedRows,
  onGoToQuizPlay
}: Props) => {
  const renderVisualization = () => {
    if (displayMode === "table") {
      return <DataLabTable rows={aggregatedRows} groupBy={groupBy} />;
    }

    if (displayMode === "line") {
      if (isDataLabLineChartGroupBy(groupBy)) {
        return <DataLabLineChart rows={aggregatedRows} groupBy={groupBy} metric={metric} />;
      }
      return (
        <EmptyNotice
          testId="data-lab-line-chart-unsupported"
          title="折れ線グラフでは日・週・月単位の集計を選択してください。"
        />
      );
    }

    if (!isDataLabBarChartGroupBy(groupBy)) {
      return (
        <EmptyNotice
          testId="data-lab-bar-chart-unsupported"
          title="棒グラフでは Concept・分野・Deck 単位の集計を選択してください。"
        />
      );
    }

    const barRows = toDataLabBarChartRows(aggregatedRows, metric, barSort, barLimit);
    if (barRows.length === 0) {
      return (
        <EmptyNotice
          testId="data-lab-bar-chart-empty"
          title="この条件では棒グラフに表示できるデータがありません。"
        />
      );
    }

    return (
      <div className="space-y-3">
        {groupBy === "domain" ? (
          <p className="text-xs leading-relaxed text-celestial-textSub">
            ※ 複数分野を持つ Concept は各分野に重複して集計されます。
          </p>
        ) : null}
        <DataLabBarChart rows={barRows} metric={metric} />
      </div>
    );
  };

  const emptyAggregatedTitle =
    displayMode === "bar"
      ? "この条件では棒グラフに表示できるデータがありません。"
      : displayMode === "line"
        ? "この条件ではグラフに表示できるデータがありません。"
        : "この条件では集計できるデータがありません。";

  return (
    <section
      className="relative min-h-[16rem] min-w-0 max-w-full overflow-hidden rounded-3xl border border-celestial-border bg-celestial-panel/90 p-5 shadow-celestial backdrop-blur-md decorated-card sm:p-8"
      aria-labelledby="data-lab-results-title"
    >
      <span className="card-corner card-corner-top-left" aria-hidden="true" />
      <span className="card-corner card-corner-top-right" aria-hidden="true" />
      <span className="card-corner card-corner-bottom-left" aria-hidden="true" />
      <span className="card-corner card-corner-bottom-right" aria-hidden="true" />

      <div className="relative z-[1] space-y-4">
        <h2 id="data-lab-results-title" className="text-sm font-semibold text-celestial-softGold">
          分析結果
        </h2>

        {totalLogs === 0 ? (
          <div className="rounded-xl border border-celestial-border/60 bg-nordic-navy/40 px-5 py-10 text-center">
            <p className="text-base font-medium text-celestial-textMain">まだ分析できる学習データがありません。</p>
            <p className="mt-3 text-sm leading-relaxed text-celestial-textSub">
              クイズに回答すると、ここで学習履歴を分析できるようになります。
            </p>
            {onGoToQuizPlay ? (
              <button
                type="button"
                onClick={onGoToQuizPlay}
                className="mt-6 header-nav-button rounded-md border border-celestial-gold/50 bg-celestial-gold/10 px-4 py-2.5 text-sm font-medium text-celestial-softGold hover:bg-celestial-gold/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-celestial-gold/55"
              >
                クイズで学習へ
              </button>
            ) : null}
          </div>
        ) : displayedLogs === 0 ? (
          <div className="rounded-xl border border-celestial-border/60 bg-nordic-navy/40 px-5 py-10 text-center">
            <p className="text-base font-medium text-celestial-textMain">条件に一致する学習データがありません。</p>
            <p className="mt-3 text-sm leading-relaxed text-celestial-textSub">フィルタ条件を変更してください。</p>
          </div>
        ) : aggregatedRows.length === 0 ? (
          <div className="rounded-xl border border-celestial-border/60 bg-nordic-navy/40 px-5 py-10 text-center">
            <p className="text-base font-medium text-celestial-textMain">{emptyAggregatedTitle}</p>
            <p className="mt-3 text-sm leading-relaxed text-celestial-textSub">
              対象ログは {displayedLogs}件ありますが、現在の集計軸では行を作れません。
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-celestial-textSub" data-testid="data-lab-aggregate-summary">
              集計軸: {DATA_LAB_GROUP_BY_CONTROL_LABELS[groupBy]}　指標: {DATA_LAB_METRIC_LABELS[metric]}　対象ログ:{" "}
              {displayedLogs}件　集計結果: {aggregatedRows.length}件
            </p>
            {renderVisualization()}
          </div>
        )}
      </div>
    </section>
  );
};
