import { useCallback, useEffect, useMemo, useState } from "react";
import { getStorage } from "../storage";
import type { Concept } from "../types/concept";
import type { QuizAttemptLog, QuizQuestion } from "../types/quiz";
import { shortDateTime } from "../utils/date";
import { filterLogsByAnsweredDateRange } from "../utils/quizAttemptDateFilter";
import {
  matchesQuizAttemptHistoryResultFilter,
  matchesQuizAttemptHistorySearch,
  matchesQuizAttemptQuestionTypeFilter,
  presentQuizAttemptHistory,
  summarizeQuizAttemptHistoryOutcomes,
  type QuizAttemptHistoryQuestionTypeFilter,
  type QuizAttemptHistoryResultFilter,
  type QuizAttemptHistoryResultKind
} from "../utils/quiz/quizAttemptHistoryPresentation";
import {
  formatDeckSourceLabel,
  formatRelatedConceptSummary,
  formatSecondsFromMs,
  isUsableReactionTimeMs
} from "../utils/quizStats";
import { OrnamentLine } from "./common/OrnamentLine";

const storage = getStorage();

type Props = {
  onBack: () => void;
  onGoToQuizPlay: () => void;
  onGoToAnalysisDashboard: () => void;
};

const matchesConcept = (log: QuizAttemptLog, conceptId: string): boolean => {
  if (!conceptId) {
    return true;
  }
  return (
    log.questionConceptId === conceptId ||
    log.selectedLinkedConceptId === conceptId ||
    log.correctLinkedConceptId === conceptId
  );
};

const sortAnsweredDesc = (items: QuizAttemptLog[]): QuizAttemptLog[] =>
  [...items].sort((a, b) => b.answeredAt.localeCompare(a.answeredAt));

const resultToneClass = (kind: QuizAttemptHistoryResultKind): string => {
  if (kind === "correct") {
    return "text-celestial-emerald";
  }
  if (kind === "partial") {
    return "text-amber-300";
  }
  return "text-rose-400/90";
};

const ResultMark = ({ kind, label }: { kind: QuizAttemptHistoryResultKind; label: string }) => (
  <span className={resultToneClass(kind)}>
    {label}
    {kind === "correct" ? (
      <span className="sr-only">。正しい回答です。</span>
    ) : kind === "partial" ? (
      <span className="sr-only">。部分的に正しい回答です。</span>
    ) : (
      <span className="sr-only">。誤った回答です。</span>
    )}
  </span>
);

export const QuizLearningLogsPage = ({ onBack, onGoToQuizPlay, onGoToAnalysisDashboard }: Props) => {
  const [logs, setLogs] = useState<QuizAttemptLog[]>([]);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [questionTypeFilter, setQuestionTypeFilter] = useState<QuizAttemptHistoryQuestionTypeFilter>("all");
  const [resultFilter, setResultFilter] = useState<QuizAttemptHistoryResultFilter>("all");
  const [conceptFilter, setConceptFilter] = useState("");
  const [search, setSearch] = useState("");
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

  const conceptOptions = useMemo(
    () => [...concepts].sort((a, b) => (a.title || "").localeCompare(b.title || "", "ja")),
    [concepts]
  );

  const logsInPeriod = useMemo(
    () => filterLogsByAnsweredDateRange(logs, dateStart, dateEnd),
    [logs, dateStart, dateEnd]
  );

  const filteredLogs = useMemo(() => {
    let rows = logsInPeriod;
    rows = rows.filter((l) => matchesQuizAttemptQuestionTypeFilter(l, questionTypeFilter));
    rows = rows.filter((l) => matchesQuizAttemptHistoryResultFilter(l, resultFilter));
    rows = rows.filter((l) => matchesConcept(l, conceptFilter));
    rows = rows.filter((l) => matchesQuizAttemptHistorySearch(l, search));
    return sortAnsweredDesc(rows);
  }, [logsInPeriod, questionTypeFilter, resultFilter, conceptFilter, search]);

  const historySummary = useMemo(() => summarizeQuizAttemptHistoryOutcomes(filteredLogs), [filteredLogs]);
  const avgReactionTimeMs = useMemo(() => {
    let timeSum = 0;
    let timeN = 0;
    for (const log of filteredLogs) {
      if (isUsableReactionTimeMs(log.timeMs)) {
        timeSum += log.timeMs;
        timeN += 1;
      }
    }
    return timeN > 0 ? timeSum / timeN : null;
  }, [filteredLogs]);

  const resetFilters = () => {
    setQuestionTypeFilter("all");
    setResultFilter("all");
    setConceptFilter("");
    setSearch("");
    setDateStart("");
    setDateEnd("");
  };

  const resetDateRangeOnly = () => {
    setDateStart("");
    setDateEnd("");
  };

  const hasDateFilter = dateStart.trim() !== "" || dateEnd.trim() !== "";

  const hasActiveFilters =
    questionTypeFilter !== "all" ||
    resultFilter !== "all" ||
    conceptFilter !== "" ||
    search.trim() !== "" ||
    hasDateFilter;

  const handleDeleteOne = async (log: QuizAttemptLog) => {
    if (
      !window.confirm(
        `この学習ログを削除しますか？\n\n回答: ${shortDateTime(log.answeredAt)}\n問題: ${log.questionPromptSnapshot.slice(0, 80)}${log.questionPromptSnapshot.length > 80 ? "…" : ""}`
      )
    ) {
      return;
    }
    try {
      await storage.deleteQuizAttemptLog(log.id);
      await load();
    } catch {
      window.alert("削除に失敗しました。時間をおいて再試行してください。");
    }
  };

  const handleClearAll = async () => {
    if (logs.length === 0) {
      return;
    }
    if (
      !window.confirm(
        `【危険な操作】保存されている学習ログ ${logs.length} 件をすべて削除します。\n\nこの操作は取り消せません。本当に実行しますか？`
      )
    ) {
      return;
    }
    if (
      !window.confirm(
        "最終確認: すべての学習ログを完全に削除してよろしいですか？\n\n「OK」で即座に削除されます。"
      )
    ) {
      return;
    }
    try {
      await storage.clearQuizAttemptLogs();
      resetFilters();
      await load();
    } catch {
      window.alert("全削除に失敗しました。時間をおいて再試行してください。");
    }
  };

  const questionTitleHint = (log: QuizAttemptLog): string => {
    const currentQ = questionById.get(log.questionId);
    if (currentQ) {
      return `ログ時点の問題文:\n${log.questionPromptSnapshot}\n\n現在DB上の問題文:\n${currentQ.prompt}`;
    }
    return `ログ時点の問題文:\n${log.questionPromptSnapshot}\n\n（このIDの問題は現在の一覧にありません）`;
  };

  const renderReaction = (log: QuizAttemptLog): string =>
    isUsableReactionTimeMs(log.timeMs) ? formatSecondsFromMs(log.timeMs) : `${log.timeMs} ms（計測対象外）`;

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-1 sm:px-0">
      <section
        className="relative rounded-3xl border border-celestial-border bg-celestial-panel/90 p-4 shadow-celestial backdrop-blur-md decorated-card sm:p-5"
        aria-labelledby="learning-logs-title"
      >
        <div className="relative z-[1] flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-celestial-gold/80">Lab · 観測室</p>
            <h1 id="learning-logs-title" className="text-2xl font-semibold tracking-wide text-celestial-textMain md:text-3xl">
              学習ログ
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-celestial-textSub md:text-base">
              クイズで学習した回答履歴を確認する画面です。回答形式・回答内容・正答／模範解答・自己評価・反応時間・関連
              Concept を時系列で確認できます。データはこの端末に保存されたログのみです。
            </p>
            <OrnamentLine variant="header" className="max-w-md opacity-80" />
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              onClick={onGoToAnalysisDashboard}
              className="header-nav-button rounded-md border border-celestial-gold/50 bg-celestial-gold/10 px-3 py-2 text-sm text-celestial-softGold hover:bg-celestial-gold/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-celestial-gold/55"
              aria-label="分析ダッシュボードへ移動"
            >
              分析ダッシュボードを見る
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
      </section>

      {loading ? (
        <p className="text-center text-sm text-celestial-textSub" role="status">
          読み込み中…
        </p>
      ) : logs.length === 0 ? (
        <section
          className="rounded-3xl border border-celestial-border/70 bg-nordic-navy/35 px-5 py-8 text-center backdrop-blur-sm"
          aria-labelledby="learning-logs-empty-title"
        >
          <h2 id="learning-logs-empty-title" className="text-lg font-semibold text-celestial-softGold">
            まだ学習ログがありません
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-celestial-textSub">
            クイズで学習すると、ここに履歴が表示されます。
          </p>
          <button
            type="button"
            onClick={onGoToQuizPlay}
            className="mt-4 header-nav-button rounded-md border border-celestial-gold/50 bg-celestial-gold/10 px-4 py-2.5 text-sm font-medium text-celestial-softGold hover:bg-celestial-gold/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-celestial-gold/55"
            aria-label="クイズで学習の画面へ移動"
          >
            クイズで学習へ
          </button>
        </section>
      ) : (
        <>
          <section aria-labelledby="learning-logs-summary-heading" className="space-y-3">
            <h2 id="learning-logs-summary-heading" className="text-sm font-semibold text-celestial-softGold">
              サマリ（表示中のログ）
            </h2>
            {hasActiveFilters ? (
              <p className="text-xs text-celestial-textSub">
                フィルタ適用中: 全 {logs.length} 件中 {filteredLogs.length} 件を表示
                {hasDateFilter
                  ? `（期間条件に一致するログ ${logsInPeriod.length} 件を対象に、そのほかの条件を適用）`
                  : ""}
              </p>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div className="rounded-xl border border-celestial-border/60 bg-nordic-navy/40 p-4 backdrop-blur-sm">
                <p className="text-xs text-celestial-textSub">件数</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-celestial-textMain">
                  {historySummary.total}
                  <span className="text-lg font-medium text-celestial-textSub"> 件</span>
                </p>
              </div>
              <div className="rounded-xl border border-celestial-border/60 bg-nordic-navy/40 p-4 backdrop-blur-sm">
                <p className="text-xs text-celestial-textSub">正解</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-celestial-emerald">
                  {historySummary.correctCount} 件
                </p>
              </div>
              <div className="rounded-xl border border-celestial-border/60 bg-nordic-navy/40 p-4 backdrop-blur-sm">
                <p className="text-xs text-celestial-textSub">部分的に正解</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-amber-300">
                  {historySummary.partialCount} 件
                </p>
              </div>
              <div className="rounded-xl border border-celestial-border/60 bg-nordic-navy/40 p-4 backdrop-blur-sm">
                <p className="text-xs text-celestial-textSub">不正解</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-rose-400/90">
                  {historySummary.incorrectCount} 件
                </p>
              </div>
              <div className="rounded-xl border border-celestial-border/60 bg-nordic-navy/40 p-4 backdrop-blur-sm">
                <p className="text-xs text-celestial-textSub">平均反応時間</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-celestial-textMain">
                  {avgReactionTimeMs != null ? formatSecondsFromMs(avgReactionTimeMs) : "—"}
                </p>
                <p className="mt-2 text-xs text-celestial-textSub">timeMs が 0 または不正なログは平均から除外</p>
              </div>
            </div>
          </section>

          <section aria-labelledby="learning-logs-filters-heading" className="space-y-3">
            <h2 id="learning-logs-filters-heading" className="text-sm font-semibold text-celestial-softGold">
              絞り込み
            </h2>
            <div className="flex flex-col gap-3 rounded-xl border border-celestial-border/70 bg-nordic-navy/35 p-4 backdrop-blur-sm">
              <div className="space-y-2 border-b border-celestial-border/40 pb-3">
                <p id="learning-logs-date-legend" className="text-xs font-medium text-celestial-textSub">
                  回答日時（answeredAt）
                </p>
                <p className="text-[11px] leading-snug text-celestial-textSub/90">
                  未指定の項目は条件に含めません。日付はローカルのカレンダー日の始端・終端で比較します。
                </p>
                <div
                  className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
                  role="group"
                  aria-labelledby="learning-logs-date-legend"
                >
                  <div>
                    <label htmlFor="learning-logs-date-start" className="mb-1.5 block text-xs font-medium text-celestial-textSub">
                      開始日
                    </label>
                    <input
                      id="learning-logs-date-start"
                      type="date"
                      value={dateStart}
                      onChange={(e) => setDateStart(e.target.value)}
                      className="rounded-md border border-celestial-border/60 bg-nordic-navy/50 px-3 py-2 text-sm text-celestial-textMain focus:outline-none focus-visible:ring-2 focus-visible:ring-celestial-gold/55"
                    />
                  </div>
                  <div>
                    <label htmlFor="learning-logs-date-end" className="mb-1.5 block text-xs font-medium text-celestial-textSub">
                      終了日
                    </label>
                    <input
                      id="learning-logs-date-end"
                      type="date"
                      value={dateEnd}
                      onChange={(e) => setDateEnd(e.target.value)}
                      className="rounded-md border border-celestial-border/60 bg-nordic-navy/50 px-3 py-2 text-sm text-celestial-textMain focus:outline-none focus-visible:ring-2 focus-visible:ring-celestial-gold/55"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={resetDateRangeOnly}
                    className="header-nav-button rounded-md border border-celestial-border/60 bg-transparent px-3 py-2 text-sm text-celestial-textMain hover:border-celestial-gold/50 hover:text-celestial-softGold focus:outline-none focus-visible:ring-2 focus-visible:ring-celestial-gold/55"
                  >
                    期間リセット
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end">
                <fieldset className="min-w-0 flex-1 border-0 p-0">
                  <legend className="mb-1.5 text-xs font-medium text-celestial-textSub">回答形式</legend>
                  <div className="flex flex-wrap gap-2" role="group" aria-label="回答形式で絞り込み">
                    {(
                      [
                        ["all", "すべて"],
                        ["multiple-choice", "四択"],
                        ["free-response", "入力式"]
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setQuestionTypeFilter(value)}
                        className={`rounded-md border px-3 py-1.5 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-celestial-gold/55 ${
                          questionTypeFilter === value
                            ? "border-celestial-gold/70 bg-celestial-gold/15 text-celestial-softGold"
                            : "border-celestial-border/60 bg-nordic-navy/20 text-celestial-textMain hover:border-celestial-gold/40"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <fieldset className="min-w-0 flex-1 border-0 p-0">
                  <legend className="mb-1.5 text-xs font-medium text-celestial-textSub">結果</legend>
                  <div className="flex flex-wrap gap-2" role="group" aria-label="結果で絞り込み">
                    {(
                      [
                        ["all", "すべて"],
                        ["correct", "正解"],
                        ["partial", "部分的に正解"],
                        ["incorrect", "不正解"]
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setResultFilter(value)}
                        className={`rounded-md border px-3 py-1.5 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-celestial-gold/55 ${
                          resultFilter === value
                            ? "border-celestial-gold/70 bg-celestial-gold/15 text-celestial-softGold"
                            : "border-celestial-border/60 bg-nordic-navy/20 text-celestial-textMain hover:border-celestial-gold/40"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <div className="min-w-[200px] flex-1">
                  <label htmlFor="learning-logs-concept-filter" className="mb-1.5 block text-xs font-medium text-celestial-textSub">
                    Concept
                  </label>
                  <select
                    id="learning-logs-concept-filter"
                    value={conceptFilter}
                    onChange={(e) => setConceptFilter(e.target.value)}
                    className="w-full rounded-md border border-celestial-border/60 bg-nordic-navy/50 px-3 py-2 text-sm text-celestial-textMain focus:outline-none focus-visible:ring-2 focus-visible:ring-celestial-gold/55"
                  >
                    <option value="">すべて</option>
                    {conceptOptions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title || "無題"}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="min-w-[200px] flex-[2]">
                  <label htmlFor="learning-logs-search" className="mb-1.5 block text-xs font-medium text-celestial-textSub">
                    検索（問題文・回答）
                  </label>
                  <input
                    id="learning-logs-search"
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="キーワード…"
                    className="w-full rounded-md border border-celestial-border/60 bg-nordic-navy/50 px-3 py-2 text-sm text-celestial-textMain placeholder:text-celestial-textSub/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-celestial-gold/55"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="header-nav-button rounded-md border border-celestial-border/60 bg-transparent px-3 py-2 text-sm text-celestial-textMain hover:border-celestial-gold/50 hover:text-celestial-softGold focus:outline-none focus-visible:ring-2 focus-visible:ring-celestial-gold/55"
                  >
                    リセット
                  </button>
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="rounded-md border border-rose-500/45 bg-rose-950/30 px-3 py-2 text-sm text-rose-200/95 hover:bg-rose-950/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/60"
                  >
                    全ログ削除…
                  </button>
                </div>
              </div>
            </div>
          </section>

          {filteredLogs.length === 0 ? (
            <p className="rounded-xl border border-celestial-border/50 bg-nordic-navy/30 px-4 py-5 text-center text-sm text-celestial-textSub">
              条件に一致するログがありません。フィルタをリセットするか、条件を変えてください。
            </p>
          ) : (
            <>
              <div className="space-y-3 md:hidden" aria-label="学習ログ一覧（カード表示）">
                {filteredLogs.map((log) => {
                  const view = presentQuizAttemptHistory(log);
                  return (
                    <article
                      key={log.id}
                      data-testid={`quiz-attempt-log-card-${log.id}`}
                      className="rounded-xl border border-celestial-border/70 bg-nordic-navy/40 p-4 backdrop-blur-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <time className="text-xs text-celestial-textSub" dateTime={log.answeredAt}>
                            {shortDateTime(log.answeredAt)}
                          </time>
                          <p className="mt-1 text-[11px] font-medium text-celestial-softGold">
                            {formatDeckSourceLabel(log)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleDeleteOne(log)}
                          className="shrink-0 rounded border border-rose-500/40 px-2 py-1 text-xs text-rose-200/95 hover:bg-rose-950/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/55"
                          aria-label={`${shortDateTime(log.answeredAt)} の学習ログを削除`}
                        >
                          削除
                        </button>
                      </div>
                      <p className="mt-2 line-clamp-3 text-sm text-celestial-textMain" title={questionTitleHint(log)}>
                        {log.questionPromptSnapshot}
                      </p>
                      <p className="mt-1 text-[11px] text-celestial-textSub">問題ID: {log.questionId}</p>
                      <dl className="mt-3 space-y-2 text-xs">
                        <div>
                          <dt className="text-celestial-textSub">回答形式</dt>
                          <dd className="mt-0.5">
                            <span className="inline-flex rounded-full border border-celestial-gold/40 bg-celestial-gold/10 px-2 py-0.5 text-[11px] text-celestial-softGold">
                              {view.formatLabel}
                            </span>
                          </dd>
                        </div>
                        <div>
                          <dt className="text-celestial-textSub">{view.answerLabel}</dt>
                          <dd className="mt-0.5 whitespace-pre-wrap text-celestial-textMain">{view.answerText}</dd>
                        </div>
                        <div>
                          <dt className="text-celestial-textSub">{view.referenceLabel}</dt>
                          <dd className="mt-0.5 whitespace-pre-wrap text-celestial-textMain">{view.referenceText}</dd>
                        </div>
                        <div>
                          <dt className="text-celestial-textSub">{view.resultHeading}</dt>
                          <dd className="mt-0.5">
                            <ResultMark kind={view.resultKind} label={view.resultLabel} />
                          </dd>
                        </div>
                        <div>
                          <dt className="text-celestial-textSub">反応時間</dt>
                          <dd className="mt-0.5 tabular-nums text-celestial-textMain">{renderReaction(log)}</dd>
                        </div>
                        <div>
                          <dt className="text-celestial-textSub">関連 Concept</dt>
                          <dd className="mt-0.5 text-celestial-textMain">{formatRelatedConceptSummary(log, titleById)}</dd>
                        </div>
                      </dl>
                    </article>
                  );
                })}
              </div>

              <div
                className="hidden overflow-x-auto scrollbar-none rounded-xl border border-celestial-border/70 bg-nordic-navy/35 backdrop-blur-sm md:block"
                aria-label="学習ログ一覧（表表示）"
              >
                <table className="w-full min-w-[1240px] border-collapse text-left text-sm">
                  <caption className="sr-only">学習ログ。回答日時の新しい順</caption>
                  <thead>
                    <tr className="border-b border-celestial-border/50 text-xs uppercase tracking-wide text-celestial-textSub">
                      <th scope="col" className="px-3 py-2 font-medium">
                        回答日時
                      </th>
                      <th scope="col" className="px-3 py-2 font-medium">
                        学習元
                      </th>
                      <th scope="col" className="px-3 py-2 font-medium">
                        回答形式
                      </th>
                      <th scope="col" className="px-3 py-2 font-medium">
                        問題文
                      </th>
                      <th scope="col" className="px-3 py-2 font-medium">
                        回答
                      </th>
                      <th scope="col" className="px-3 py-2 font-medium">
                        正答・模範解答
                      </th>
                      <th scope="col" className="px-3 py-2 font-medium">
                        結果
                      </th>
                      <th scope="col" className="px-3 py-2 font-medium">
                        反応時間
                      </th>
                      <th scope="col" className="px-3 py-2 font-medium">
                        関連 Concept
                      </th>
                      <th scope="col" className="px-3 py-2 font-medium">
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.map((log) => {
                      const view = presentQuizAttemptHistory(log);
                      return (
                        <tr key={log.id} data-testid={`quiz-attempt-log-row-${log.id}`} className="border-b border-celestial-border/30 last:border-0">
                          <td className="whitespace-nowrap px-3 py-2 text-celestial-textMain">
                            <time dateTime={log.answeredAt}>{shortDateTime(log.answeredAt)}</time>
                          </td>
                          <td className="max-w-[160px] px-3 py-2 text-celestial-textMain">
                            <span className="line-clamp-2 text-celestial-softGold" title={formatDeckSourceLabel(log)}>
                              {formatDeckSourceLabel(log)}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-celestial-textMain">
                            <span className="inline-flex rounded-full border border-celestial-gold/40 bg-celestial-gold/10 px-2 py-0.5 text-[11px] text-celestial-softGold">
                              {view.formatLabel}
                            </span>
                          </td>
                          <td className="max-w-xs px-3 py-2 text-celestial-textMain">
                            <span className="line-clamp-2" title={questionTitleHint(log)}>
                              {log.questionPromptSnapshot}
                            </span>
                            <p className="mt-1 text-[11px] text-celestial-textSub">ID: {log.questionId}</p>
                          </td>
                          <td className="max-w-[220px] px-3 py-2 text-celestial-textMain">
                            <span className="line-clamp-4 whitespace-pre-wrap" title={view.answerText}>
                              {view.answerText}
                            </span>
                          </td>
                          <td className="max-w-[220px] px-3 py-2 text-celestial-textMain">
                            <span className="line-clamp-4 whitespace-pre-wrap" title={view.referenceText}>
                              {view.referenceText}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <ResultMark kind={view.resultKind} label={view.resultLabel} />
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 tabular-nums text-celestial-textMain">
                            {renderReaction(log)}
                          </td>
                          <td className="max-w-[240px] px-3 py-2 text-celestial-textMain">
                            <span className="line-clamp-2" title={formatRelatedConceptSummary(log, titleById)}>
                              {formatRelatedConceptSummary(log, titleById)}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              onClick={() => void handleDeleteOne(log)}
                              className="rounded border border-rose-500/40 px-2 py-1 text-xs text-rose-200/95 hover:bg-rose-950/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/55"
                              aria-label={`${shortDateTime(log.answeredAt)} の学習ログを削除`}
                            >
                              削除
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};
