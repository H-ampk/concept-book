import { useState } from "react";
import type { ResearchDataLabAnalysisBlock } from "../../types/researchReport";
import { formatResearchAnalysisSnapshotView } from "../../utils/researchReport/formatResearchAnalysisSnapshot";
import { ResearchAnalysisSnapshotTable } from "./ResearchAnalysisSnapshotTable";

type Props = {
  block: ResearchDataLabAnalysisBlock;
  onCommentaryChange: (blockId: string, commentary: string) => void;
  onDelete: (blockId: string) => void;
};

export const ResearchDataLabAnalysisBlockView = ({ block, onCommentaryChange, onDelete }: Props) => {
  const [draft, setDraft] = useState(block.commentary);
  const view = formatResearchAnalysisSnapshotView(block.snapshot);

  return (
    <article
      className="space-y-3 rounded-xl border border-celestial-border/70 bg-nordic-navy/35 p-4"
      data-testid="research-analysis-block"
    >
      <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-celestial-softGold">Data Lab Analysis</h3>
          <p className="mt-1 text-xs text-celestial-textSub">分析日時: {view.createdAtLabel}</p>
        </div>
        <button
          type="button"
          className="header-nav-button shrink-0 rounded-md border border-celestial-border/60 bg-transparent px-3 py-1.5 text-xs text-celestial-textMain hover:border-celestial-gold/50 hover:text-celestial-softGold"
          onClick={() => {
            if (window.confirm("この分析ブロックを削除しますか？学習ログや Concept は削除されません。")) {
              onDelete(block.id);
            }
          }}
        >
          分析ブロックを削除
        </button>
      </header>

      <dl className="grid gap-2 text-sm text-celestial-textMain sm:grid-cols-2">
        <div>
          <dt className="text-xs text-celestial-textSub">フィルタ条件</dt>
          <dd className="mt-1">
            {view.filterLabels.length === 0 ? "指定なし" : view.filterLabels.join(" / ")}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-celestial-textSub">集計軸</dt>
          <dd className="mt-1">{view.groupByLabel}</dd>
        </div>
        <div>
          <dt className="text-xs text-celestial-textSub">指標</dt>
          <dd className="mt-1">{view.metricLabel}</dd>
        </div>
        <div>
          <dt className="text-xs text-celestial-textSub">表示形式</dt>
          <dd className="mt-1">{view.displayModeLabel}</dd>
        </div>
        {view.scatterXLabel ? (
          <div>
            <dt className="text-xs text-celestial-textSub">X 指標</dt>
            <dd className="mt-1">{view.scatterXLabel}</dd>
          </div>
        ) : null}
        {view.scatterYLabel ? (
          <div>
            <dt className="text-xs text-celestial-textSub">Y 指標</dt>
            <dd className="mt-1">{view.scatterYLabel}</dd>
          </div>
        ) : null}
        {view.barSortLabel ? (
          <div>
            <dt className="text-xs text-celestial-textSub">棒グラフの並び</dt>
            <dd className="mt-1">{view.barSortLabel}</dd>
          </div>
        ) : null}
        {view.barLimitLabel ? (
          <div>
            <dt className="text-xs text-celestial-textSub">棒グラフの件数</dt>
            <dd className="mt-1">{view.barLimitLabel}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-xs text-celestial-textSub">対象ログ件数</dt>
          <dd className="mt-1 tabular-nums">{view.sourceLogCount} 件</dd>
        </div>
      </dl>

      {view.truncationLabel ? (
        <p className="text-xs text-celestial-textSub" data-testid="research-analysis-truncated">
          {view.truncationLabel}
        </p>
      ) : null}

      <ResearchAnalysisSnapshotTable rows={block.snapshot.rows} groupBy={block.snapshot.groupBy} />

      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-celestial-textSub">考察</span>
        <textarea
          className="min-h-28 w-full rounded-md border border-celestial-border/60 bg-nordic-navy/50 px-3 py-2 text-sm text-celestial-textMain focus:outline-none focus-visible:ring-2 focus-visible:ring-celestial-gold/55"
          aria-label="考察"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => {
            if (draft !== block.commentary) {
              onCommentaryChange(block.id, draft);
            }
          }}
        />
      </label>
    </article>
  );
};
