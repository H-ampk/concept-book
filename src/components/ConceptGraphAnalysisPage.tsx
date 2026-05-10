import { useCallback, useEffect, useMemo, useState } from "react";
import { getStorage } from "../storage";
import type { Concept } from "../types/concept";
import type { QuizAttemptLog } from "../types/quiz";
import { shortDateTime } from "../utils/date";
import { filterLogsByAnsweredDateRange } from "../utils/quizAttemptDateFilter";
import {
  buildNetworkPartnersByConcept,
  computeConceptConfusionNodeStats,
  computeConceptGraphSummary,
  computeConfusionEdges,
  formatConceptGraphNodeLabel,
  type NetworkCardPartner
} from "../utils/quizConceptGraphStats";
import { OrnamentLine } from "./common/OrnamentLine";

const storage = getStorage();

type Props = {
  onBack: () => void;
};

const partnerDirectionLabel = (p: NetworkCardPartner): string =>
  p.direction === "selected_was_wrong_for"
    ? `この Concept を誤って選んだときの正解`
    : `この Concept が正解だったときに誤って選ばれた Concept`;

export const ConceptGraphAnalysisPage = ({ onBack }: Props) => {
  const [logs, setLogs] = useState<QuizAttemptLog[]>([]);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [allLogs, allConcepts] = await Promise.all([
        storage.getQuizAttemptLogs(),
        storage.getAllConcepts()
      ]);
      setLogs(allLogs);
      setConcepts(allConcepts);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const titleById = useMemo(() => {
    const m = new Map<string, string>();
    concepts.forEach((c) => m.set(c.id, c.title || "無題"));
    return m;
  }, [concepts]);

  const logsInPeriod = useMemo(
    () => filterLogsByAnsweredDateRange(logs, dateStart, dateEnd),
    [logs, dateStart, dateEnd]
  );

  const confusionEdges = useMemo(() => computeConfusionEdges(logsInPeriod), [logsInPeriod]);

  const nodeStats = useMemo(
    () => computeConceptConfusionNodeStats(logsInPeriod, confusionEdges),
    [logsInPeriod, confusionEdges]
  );

  const summary = useMemo(
    () => computeConceptGraphSummary(logsInPeriod, confusionEdges, nodeStats),
    [logsInPeriod, confusionEdges, nodeStats]
  );

  const partnersByConcept = useMemo(
    () => buildNetworkPartnersByConcept(confusionEdges),
    [confusionEdges]
  );

  const hasLinkedWrongAnswer = useMemo(
    () =>
      logsInPeriod.some(
        (l) =>
          !l.correct &&
          Boolean(l.selectedLinkedConceptId?.trim()) &&
          Boolean(l.correctLinkedConceptId?.trim())
      ),
    [logsInPeriod]
  );

  const resetDateRange = () => {
    setDateStart("");
    setDateEnd("");
  };

  const hasDateFilter = dateStart.trim() !== "" || dateEnd.trim() !== "";

  const topMisleadingLabel =
    summary.topMisleadingConceptKey != null
      ? formatConceptGraphNodeLabel(summary.topMisleadingConceptKey, titleById)
      : "—";

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-1 sm:px-0">
      <section
        className="relative rounded-3xl border border-celestial-border bg-celestial-panel/90 p-5 shadow-celestial backdrop-blur-md decorated-card sm:p-6"
        aria-labelledby="concept-graph-analysis-title"
      >
        <span className="card-corner card-corner-top-left" aria-hidden="true" />
        <span className="card-corner card-corner-top-right" aria-hidden="true" />
        <span className="card-corner card-corner-bottom-left" aria-hidden="true" />
        <span className="card-corner card-corner-bottom-right" aria-hidden="true" />

        <div className="relative z-[1] space-y-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-celestial-gold/80">Lab · 観測室</p>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0 space-y-2">
              <h1 id="concept-graph-analysis-title" className="text-2xl font-semibold tracking-wide text-celestial-textMain md:text-3xl">
                概念グラフ分析
              </h1>
              <p className="max-w-2xl text-sm leading-relaxed text-celestial-textSub md:text-base">
                クイズの誤答ログから、Concept 同士の混同関係を観察する画面です。選択肢に Concept
                がリンクされている場合、誤答時に「どれをどれと取り違えたか」を集計します。データはこの端末に保存されたログのみです。
              </p>
              <OrnamentLine variant="header" className="max-w-md opacity-80" />
            </div>
            <button
              type="button"
              onClick={onBack}
              className="header-nav-button shrink-0 rounded-md border border-celestial-gold/50 bg-transparent px-3 py-2 text-sm text-celestial-softGold hover:bg-celestial-gold/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-celestial-gold/55"
            >
              戻る（概念へ）
            </button>
          </div>
        </div>
      </section>

      {loading ? (
        <p className="text-center text-sm text-celestial-textSub" role="status">
          読み込み中…
        </p>
      ) : logs.length === 0 ? (
        <section
          className="rounded-3xl border border-celestial-border/70 bg-nordic-navy/35 px-6 py-10 text-center backdrop-blur-sm"
          aria-labelledby="concept-graph-analysis-empty-title"
        >
          <h2 id="concept-graph-analysis-empty-title" className="text-lg font-semibold text-celestial-softGold">
            まだ回答ログがありません
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-celestial-textSub">
            クイズで学習すると、ここに混同関係の分析が表示されます。
          </p>
        </section>
      ) : (
        <>
          <section aria-labelledby="concept-graph-date-heading" className="space-y-3">
            <h2 id="concept-graph-date-heading" className="text-sm font-semibold text-celestial-softGold">
              回答日時（answeredAt）で期間を絞り込む
            </h2>
            <p className="text-xs text-celestial-textSub">
              未指定の項目は条件に含めません。日付は端末のローカル日の始端・終端で比較します。
            </p>
            <div className="flex flex-col gap-4 rounded-xl border border-celestial-border/70 bg-nordic-navy/35 p-4 backdrop-blur-sm sm:flex-row sm:flex-wrap sm:items-end">
              <div>
                <label htmlFor="concept-graph-date-start" className="mb-1.5 block text-xs font-medium text-celestial-textSub">
                  開始日
                </label>
                <input
                  id="concept-graph-date-start"
                  type="date"
                  value={dateStart}
                  onChange={(e) => setDateStart(e.target.value)}
                  className="rounded-md border border-celestial-border/60 bg-nordic-navy/50 px-3 py-2 text-sm text-celestial-textMain focus:outline-none focus-visible:ring-2 focus-visible:ring-celestial-gold/55"
                />
              </div>
              <div>
                <label htmlFor="concept-graph-date-end" className="mb-1.5 block text-xs font-medium text-celestial-textSub">
                  終了日
                </label>
                <input
                  id="concept-graph-date-end"
                  type="date"
                  value={dateEnd}
                  onChange={(e) => setDateEnd(e.target.value)}
                  className="rounded-md border border-celestial-border/60 bg-nordic-navy/50 px-3 py-2 text-sm text-celestial-textMain focus:outline-none focus-visible:ring-2 focus-visible:ring-celestial-gold/55"
                />
              </div>
              <button
                type="button"
                onClick={resetDateRange}
                className="header-nav-button rounded-md border border-celestial-border/60 bg-transparent px-3 py-2 text-sm text-celestial-textMain hover:border-celestial-gold/50 hover:text-celestial-softGold focus:outline-none focus-visible:ring-2 focus-visible:ring-celestial-gold/55"
              >
                期間リセット
              </button>
            </div>
            {hasDateFilter ? (
              <p className="text-xs text-celestial-textSub">
                全 {logs.length} 件中、期間条件に一致するログは {logsInPeriod.length} 件です。
              </p>
            ) : null}
          </section>

          {logsInPeriod.length === 0 ? (
            <section
              className="rounded-xl border border-celestial-border/60 bg-nordic-navy/35 px-5 py-8 text-center backdrop-blur-sm"
              aria-labelledby="concept-graph-period-empty-title"
            >
              <h2 id="concept-graph-period-empty-title" className="text-base font-semibold text-celestial-softGold">
                選択した期間に回答ログがありません
              </h2>
              <p className="mt-2 text-sm text-celestial-textSub">
                期間をリセットするか、別の開始日・終了日を指定してください。
              </p>
              <button
                type="button"
                onClick={resetDateRange}
                className="mt-5 header-nav-button rounded-md border border-celestial-gold/50 bg-transparent px-4 py-2 text-sm text-celestial-softGold hover:bg-celestial-gold/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-celestial-gold/55"
              >
                期間リセット
              </button>
            </section>
          ) : (
            <>
              <section aria-labelledby="concept-graph-summary-heading" className="space-y-3">
                <h2 id="concept-graph-summary-heading" className="text-sm font-semibold text-celestial-softGold">
                  サマリ{hasDateFilter ? "（選択期間内）" : ""}
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border border-celestial-border/60 bg-nordic-navy/40 p-4 backdrop-blur-sm">
                    <p className="text-xs text-celestial-textSub">対象ログ数</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums text-celestial-textMain">
                      {summary.totalLogs}
                      <span className="text-lg font-medium text-celestial-textSub"> 件</span>
                    </p>
                  </div>
                  <div className="rounded-xl border border-celestial-border/60 bg-nordic-navy/40 p-4 backdrop-blur-sm">
                    <p className="text-xs text-celestial-textSub">誤答ログ数</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums text-celestial-textMain">
                      {summary.incorrectLogs}
                      <span className="text-lg font-medium text-celestial-textSub"> 件</span>
                    </p>
                  </div>
                  <div className="rounded-xl border border-celestial-border/60 bg-nordic-navy/40 p-4 backdrop-blur-sm">
                    <p className="text-xs text-celestial-textSub">混同ペア種類数</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums text-celestial-textMain">
                      {summary.confusionPairCount}
                      <span className="text-lg font-medium text-celestial-textSub"> 種</span>
                    </p>
                    <p className="mt-2 text-[11px] text-celestial-textSub">選んだ Concept → 正解 Concept の組み合わせの種類</p>
                  </div>
                  <div className="rounded-xl border border-celestial-border/60 bg-nordic-navy/40 p-4 backdrop-blur-sm">
                    <p className="text-xs text-celestial-textSub">誤って選ばれやすい Concept</p>
                    <p className="mt-1 text-lg font-semibold leading-snug text-celestial-softGold">
                      {topMisleadingLabel}
                    </p>
                    <p className="mt-2 text-[11px] text-celestial-textSub">誤答時に「選ばれた」回数が最大の Concept</p>
                  </div>
                </div>
              </section>

              {!hasLinkedWrongAnswer ? (
                <section
                  className="rounded-xl border border-dashed border-celestial-border/80 bg-celestial-deepBlue/20 px-5 py-10 text-center backdrop-blur-sm"
                  aria-labelledby="concept-graph-linked-empty-title"
                >
                  <h2 id="concept-graph-linked-empty-title" className="text-base font-semibold text-celestial-softGold">
                    まだ Concept リンク付きの誤答ログがありません
                  </h2>
                  <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-celestial-textSub">
                    選択肢が Concept にリンクされたクイズを解き、誤答したログがあると、ここに混同関係が表示されます。リンクの無い誤答のみの場合は、下記は参考情報としてのみ表示されます。
                  </p>
                </section>
              ) : null}

              <section aria-labelledby="concept-graph-pairs-heading" className="space-y-3">
                <h2 id="concept-graph-pairs-heading" className="text-sm font-semibold text-celestial-softGold">
                  Concept 取り違えペア
                </h2>
                <p className="text-xs text-celestial-textSub">
                  誤答ごとに「選んだ Concept → 正解 Concept」を矢印で表します。件数の多い順です。
                </p>
                <div className="overflow-x-auto scrollbar-none rounded-xl border border-celestial-border/70 bg-nordic-navy/35 backdrop-blur-sm">
                  <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                    <caption className="sr-only">Concept 取り違えペア。件数の多い順</caption>
                    <thead>
                      <tr className="border-b border-celestial-border/50 text-xs uppercase tracking-wide text-celestial-textSub">
                        <th scope="col" className="px-4 py-3 font-medium">
                          選んだ Concept
                        </th>
                        <th scope="col" className="px-4 py-3 font-medium text-center">
                          →
                        </th>
                        <th scope="col" className="px-4 py-3 font-medium">
                          正解 Concept
                        </th>
                        <th scope="col" className="px-4 py-3 font-medium">
                          件数
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {confusionEdges.map((e) => (
                        <tr key={`${e.selectedKey}\u0000${e.correctKey}`} className="border-b border-celestial-border/30 last:border-0">
                          <td className="max-w-[220px] px-4 py-3 text-celestial-textMain">
                            <span className="line-clamp-2" title={formatConceptGraphNodeLabel(e.selectedKey, titleById)}>
                              {formatConceptGraphNodeLabel(e.selectedKey, titleById)}
                            </span>
                          </td>
                          <td className="px-2 py-3 text-center text-celestial-gold/90" aria-hidden="true">
                            →
                          </td>
                          <td className="max-w-[220px] px-4 py-3 text-celestial-textMain">
                            <span className="line-clamp-2" title={formatConceptGraphNodeLabel(e.correctKey, titleById)}>
                              {formatConceptGraphNodeLabel(e.correctKey, titleById)}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 tabular-nums text-celestial-textMain">{e.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section aria-labelledby="concept-graph-nodes-heading" className="space-y-3">
                <h2 id="concept-graph-nodes-heading" className="text-sm font-semibold text-celestial-softGold">
                  Concept 別混同サマリ
                </h2>
                <p className="text-xs text-celestial-textSub">
                  誤答ログから集計します。並びは「誤って選ばれた回数」の多い順、同数なら「正解として出た回数（誤答時）」の多い順です。
                </p>
                <div className="overflow-x-auto scrollbar-none rounded-xl border border-celestial-border/70 bg-nordic-navy/35 backdrop-blur-sm">
                  <table className="w-full min-w-[880px] border-collapse text-left text-sm">
                    <caption className="sr-only">Concept 別の混同サマリ</caption>
                    <thead>
                      <tr className="border-b border-celestial-border/50 text-xs uppercase tracking-wide text-celestial-textSub">
                        <th scope="col" className="px-4 py-3 font-medium">
                          Concept
                        </th>
                        <th scope="col" className="px-4 py-3 font-medium">
                          誤って選ばれた回数
                        </th>
                        <th scope="col" className="px-4 py-3 font-medium">
                          正解として出た回数（誤答時）
                        </th>
                        <th scope="col" className="px-4 py-3 font-medium">
                          関連する混同ペア数
                        </th>
                        <th scope="col" className="px-4 py-3 font-medium">
                          最終出現
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {nodeStats.map((row) => (
                        <tr key={row.conceptKey} className="border-b border-celestial-border/30 last:border-0">
                          <th scope="row" className="max-w-[240px] px-4 py-3 font-normal text-celestial-softGold">
                            <span className="line-clamp-2" title={formatConceptGraphNodeLabel(row.conceptKey, titleById)}>
                              {formatConceptGraphNodeLabel(row.conceptKey, titleById)}
                            </span>
                          </th>
                          <td className="px-4 py-3 tabular-nums text-celestial-textMain">{row.chosenAsWrongCount}</td>
                          <td className="px-4 py-3 tabular-nums text-celestial-textMain">{row.asCorrectInWrongCount}</td>
                          <td className="px-4 py-3 tabular-nums text-celestial-textMain">{row.relatedPairCount}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-celestial-textMain">
                            {row.lastAppearanceAt ? (
                              <time dateTime={row.lastAppearanceAt}>{shortDateTime(row.lastAppearanceAt)}</time>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section aria-labelledby="concept-graph-network-heading" className="space-y-3">
                <h2 id="concept-graph-network-heading" className="text-sm font-semibold text-celestial-softGold">
                  簡易ネットワーク
                </h2>
                <p className="text-xs text-celestial-textSub">
                  Concept ごとに、混同の相手と件数をカードで示します（本格的なグラフ描画は含みません）。
                </p>
                <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
                  {nodeStats.map((row) => {
                    const partners = partnersByConcept.get(row.conceptKey) ?? [];
                    return (
                      <article
                        key={row.conceptKey}
                        className="rounded-2xl border border-celestial-border/70 bg-nordic-navy/40 p-4 shadow-[inset_0_0_0_1px_rgba(77,255,154,0.06)] backdrop-blur-sm"
                      >
                        <h3 className="text-base font-semibold text-celestial-softGold">
                          {formatConceptGraphNodeLabel(row.conceptKey, titleById)}
                        </h3>
                        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                          <div className="rounded-lg border border-celestial-border/40 bg-celestial-deepBlue/30 px-2 py-2">
                            <dt className="text-celestial-textSub">誤選</dt>
                            <dd className="tabular-nums text-celestial-textMain">{row.chosenAsWrongCount}</dd>
                          </div>
                          <div className="rounded-lg border border-celestial-border/40 bg-celestial-deepBlue/30 px-2 py-2">
                            <dt className="text-celestial-textSub">正解側（誤答時）</dt>
                            <dd className="tabular-nums text-celestial-textMain">{row.asCorrectInWrongCount}</dd>
                          </div>
                          <div className="rounded-lg border border-celestial-border/40 bg-celestial-deepBlue/30 px-2 py-2">
                            <dt className="text-celestial-textSub">混同ペア</dt>
                            <dd className="tabular-nums text-celestial-textMain">{row.relatedPairCount}</dd>
                          </div>
                        </dl>
                        {partners.length === 0 ? (
                          <p className="mt-3 text-xs text-celestial-textSub">接続する混同ペアがありません。</p>
                        ) : (
                          <ul className="mt-4 space-y-2 border-t border-celestial-border/40 pt-3 text-xs">
                            {partners.map((p, idx) => (
                              <li
                                key={`${row.conceptKey}-${p.direction}-${p.partnerKey}-${idx}`}
                                className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-celestial-textMain"
                              >
                                <span className="text-celestial-textSub">{partnerDirectionLabel(p)}:</span>
                                <span className="font-medium text-celestial-softGold">
                                  {formatConceptGraphNodeLabel(p.partnerKey, titleById)}
                                </span>
                                <span className="tabular-nums text-celestial-textSub">× {p.count}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </article>
                    );
                  })}
                </div>
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
};
