import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { getStorage } from "../../storage";
import type { DataLabAnalysisSnapshot, ResearchReport } from "../../types/researchReport";
import { buildDataLabAnalysisSnapshot } from "../../utils/dataLab/buildDataLabAnalysisSnapshot";
import type { DataLabAggregateRow, DataLabGroupBy } from "../../utils/dataLab/aggregateDataLabLogs";
import type { DataLabMetric } from "../../utils/dataLab/dataLabChartMetrics";
import type { DataLabDisplayMode } from "../../utils/dataLab/dataLabDisplayMode";
import type { DataLabFilterChip } from "../../utils/dataLab/describeDataLabFilters";
import type { DataLabFilters } from "../../utils/dataLab/filterDataLabLogs";
import type { DataLabBarChartLimit, DataLabBarChartSort } from "../../utils/dataLab/toDataLabBarChartRows";
import {
  appendDataLabAnalysisBlock,
  createResearchReportFromSnapshot
} from "../../utils/researchReport/researchReportBlocks";

const storage = getStorage();

type Props = {
  filters: DataLabFilters;
  filterChips: DataLabFilterChip[];
  groupBy: DataLabGroupBy;
  metric: DataLabMetric;
  scatterXMetric: DataLabMetric;
  scatterYMetric: DataLabMetric;
  displayMode: DataLabDisplayMode;
  barSort: DataLabBarChartSort;
  barLimit: DataLabBarChartLimit;
  filteredLogCount: number;
  aggregatedRows: DataLabAggregateRow[];
};

type Destination = "new" | "existing";

const inputClass =
  "w-full rounded-md border border-celestial-border/60 bg-nordic-navy/50 px-3 py-2 text-sm text-celestial-textMain focus:outline-none focus-visible:ring-2 focus-visible:ring-celestial-gold/55";

export const DataLabAddToResearchReportPanel = ({
  filters,
  filterChips,
  groupBy,
  metric,
  scatterXMetric,
  scatterYMetric,
  displayMode,
  barSort,
  barLimit,
  filteredLogCount,
  aggregatedRows
}: Props) => {
  const [open, setOpen] = useState(false);
  const [destination, setDestination] = useState<Destination>("new");
  const [existingId, setExistingId] = useState("");
  const [reports, setReports] = useState<ResearchReport[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSave = aggregatedRows.length > 0 && filteredLogCount > 0;

  const snapshot = useMemo(
    () =>
      canSave
        ? buildDataLabAnalysisSnapshot({
            filters,
            filterChips,
            groupBy,
            metric,
            scatterXMetric,
            scatterYMetric,
            displayMode,
            barSort,
            barLimit,
            filteredLogCount,
            aggregatedRows
          })
        : null,
    [
      aggregatedRows,
      barLimit,
      barSort,
      canSave,
      displayMode,
      filterChips,
      filteredLogCount,
      filters,
      groupBy,
      metric,
      scatterXMetric,
      scatterYMetric
    ]
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;
    void storage.getResearchReports().then((list) => {
      if (cancelled) {
        return;
      }
      setReports(list);
      setExistingId((current) => current || list[0]?.id || "");
      if (list.length === 0) {
        setDestination("new");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const handleSave = async (currentSnapshot: DataLabAnalysisSnapshot) => {
    setSaving(true);
    setError(null);
    try {
      if (destination === "new") {
        const report = createResearchReportFromSnapshot(currentSnapshot);
        await storage.saveResearchReport(report);
        setMessage(`研究レポート「${report.title}」を作成しました。`);
      } else {
        const target = reports.find((report) => report.id === existingId) ?? (await storage.getResearchReport(existingId));
        if (!target) {
          setError("追加先の研究レポートが見つかりません。");
          return;
        }
        const next = appendDataLabAnalysisBlock(target, currentSnapshot);
        await storage.saveResearchReport(next);
        setMessage(`研究レポート「${next.title}」へ分析を追加しました。`);
      }
      setOpen(false);
    } catch {
      setError("研究レポートへの保存に失敗しました。");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      className="relative min-w-0 max-w-full rounded-3xl border border-celestial-border bg-celestial-panel/90 p-4 shadow-celestial backdrop-blur-md decorated-card sm:p-5"
      aria-labelledby="data-lab-research-report-title"
    >
      <div className="relative z-[1] space-y-3">
        <div className="space-y-1">
          <h2 id="data-lab-research-report-title" className="text-sm font-semibold text-celestial-softGold">
            研究レポート
          </h2>
          <p className="text-xs text-celestial-textSub">
            現在の分析条件と集計結果を、分析時点の Snapshot として研究レポートへ保存します。Data Lab
            の表示状態は変わりません。
          </p>
        </div>

        {!canSave ? (
          <p className="text-sm text-celestial-textSub" data-testid="data-lab-research-report-empty">
            保存できる集計結果がありません。
          </p>
        ) : null}

        {message ? (
          <p className="text-sm text-celestial-softGold" data-testid="data-lab-research-report-saved">
            {message}
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => {
            setError(null);
            setOpen(true);
          }}
          disabled={!canSave}
          className="rounded-md border border-celestial-gold/50 bg-transparent px-3 py-2 text-sm text-celestial-softGold hover:bg-celestial-gold/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-celestial-gold/55 disabled:cursor-not-allowed disabled:opacity-40"
        >
          研究レポートに追加
        </button>
      </div>

      {typeof document !== "undefined" && open && snapshot
        ? createPortal(
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-nordic-overlay px-3 py-6 sm:px-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="data-lab-add-report-title"
            >
              <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto scrollbar-none rounded-2xl border border-celestial-border bg-celestial-panel p-4 shadow-xl sm:p-5">
                <header className="mb-3 flex items-start justify-between gap-2">
                  <div>
                    <h3 id="data-lab-add-report-title" className="text-lg font-semibold text-celestial-textMain">
                      研究レポートに追加
                    </h3>
                    <p className="mt-1 text-xs text-celestial-textSub">
                      新しいレポートを作るか、既存レポートの末尾へ今回の分析を追加します。
                    </p>
                  </div>
                  <button
                    type="button"
                    className="rounded-md px-2 py-1 text-sm text-celestial-softGold hover:bg-celestial-gold/10"
                    onClick={() => setOpen(false)}
                  >
                    閉じる
                  </button>
                </header>

                <fieldset className="space-y-3">
                  <legend className="sr-only">追加先</legend>
                  <label className="flex items-center gap-2 text-sm text-celestial-textMain">
                    <input
                      type="radio"
                      name="research-report-destination"
                      value="new"
                      checked={destination === "new"}
                      onChange={() => setDestination("new")}
                    />
                    新しい研究レポート
                  </label>
                  <label className="flex items-center gap-2 text-sm text-celestial-textMain">
                    <input
                      type="radio"
                      name="research-report-destination"
                      value="existing"
                      checked={destination === "existing"}
                      disabled={reports.length === 0}
                      onChange={() => setDestination("existing")}
                    />
                    既存の研究レポート
                  </label>
                </fieldset>

                {destination === "existing" ? (
                  reports.length === 0 ? (
                    <p className="mt-3 text-sm text-celestial-textSub">保存済みの研究レポートはまだありません。</p>
                  ) : (
                    <label className="mt-3 block min-w-0 space-y-1.5">
                      <span className="text-xs font-medium text-celestial-textSub">追加先レポート</span>
                      <select
                        className={inputClass}
                        aria-label="追加先の研究レポート"
                        value={existingId}
                        onChange={(event) => setExistingId(event.target.value)}
                      >
                        {reports.map((report) => (
                          <option key={report.id} value={report.id}>
                            {report.title}
                          </option>
                        ))}
                      </select>
                    </label>
                  )
                ) : null}

                {error ? (
                  <p className="mt-3 text-sm text-celestial-textSub" role="alert">
                    {error}
                  </p>
                ) : null}

                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    className="rounded-md border border-celestial-border/60 px-3 py-2 text-sm text-celestial-textMain hover:border-celestial-gold/50"
                    onClick={() => setOpen(false)}
                  >
                    キャンセル
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-celestial-gold/50 bg-celestial-gold/10 px-3 py-2 text-sm text-celestial-softGold hover:bg-celestial-gold/20 disabled:opacity-40"
                    disabled={saving || (destination === "existing" && !existingId)}
                    onClick={() => void handleSave(snapshot)}
                  >
                    {saving ? "保存中…" : "保存"}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </section>
  );
};
