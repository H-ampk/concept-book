import { useCallback, useEffect, useMemo, useState } from "react";
import { getStorage } from "../storage";
import type { Concept } from "../types/concept";
import type { QuizAttemptLog, QuizQuestion } from "../types/quiz";
import { filterLogsByAnsweredDateRange } from "../utils/quizAttemptDateFilter";
import { computeConfusionEdges } from "../utils/quizConceptGraphStats";
import { generateResearchReportMarkdown } from "../utils/quizResearchReport";
import { computeOverallSummary, formatSecondsFromMs } from "../utils/quizStats";
import { OrnamentLine } from "./common/OrnamentLine";

const storage = getStorage();

type Props = {
  onBack: () => void;
  onGoToQuizPlay: () => void;
};

const periodLabelFromFilters = (dateStart: string, dateEnd: string): string => {
  const a = dateStart.trim();
  const b = dateEnd.trim();
  if (!a && !b) {
    return "指定なし（保存されている全ログの answeredAt を対象）";
  }
  if (a && b) {
    return `${a} 〜 ${b}（ローカル日の始端・終端で answeredAt を比較）`;
  }
  if (a) {
    return `${a} 以降（answeredAt）`;
  }
  return `${b} 以前（answeredAt）`;
};

export const ResearchReportPage = ({ onBack, onGoToQuizPlay }: Props) => {
  const [logs, setLogs] = useState<QuizAttemptLog[]>([]);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [copyDone, setCopyDone] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [allLogs, allConcepts, allQuestions] = await Promise.all([
        storage.getQuizAttemptLogs(),
        storage.getAllConcepts(),
        storage.getQuizQuestions()
      ]);
      setLogs(allLogs);
      setConcepts(allConcepts);
      setQuestions(allQuestions);
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

  const periodLabel = useMemo(() => periodLabelFromFilters(dateStart, dateEnd), [dateStart, dateEnd]);

  const markdown = useMemo(() => {
    if (logsInPeriod.length === 0) {
      return "";
    }
    return generateResearchReportMarkdown({
      logs: logsInPeriod,
      titleById,
      periodLabel,
      quizQuestionCount: questions.length
    });
  }, [logsInPeriod, titleById, periodLabel, questions.length]);

  const summary = useMemo(() => computeOverallSummary(logsInPeriod), [logsInPeriod]);

  const confusionPairKinds = useMemo(
    () => computeConfusionEdges(logsInPeriod).length,
    [logsInPeriod]
  );

  const resetDateRange = () => {
    setDateStart("");
    setDateEnd("");
  };

  const hasDateFilter = dateStart.trim() !== "" || dateEnd.trim() !== "";

  const handleCopy = async () => {
    if (!markdown) {
      return;
    }
    try {
      await navigator.clipboard.writeText(markdown);
      setCopyDone(true);
      window.setTimeout(() => setCopyDone(false), 2500);
    } catch {
      window.alert("コピーに失敗しました。ブラウザの権限設定を確認してください。");
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-1 sm:px-0">
      <section
        className="relative rounded-3xl border border-celestial-border bg-celestial-panel/90 p-5 shadow-celestial backdrop-blur-md decorated-card sm:p-6"
        aria-labelledby="research-report-title"
      >
        <span className="card-corner card-corner-top-left" aria-hidden="true" />
        <span className="card-corner card-corner-top-right" aria-hidden="true" />
        <span className="card-corner card-corner-bottom-left" aria-hidden="true" />
        <span className="card-corner card-corner-bottom-right" aria-hidden="true" />

        <div className="relative z-[1] space-y-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-celestial-gold/80">Lab · 観測室</p>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0 space-y-2">
              <h1 id="research-report-title" className="text-2xl font-semibold tracking-wide text-celestial-textMain md:text-3xl">
                研究レポート
              </h1>
              <p className="max-w-2xl text-sm leading-relaxed text-celestial-textSub md:text-base">
                クイズ回答ログと Concept 混同の集計をもとに、学習傾向を研究・振り返り用に文章化します。LLM
                は使わず、保存済みログからルールベースでまとめています。
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
          aria-labelledby="research-report-empty-title"
        >
          <h2 id="research-report-empty-title" className="text-lg font-semibold text-celestial-softGold">
            まだレポートを作成できるログがありません
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-celestial-textSub">
            クイズで学習すると、ここでログに基づく観察サマリを作成できます。
          </p>
          <button
            type="button"
            onClick={onGoToQuizPlay}
            className="mt-6 header-nav-button rounded-md border border-celestial-gold/50 bg-celestial-gold/10 px-4 py-2.5 text-sm font-medium text-celestial-softGold hover:bg-celestial-gold/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-celestial-gold/55"
            aria-label="クイズで学習へ移動"
          >
            クイズで学習へ
          </button>
        </section>
      ) : (
        <>
          <section aria-labelledby="research-report-date-heading" className="space-y-3">
            <h2 id="research-report-date-heading" className="text-sm font-semibold text-celestial-softGold">
              回答日時（answeredAt）で期間を絞り込む
            </h2>
            <p className="text-xs text-celestial-textSub">{periodLabel}</p>
            <div className="flex flex-col gap-4 rounded-xl border border-celestial-border/70 bg-nordic-navy/35 p-4 backdrop-blur-sm sm:flex-row sm:flex-wrap sm:items-end">
              <div>
                <label htmlFor="research-report-date-start" className="mb-1.5 block text-xs font-medium text-celestial-textSub">
                  開始日
                </label>
                <input
                  id="research-report-date-start"
                  type="date"
                  value={dateStart}
                  onChange={(e) => setDateStart(e.target.value)}
                  className="rounded-md border border-celestial-border/60 bg-nordic-navy/50 px-3 py-2 text-sm text-celestial-textMain focus:outline-none focus-visible:ring-2 focus-visible:ring-celestial-gold/55"
                />
              </div>
              <div>
                <label htmlFor="research-report-date-end" className="mb-1.5 block text-xs font-medium text-celestial-textSub">
                  終了日
                </label>
                <input
                  id="research-report-date-end"
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
              aria-labelledby="research-report-period-empty-title"
            >
              <h2 id="research-report-period-empty-title" className="text-base font-semibold text-celestial-softGold">
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
              <section aria-labelledby="research-report-cards-heading" className="space-y-3">
                <h2 id="research-report-cards-heading" className="sr-only">
                  主要指標
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border border-celestial-border/60 bg-nordic-navy/40 p-4 backdrop-blur-sm">
                    <p className="text-xs text-celestial-textSub">総回答数（期間内）</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums text-celestial-textMain">
                      {summary.totalAttempts}
                      <span className="text-lg font-medium text-celestial-textSub"> 件</span>
                    </p>
                  </div>
                  <div className="rounded-xl border border-celestial-border/60 bg-nordic-navy/40 p-4 backdrop-blur-sm">
                    <p className="text-xs text-celestial-textSub">正答率</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums text-celestial-textMain">
                      {summary.totalAttempts > 0 ? `${(summary.accuracy * 100).toFixed(1)}%` : "—"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-celestial-border/60 bg-nordic-navy/40 p-4 backdrop-blur-sm">
                    <p className="text-xs text-celestial-textSub">平均反応時間</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums text-celestial-textMain">
                      {summary.avgReactionTimeMs != null ? formatSecondsFromMs(summary.avgReactionTimeMs) : "—"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-celestial-border/60 bg-nordic-navy/40 p-4 backdrop-blur-sm">
                    <p className="text-xs text-celestial-textSub">混同ペアの種類数</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums text-celestial-textMain">
                      {confusionPairKinds}
                      <span className="text-lg font-medium text-celestial-textSub"> 種</span>
                    </p>
                    <p className="mt-2 text-[11px] text-celestial-textSub">不正解ログの Concept リンク組み合わせ</p>
                  </div>
                </div>
              </section>

              <section aria-labelledby="research-report-preview-heading" className="space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h2 id="research-report-preview-heading" className="text-sm font-semibold text-celestial-softGold">
                    レポート本文（Markdown 風）
                  </h2>
                  <button
                    type="button"
                    onClick={() => void handleCopy()}
                    className="action-button shrink-0 rounded-lg px-4 py-2 text-sm"
                    aria-label="レポート本文をクリップボードにコピー"
                  >
                    {copyDone ? "コピーしました" : "Markdown をコピー"}
                  </button>
                </div>
                <div className="overflow-x-auto scrollbar-none rounded-xl border border-celestial-border/70 bg-nordic-navy/40 backdrop-blur-sm">
                  <pre
                    className="max-h-[min(70vh,520px)] overflow-y-auto p-4 text-left text-xs leading-relaxed text-celestial-textMain sm:text-sm whitespace-pre-wrap break-words font-mono"
                    tabIndex={0}
                  >
                    {markdown}
                  </pre>
                </div>
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
};
