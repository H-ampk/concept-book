import { useEffect, useMemo, useState } from "react";
import type { ResearchReport } from "../../types/researchReport";
import { ResearchDataLabAnalysisBlockView } from "./ResearchDataLabAnalysisBlockView";

type Props = {
  reports: ResearchReport[];
  onTitleChange: (reportId: string, title: string) => void;
  onCommentaryChange: (reportId: string, blockId: string, commentary: string) => void;
  onDeleteBlock: (reportId: string, blockId: string) => void;
};

export const SavedResearchReportsPanel = ({
  reports,
  onTitleChange,
  onCommentaryChange,
  onDeleteBlock
}: Props) => {
  const [selectedId, setSelectedId] = useState(reports[0]?.id ?? "");
  const selected = useMemo(
    () => reports.find((report) => report.id === selectedId) ?? reports[0] ?? null,
    [reports, selectedId]
  );
  const [titleDraft, setTitleDraft] = useState(selected?.title ?? "");

  useEffect(() => {
    setTitleDraft(selected?.title ?? "");
  }, [selected?.id]);

  const selectReport = (id: string) => {
    setSelectedId(id);
    const next = reports.find((report) => report.id === id);
    setTitleDraft(next?.title ?? "");
  };

  return (
    <section className="space-y-3" aria-labelledby="saved-research-reports-heading">
      <div>
        <h2 id="saved-research-reports-heading" className="text-sm font-semibold text-celestial-softGold">
          保存済み研究レポート
        </h2>
        <p className="mt-1 text-xs text-celestial-textSub">
          Data Lab から保存した分析 Snapshot と考察です。数値は保存時点のまま表示します。
        </p>
      </div>

      {reports.length === 0 ? (
        <p className="text-sm text-celestial-textSub" data-testid="saved-research-reports-empty">
          保存済みの研究レポートはまだありません。Data Lab の「研究レポートに追加」から作成できます。
        </p>
      ) : (
        <>
          <label className="block min-w-0 space-y-1.5">
            <span className="text-xs font-medium text-celestial-textSub">レポート一覧</span>
            <select
              className="w-full rounded-md border border-celestial-border/60 bg-nordic-navy/50 px-3 py-2 text-sm text-celestial-textMain focus:outline-none focus-visible:ring-2 focus-visible:ring-celestial-gold/55"
              aria-label="保存済み研究レポートの選択"
              value={selected?.id ?? ""}
              onChange={(event) => selectReport(event.target.value)}
            >
              {reports.map((report) => (
                <option key={report.id} value={report.id}>
                  {report.title}
                </option>
              ))}
            </select>
          </label>

          {selected ? (
            <div className="space-y-3" data-testid="saved-research-report-detail">
              <label className="block min-w-0 space-y-1.5">
                <span className="text-xs font-medium text-celestial-textSub">タイトル</span>
                <input
                  className="w-full rounded-md border border-celestial-border/60 bg-nordic-navy/50 px-3 py-2 text-sm text-celestial-textMain focus:outline-none focus-visible:ring-2 focus-visible:ring-celestial-gold/55"
                  aria-label="研究レポートのタイトル"
                  value={titleDraft}
                  onChange={(event) => setTitleDraft(event.target.value)}
                  onBlur={() => {
                    if (titleDraft.trim() && titleDraft !== selected.title) {
                      onTitleChange(selected.id, titleDraft.trim());
                    }
                  }}
                />
              </label>

              {selected.blocks.length === 0 ? (
                <p className="text-sm text-celestial-textSub">このレポートには分析ブロックがありません。</p>
              ) : (
                selected.blocks.map((block) => (
                  <ResearchDataLabAnalysisBlockView
                    key={block.id}
                    block={block}
                    onCommentaryChange={(blockId, commentary) =>
                      onCommentaryChange(selected.id, blockId, commentary)
                    }
                    onDelete={(blockId) => onDeleteBlock(selected.id, blockId)}
                  />
                ))
              )}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
};
