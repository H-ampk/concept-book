import type { DataLabAggregateRow, DataLabGroupBy } from "../../utils/dataLab/aggregateDataLabLogs";
import { DATA_LAB_METRIC_LABELS, type DataLabMetric } from "../../utils/dataLab/dataLabChartMetrics";
import type { DataLabDisplayMode } from "../../utils/dataLab/dataLabDisplayMode";
import { DATA_LAB_GROUP_BY_CONTROL_LABELS } from "../../utils/dataLab/dataLabGroupByLabels";
import {
  DATA_LAB_HISTOGRAM_AGGREGATION_DESCRIPTION,
  DATA_LAB_LEARNING_MODEL_CURRENT_METRICS_NOTE,
  describeDataLabMetricAggregation
} from "../../utils/dataLab/describeDataLabMetricAggregation";
import {
  isDataLabBarChartGroupBy,
  toDataLabBarChartRows,
  type DataLabBarChartLimit,
  type DataLabBarChartSort
} from "../../utils/dataLab/toDataLabBarChartRows";
import { isDataLabHistogramGroupBy, toDataLabHistogramBins } from "../../utils/dataLab/toDataLabHistogramBins";
import { isDataLabLineChartGroupBy } from "../../utils/dataLab/toDataLabLineChartPoints";
import { isDataLabScatterGroupBy, toDataLabScatterPoints } from "../../utils/dataLab/toDataLabScatterPoints";
import { DataLabBarChart } from "./DataLabBarChart";
import { DataLabHistogram } from "./DataLabHistogram";
import { DataLabLineChart } from "./DataLabLineChart";
import { DataLabScatterPlot } from "./DataLabScatterPlot";
import { DataLabTable } from "./DataLabTable";

type Props = {
  totalLogs: number;
  displayedLogs: number;
  groupBy: DataLabGroupBy;
  metric: DataLabMetric;
  scatterXMetric?: DataLabMetric;
  scatterYMetric?: DataLabMetric;
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
    className="rounded-xl border border-celestial-border/60 bg-nordic-navy/40 px-4 py-8 text-center"
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
  scatterXMetric = "averageResponseTimeMs",
  scatterYMetric = "accuracy",
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

    if (displayMode === "scatter") {
      if (!isDataLabScatterGroupBy(groupBy)) {
        return (
          <EmptyNotice
            testId="data-lab-scatter-plot-unsupported"
            title="散布図では Concept・分野・Deck 単位の集計を選択してください。"
          />
        );
      }

      const scatterPoints = toDataLabScatterPoints(aggregatedRows, scatterXMetric, scatterYMetric);
      if (scatterPoints.length === 0) {
        return (
          <EmptyNotice
            testId="data-lab-scatter-plot-empty"
            title="選択した指標では散布図に表示できるデータがありません。"
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
          <DataLabScatterPlot points={scatterPoints} xMetric={scatterXMetric} yMetric={scatterYMetric} />
        </div>
      );
    }

    if (displayMode === "histogram") {
      if (!isDataLabHistogramGroupBy(groupBy)) {
        return (
          <EmptyNotice
            testId="data-lab-histogram-unsupported"
            title="ヒストグラムでは Concept・分野・Deck 単位の集計を選択してください。"
          />
        );
      }

      const histogramBins = toDataLabHistogramBins(aggregatedRows, metric);
      if (histogramBins.length === 0) {
        return (
          <EmptyNotice
            testId="data-lab-histogram-empty"
            title="選択した指標ではヒストグラムに表示できるデータがありません。"
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
          <DataLabHistogram bins={histogramBins} metric={metric} groupBy={groupBy} />
        </div>
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
        : displayMode === "scatter"
          ? "この条件では散布図に表示できるデータがありません。"
          : displayMode === "histogram"
            ? "この条件ではヒストグラムに表示できるデータがありません。"
            : "この条件では集計できるデータがありません。";

  return (
    <section
      className="relative min-h-[16rem] min-w-0 max-w-full overflow-hidden rounded-3xl border border-celestial-border bg-celestial-panel/90 p-4 shadow-celestial backdrop-blur-md decorated-card sm:p-5"
      aria-labelledby="data-lab-results-title"
    >
      <div className="relative z-[1] space-y-3">
        <h2 id="data-lab-results-title" className="text-sm font-semibold text-celestial-softGold">
          分析結果
        </h2>

        {totalLogs === 0 ? (
          <div className="rounded-xl border border-celestial-border/60 bg-nordic-navy/40 px-4 py-8 text-center">
            <p className="text-base font-medium text-celestial-textMain">まだ分析できる学習データがありません。</p>
            <p className="mt-3 text-sm leading-relaxed text-celestial-textSub">
              クイズに回答すると、ここで学習履歴を分析できるようになります。
            </p>
            {onGoToQuizPlay ? (
              <button
                type="button"
                onClick={onGoToQuizPlay}
                className="mt-4 header-nav-button rounded-md border border-celestial-gold/50 bg-celestial-gold/10 px-4 py-2.5 text-sm font-medium text-celestial-softGold hover:bg-celestial-gold/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-celestial-gold/55"
              >
                クイズで学習へ
              </button>
            ) : null}
          </div>
        ) : displayedLogs === 0 ? (
          <div className="rounded-xl border border-celestial-border/60 bg-nordic-navy/40 px-4 py-8 text-center">
            <p className="text-base font-medium text-celestial-textMain">条件に一致する学習データがありません。</p>
            <p className="mt-3 text-sm leading-relaxed text-celestial-textSub">フィルタ条件を変更してください。</p>
          </div>
        ) : aggregatedRows.length === 0 ? (
          <div className="rounded-xl border border-celestial-border/60 bg-nordic-navy/40 px-4 py-8 text-center">
            <p className="text-base font-medium text-celestial-textMain">{emptyAggregatedTitle}</p>
            <p className="mt-3 text-sm leading-relaxed text-celestial-textSub">
              対象ログは {displayedLogs}件ありますが、現在の集計軸では行を作れません。
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-celestial-textSub" data-testid="data-lab-aggregate-summary">
              {displayMode === "scatter"
                ? `集計軸: ${DATA_LAB_GROUP_BY_CONTROL_LABELS[groupBy]}　X軸: ${DATA_LAB_METRIC_LABELS[scatterXMetric]}　Y軸: ${DATA_LAB_METRIC_LABELS[scatterYMetric]}　対象ログ: ${displayedLogs}件　集計結果: ${aggregatedRows.length}件`
                : `集計軸: ${DATA_LAB_GROUP_BY_CONTROL_LABELS[groupBy]}　指標: ${DATA_LAB_METRIC_LABELS[metric]}　対象ログ: ${displayedLogs}件　集計結果: ${aggregatedRows.length}件`}
            </p>
            {groupBy === "concept" ? (
              <p className="text-xs leading-relaxed text-celestial-textSub" data-testid="data-lab-mastery-note">
                {DATA_LAB_LEARNING_MODEL_CURRENT_METRICS_NOTE}
              </p>
            ) : null}
            <div className="space-y-1" data-testid="data-lab-metric-aggregation-note">
              {displayMode === "scatter" ? (
                <>
                  <p className="text-xs leading-relaxed text-celestial-textSub">
                    {DATA_LAB_METRIC_LABELS[scatterXMetric]}: {describeDataLabMetricAggregation(scatterXMetric)}
                  </p>
                  <p className="text-xs leading-relaxed text-celestial-textSub">
                    {DATA_LAB_METRIC_LABELS[scatterYMetric]}: {describeDataLabMetricAggregation(scatterYMetric)}
                  </p>
                </>
              ) : (
                <p className="text-xs leading-relaxed text-celestial-textSub">
                  {DATA_LAB_METRIC_LABELS[metric]}: {describeDataLabMetricAggregation(metric)}
                </p>
              )}
              {displayMode === "histogram" ? (
                <p className="text-xs leading-relaxed text-celestial-textSub" data-testid="data-lab-histogram-method-note">
                  {DATA_LAB_HISTOGRAM_AGGREGATION_DESCRIPTION}
                </p>
              ) : null}
            </div>
            {renderVisualization()}
          </div>
        )}
      </div>
    </section>
  );
};
