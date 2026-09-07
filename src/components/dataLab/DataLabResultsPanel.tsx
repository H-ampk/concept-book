import type { DataLabAggregateRow, DataLabGroupBy } from "../../utils/dataLab/aggregateDataLabLogs";
import { DATA_LAB_GROUP_BY_CONTROL_LABELS } from "../../utils/dataLab/dataLabGroupByLabels";
import { DataLabTable } from "./DataLabTable";

type Props = {
  totalLogs: number;
  displayedLogs: number;
  groupBy: DataLabGroupBy;
  aggregatedRows: DataLabAggregateRow[];
  onGoToQuizPlay?: () => void;
};

export const DataLabResultsPanel = ({
  totalLogs,
  displayedLogs,
  groupBy,
  aggregatedRows,
  onGoToQuizPlay
}: Props) => {
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
            <p className="text-base font-medium text-celestial-textMain">この条件では集計できるデータがありません。</p>
            <p className="mt-3 text-sm leading-relaxed text-celestial-textSub">
              対象ログは {displayedLogs}件ありますが、現在の集計軸では行を作れません。
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-celestial-textSub" data-testid="data-lab-aggregate-summary">
              集計軸: {DATA_LAB_GROUP_BY_CONTROL_LABELS[groupBy]}　対象ログ: {displayedLogs}件　集計結果:{" "}
              {aggregatedRows.length}件
            </p>
            <DataLabTable rows={aggregatedRows} groupBy={groupBy} />
          </div>
        )}
      </div>
    </section>
  );
};
