type Props = {
  totalLogs: number;
  displayedLogs: number;
  onGoToQuizPlay?: () => void;
};

export const DataLabResultsPanel = ({ totalLogs, displayedLogs, onGoToQuizPlay }: Props) => {
  return (
    <section
      className="relative min-h-[16rem] rounded-3xl border border-celestial-border bg-celestial-panel/90 p-5 shadow-celestial backdrop-blur-md decorated-card sm:p-8"
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
        ) : (
          <div className="space-y-3 text-sm leading-relaxed text-celestial-textSub">
            <p className="text-base text-celestial-textMain">
              条件に一致する学習ログは {displayedLogs}件です。（全{totalLogs}件中）
            </p>
            <p>集計・可視化機能はここに表示されます。</p>
          </div>
        )}
      </div>
    </section>
  );
};
