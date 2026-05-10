import { useCallback, useEffect, useMemo, useState } from "react";
import { getStorage } from "../storage";
import type { Concept } from "../types/concept";
import type { QuizAttemptLog, QuizQuestion } from "../types/quiz";
import { shortDateTime } from "../utils/date";
import { filterLogsByAnsweredDateRange } from "../utils/quizAttemptDateFilter";
import {
  computeConceptStats,
  computeConfusionPairs,
  computeOverallSummary,
  computeQuestionStats,
  formatConceptRef,
  formatRelatedConceptSummary,
  formatSecondsFromMs,
  isUsableReactionTimeMs,
  recentLogsSorted
} from "../utils/quizStats";
import { OrnamentLine } from "./common/OrnamentLine";

const storage = getStorage();
const RECENT_LIMIT = 20;

type Props = {
  onBack: () => void;
  onGoToQuizPlay: () => void;
  onGoToLearningLogs: () => void;
};

const pctText = (rate: number): string => `${(rate * 100).toFixed(1)}%`;

const lowAccuracyClass = (rate: number): string =>
  rate < 0.5 ? "text-amber-400/95" : "text-celestial-textMain";

export const QuizAnalysisDashboardPage = ({ onBack, onGoToQuizPlay, onGoToLearningLogs }: Props) => {
  const [logs, setLogs] = useState<QuizAttemptLog[]>([]);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");

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

  const questionById = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions]);

  const logsInPeriod = useMemo(
    () => filterLogsByAnsweredDateRange(logs, dateStart, dateEnd),
    [logs, dateStart, dateEnd]
  );

  const summary = useMemo(() => computeOverallSummary(logsInPeriod), [logsInPeriod]);
  const questionStats = useMemo(() => computeQuestionStats(logsInPeriod), [logsInPeriod]);
  const conceptStats = useMemo(() => computeConceptStats(logsInPeriod), [logsInPeriod]);
  const confusionPairs = useMemo(() => computeConfusionPairs(logsInPeriod), [logsInPeriod]);
  const recent = useMemo(() => recentLogsSorted(logsInPeriod, RECENT_LIMIT), [logsInPeriod]);

  const resetDateRange = () => {
    setDateStart("");
    setDateEnd("");
  };

  const hasDateFilter = dateStart.trim() !== "" || dateEnd.trim() !== "";

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-1 sm:px-0">
      <section
        className="relative rounded-3xl border border-celestial-border bg-celestial-panel/90 p-5 shadow-celestial backdrop-blur-md decorated-card sm:p-6"
        aria-labelledby="quiz-analysis-title"
      >
        <span className="card-corner card-corner-top-left" aria-hidden="true" />
        <span className="card-corner card-corner-top-right" aria-hidden="true" />
        <span className="card-corner card-corner-bottom-left" aria-hidden="true" />
        <span className="card-corner card-corner-bottom-right" aria-hidden="true" />

        <div className="relative z-[1] space-y-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-celestial-gold/80">Lab · 観測室</p>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0 space-y-2">
              <h1 id="quiz-analysis-title" className="text-2xl font-semibold tracking-wide text-celestial-textMain md:text-3xl">
                分析ダッシュボード
              </h1>
              <p className="max-w-2xl text-sm leading-relaxed text-celestial-textSub md:text-base">
                クイズ回答ログをもとに、理解傾向・正答率・反応時間を確認する画面です。データはこの端末の IndexedDB に保存されたログのみを対象とします。
              </p>
              <OrnamentLine variant="header" className="max-w-md opacity-80" />
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                type="button"
                onClick={onGoToLearningLogs}
                className="header-nav-button rounded-md border border-celestial-gold/50 bg-celestial-gold/10 px-3 py-2 text-sm text-celestial-softGold hover:bg-celestial-gold/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-celestial-gold/55"
                aria-label="学習ログ画面へ移動"
              >
                学習ログを見る
              </button>
              <button
                type="button"
                onClick={onBack}
                className="header-nav-button rounded-md border border-celestial-gold/50 bg-transparent px-3 py-2 text-sm text-celestial-softGold hover:bg-celestial-gold/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-celestial-gold/55"
              >
                戻る（概念へ）
              </button>
            </div>
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
          aria-labelledby="quiz-analysis-empty-title"
        >
          <h2 id="quiz-analysis-empty-title" className="text-lg font-semibold text-celestial-softGold">
            まだ回答ログがありません
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-celestial-textSub">
            クイズで学習すると、ここに分析結果が表示されます。
          </p>
          <button
            type="button"
            onClick={onGoToQuizPlay}
            className="mt-6 header-nav-button rounded-md border border-celestial-gold/50 bg-celestial-gold/10 px-4 py-2.5 text-sm font-medium text-celestial-softGold hover:bg-celestial-gold/20"
            aria-label="クイズで学習の画面へ移動"
          >
            クイズで学習へ
          </button>
        </section>
      ) : (
        <>
          <section aria-labelledby="quiz-analysis-date-heading" className="space-y-3">
            <h2 id="quiz-analysis-date-heading" className="text-sm font-semibold text-celestial-softGold">
              回答日時（answeredAt）で期間を絞り込む
            </h2>
            <p className="text-xs text-celestial-textSub">
              未指定の項目は条件に含めません。日付は端末のローカル日（カレンダー日）の始端・終端で比較します。
            </p>
            <div className="flex flex-col gap-4 rounded-xl border border-celestial-border/70 bg-nordic-navy/35 p-4 backdrop-blur-sm sm:flex-row sm:flex-wrap sm:items-end">
              <div>
                <label htmlFor="quiz-analysis-date-start" className="mb-1.5 block text-xs font-medium text-celestial-textSub">
                  開始日
                </label>
                <input
                  id="quiz-analysis-date-start"
                  type="date"
                  value={dateStart}
                  onChange={(e) => setDateStart(e.target.value)}
                  className="rounded-md border border-celestial-border/60 bg-nordic-navy/50 px-3 py-2 text-sm text-celestial-textMain focus:outline-none focus-visible:ring-2 focus-visible:ring-celestial-gold/55"
                />
              </div>
              <div>
                <label htmlFor="quiz-analysis-date-end" className="mb-1.5 block text-xs font-medium text-celestial-textSub">
                  終了日
                </label>
                <input
                  id="quiz-analysis-date-end"
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
              aria-labelledby="quiz-analysis-period-empty-title"
            >
              <h2 id="quiz-analysis-period-empty-title" className="text-base font-semibold text-celestial-softGold">
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
          <section aria-labelledby="quiz-analysis-summary-heading" className="space-y-3">
            <h2 id="quiz-analysis-summary-heading" className="text-sm font-semibold text-celestial-softGold">
              全体サマリ{hasDateFilter ? "（選択期間内）" : ""}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-celestial-border/60 bg-nordic-navy/40 p-4 backdrop-blur-sm">
                <p className="text-xs text-celestial-textSub">総回答数</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-celestial-textMain">
                  {summary.totalAttempts}
                  <span className="text-lg font-medium text-celestial-textSub"> 件</span>
                </p>
              </div>
              <div className="rounded-xl border border-celestial-border/60 bg-nordic-navy/40 p-4 backdrop-blur-sm">
                <p className="text-xs text-celestial-textSub">正答率</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-celestial-textMain">
                  {pctText(summary.accuracy)}
                </p>
                <p className="mt-2 text-xs text-celestial-textSub">
                  テキスト表記: 正解 {summary.correctCount} 件、不正解 {summary.incorrectCount} 件
                </p>
              </div>
              <div className="rounded-xl border border-celestial-border/60 bg-nordic-navy/40 p-4 backdrop-blur-sm">
                <p className="text-xs text-celestial-textSub">平均反応時間</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-celestial-textMain">
                  {summary.avgReactionTimeMs != null
                    ? formatSecondsFromMs(summary.avgReactionTimeMs)
                    : "—"}
                </p>
                <p className="mt-2 text-xs text-celestial-textSub">
                  timeMs が 0 または不正なログは平均から除外
                </p>
              </div>
              <div className="rounded-xl border border-celestial-border/60 bg-nordic-navy/40 p-4 backdrop-blur-sm">
                <p className="text-xs text-celestial-textSub">最終回答日時</p>
                <p className="mt-1 text-lg font-semibold text-celestial-textMain">
                  {summary.lastAnsweredAt ? shortDateTime(summary.lastAnsweredAt) : "—"}
                </p>
              </div>
            </div>
          </section>

          <section aria-labelledby="quiz-analysis-concept-heading" className="space-y-3">
            <h2 id="quiz-analysis-concept-heading" className="text-sm font-semibold text-celestial-softGold">
              Concept 別の傾向
            </h2>
            <p className="text-xs text-celestial-textSub">
              各ログを 1 回として、正解選択肢の linkedConceptId を優先し、なければ問題の conceptId で集計します。どちらも無い場合は「未分類」です。
            </p>
            <div className="overflow-x-auto scrollbar-none rounded-xl border border-celestial-border/70 bg-nordic-navy/35 backdrop-blur-sm">
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <caption className="sr-only">Concept 別の回答数・正答率・平均反応時間</caption>
                <thead>
                  <tr className="border-b border-celestial-border/50 text-xs uppercase tracking-wide text-celestial-textSub">
                    <th scope="col" className="px-4 py-3 font-medium">
                      Concept
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      回答数
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      正解数
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      正答率
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      平均反応時間
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {conceptStats.map((row) => {
                    const name = formatConceptRef(row.bucketId, titleById);
                    return (
                      <tr
                        key={row.bucketId ?? "__uncategorized__"}
                        className="border-b border-celestial-border/30 last:border-0"
                      >
                        <th scope="row" className="max-w-[220px] px-4 py-3 font-normal text-celestial-textMain">
                          <span className="line-clamp-2" title={name}>
                            {name}
                          </span>
                        </th>
                        <td className="px-4 py-3 tabular-nums text-celestial-textMain">{row.attemptCount}</td>
                        <td className="px-4 py-3 tabular-nums text-celestial-textMain">{row.correctCount}</td>
                        <td
                          className={`px-4 py-3 tabular-nums ${lowAccuracyClass(row.accuracy)}`}
                          title={`正答率 ${pctText(row.accuracy)}（正解 ${row.correctCount} / ${row.attemptCount}）`}
                        >
                          {pctText(row.accuracy)}
                          <span className="sr-only">
                            。正解 {row.correctCount} 件、全 {row.attemptCount} 件中。
                          </span>
                        </td>
                        <td className="px-4 py-3 tabular-nums text-celestial-textMain">
                          {row.avgReactionTimeMs != null
                            ? formatSecondsFromMs(row.avgReactionTimeMs)
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section aria-labelledby="quiz-analysis-question-heading" className="space-y-3">
            <h2 id="quiz-analysis-question-heading" className="text-sm font-semibold text-celestial-softGold">
              問題別の成績
            </h2>
            <p className="text-xs text-celestial-textSub">
              問題文は、当該問題のうち最も新しい回答ログのスナップショットを表示します。並びは回答数の多い順、同数なら正答率が低い順です。
            </p>
            <div className="overflow-x-auto scrollbar-none rounded-xl border border-celestial-border/70 bg-nordic-navy/35 backdrop-blur-sm">
              <table className="w-full min-w-[860px] border-collapse text-left text-sm">
                <caption className="sr-only">問題別の回答数・正答率・平均反応時間</caption>
                <thead>
                  <tr className="border-b border-celestial-border/50 text-xs uppercase tracking-wide text-celestial-textSub">
                    <th scope="col" className="px-4 py-3 font-medium">
                      問題文（スナップショット）
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      回答数
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      正解数
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      正答率
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      平均反応時間
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      最終回答
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {questionStats.map((row) => {
                    const currentQ = questionById.get(row.questionId);
                    const titleHint = currentQ
                      ? `ログ時点の問題文:\n${row.promptSnapshot}\n\n現在DB上の問題文:\n${currentQ.prompt}`
                      : `ログ時点の問題文:\n${row.promptSnapshot}\n\n（このIDの問題は現在の一覧にありません）`;
                    return (
                    <tr key={row.questionId} className="border-b border-celestial-border/30 last:border-0">
                      <th scope="row" className="max-w-md px-4 py-3 font-normal text-celestial-textMain">
                        <span className="line-clamp-2" title={titleHint}>
                          {row.promptSnapshot}
                        </span>
                        <p className="mt-1 text-[11px] text-celestial-textSub/90">
                          問題ID: {row.questionId}
                          {currentQ ? "" : " · 現在の問題一覧に未登録"}
                        </p>
                      </th>
                      <td className="px-4 py-3 tabular-nums text-celestial-textMain">{row.attemptCount}</td>
                      <td className="px-4 py-3 tabular-nums text-celestial-textMain">{row.correctCount}</td>
                      <td
                        className={`px-4 py-3 tabular-nums ${lowAccuracyClass(row.accuracy)}`}
                        title={`正答率 ${pctText(row.accuracy)}（正解 ${row.correctCount} / ${row.attemptCount}）`}
                      >
                        {pctText(row.accuracy)}
                        <span className="sr-only">
                          。正解 {row.correctCount} 件、全 {row.attemptCount} 件中。
                        </span>
                      </td>
                      <td className="px-4 py-3 tabular-nums text-celestial-textMain">
                        {row.avgReactionTimeMs != null
                          ? formatSecondsFromMs(row.avgReactionTimeMs)
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-celestial-textMain">
                        {shortDateTime(row.lastAnsweredAt)}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section aria-labelledby="quiz-analysis-confusion-heading" className="space-y-3">
            <h2 id="quiz-analysis-confusion-heading" className="text-sm font-semibold text-celestial-softGold">
              誤答時の Concept 取り違え（簡易）
            </h2>
            <p className="text-xs text-celestial-textSub">
              不正解のログだけを対象に、選択肢の linkedConceptId と正解肢の linkedConceptId の組み合わせを数えます。リンクが無い側は「未分類」として表示します。
            </p>
            {confusionPairs.length === 0 ? (
              <p className="rounded-xl border border-celestial-border/50 bg-nordic-navy/30 px-4 py-3 text-sm text-celestial-textSub">
                該当する不正解ログはまだありません。
              </p>
            ) : (
              <div className="overflow-x-auto scrollbar-none rounded-xl border border-celestial-border/70 bg-nordic-navy/35 backdrop-blur-sm">
                <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                  <caption className="sr-only">誤答時に選んだ Concept と正解 Concept の組み合わせ別件数</caption>
                  <thead>
                    <tr className="border-b border-celestial-border/50 text-xs uppercase tracking-wide text-celestial-textSub">
                      <th scope="col" className="px-4 py-3 font-medium">
                        選んだ Concept
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
                    {confusionPairs.map((p) => (
                      <tr
                        key={`${p.selectedConceptId ?? ""}-${p.correctConceptId ?? ""}`}
                        className="border-b border-celestial-border/30 last:border-0"
                      >
                        <td className="px-4 py-3 text-celestial-textMain">
                          {formatConceptRef(p.selectedConceptId, titleById)}
                        </td>
                        <td className="px-4 py-3 text-celestial-textMain">
                          {formatConceptRef(p.correctConceptId, titleById)}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-celestial-textMain">{p.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section aria-labelledby="quiz-analysis-recent-heading" className="space-y-3">
            <h2 id="quiz-analysis-recent-heading" className="text-sm font-semibold text-celestial-softGold">
              最近の回答履歴
            </h2>
            <p className="text-xs text-celestial-textSub">
              answeredAt の新しい順に最大 {RECENT_LIMIT} 件です（上記の期間フィルタが適用されます）。
            </p>
            <p className="text-sm">
              <button
                type="button"
                onClick={onGoToLearningLogs}
                className="text-celestial-softGold underline decoration-celestial-gold/50 underline-offset-2 hover:decoration-celestial-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-celestial-gold/55 rounded"
              >
                学習ログで一覧・検索・削除
              </button>
              <span className="text-celestial-textSub"> — 全件の履歴や絞り込みはこちらから。</span>
            </p>
            <div className="overflow-x-auto scrollbar-none rounded-xl border border-celestial-border/70 bg-nordic-navy/35 backdrop-blur-sm">
              <table className="w-full min-w-[960px] border-collapse text-left text-sm">
                <caption className="sr-only">最近のクイズ回答ログ</caption>
                <thead>
                  <tr className="border-b border-celestial-border/50 text-xs uppercase tracking-wide text-celestial-textSub">
                    <th scope="col" className="px-4 py-3 font-medium">
                      回答日時
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      問題文
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      選んだ選択肢
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      正解選択肢
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      正誤
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      反応時間
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      関連 Concept
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((log) => (
                    <tr key={log.id} className="border-b border-celestial-border/30 last:border-0">
                      <td className="whitespace-nowrap px-4 py-3 text-celestial-textMain">
                        {shortDateTime(log.answeredAt)}
                      </td>
                      <td className="max-w-xs px-4 py-3 text-celestial-textMain">
                        <span className="line-clamp-2" title={log.questionPromptSnapshot}>
                          {log.questionPromptSnapshot}
                        </span>
                      </td>
                      <td className="max-w-[200px] px-4 py-3 text-celestial-textMain">
                        <span className="line-clamp-2" title={log.selectedChoiceTextSnapshot}>
                          {log.selectedChoiceTextSnapshot}
                        </span>
                      </td>
                      <td className="max-w-[200px] px-4 py-3 text-celestial-textMain">
                        <span className="line-clamp-2" title={log.correctChoiceTextSnapshot}>
                          {log.correctChoiceTextSnapshot}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {log.correct ? (
                          <span className="text-emerald-400/95">
                            正解<span className="sr-only">。正しい回答です。</span>
                          </span>
                        ) : (
                          <span className="text-rose-400/90">
                            不正解<span className="sr-only">。誤った回答です。</span>
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-celestial-textMain">
                        {isUsableReactionTimeMs(log.timeMs)
                          ? formatSecondsFromMs(log.timeMs)
                          : `${log.timeMs} ms（計測対象外）`}
                      </td>
                      <td className="max-w-[280px] px-4 py-3 text-celestial-textMain">
                        <span className="line-clamp-2" title={formatRelatedConceptSummary(log, titleById)}>
                          {formatRelatedConceptSummary(log, titleById)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
            </>
          )}
        </>
      )}
    </div>
  );
};
