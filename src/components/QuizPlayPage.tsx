import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { getStorage } from "../storage";
import type { Concept } from "../types/concept";
import type { QuizAttemptLog, QuizChoice, QuizDeck, QuizQuestion } from "../types/quiz";
import { QUIZ_ATTEMPT_LOG_SCHEMA_VERSION } from "../types/quiz";
import {
  buildQuizSession,
  buildQuestionQuizStatsMap,
  getPlayablePoolFromDeck,
  isPlayableQuestion,
  type SessionQuestion,
  type WrongAnswerRecord
} from "../utils/quiz/buildQuizSession";
import { resolveQuestionConceptId } from "../utils/quiz/resolveQuestionConceptId";
import { QUIZ_SESSION_SIZE } from "../utils/quiz/shuffle";
import { shortDateTime } from "../utils/date";
import { getQuizChoiceDisplayText } from "../utils/quizChoiceDisplay";
import { OrnamentLine } from "./common/OrnamentLine";

const storage = getStorage();

const assetUrl = (path: string): string =>
  `${import.meta.env.BASE_URL}${path.replace(/^\/+/, "")}`;

const QUIZ_RESULT_IMAGE = {
  correct: { src: assetUrl("decorations/inu.png"), alt: "正解時の犬イラスト" },
  wrong: { src: assetUrl("decorations/tanuki.png"), alt: "不正解時の狸イラスト" }
} as const;

const resolveResultExplanationText = (
  question: QuizQuestion,
  correctChoice: QuizChoice | null | undefined,
  isCorrectAnswer: boolean
): string => {
  const fromQuestion = question.explanation?.trim();
  if (fromQuestion) {
    return fromQuestion;
  }
  if (isCorrectAnswer) {
    return correctChoice?.text?.trim() ?? "";
  }
  return "";
};

const matchesConceptFilter = (q: QuizQuestion, conceptId: string): boolean => {
  if (!conceptId) {
    return true;
  }
  if (q.conceptId === conceptId) {
    return true;
  }
  return q.choices.some((c) => c.linkedConceptId === conceptId);
};

const sortDeck = (items: QuizQuestion[]): QuizQuestion[] =>
  [...items].sort((a, b) => {
    const oa = a.sortOrder ?? 0;
    const ob = b.sortOrder ?? 0;
    if (oa !== ob) {
      return oa - ob;
    }
    return b.updatedAt.localeCompare(a.updatedAt);
  });

type Phase = "setup" | "play" | "results";
type PlayAgainMode = "all" | "remaining";

type Props = {
  onBack: () => void;
  onNavigateToConcept: (conceptId: string) => void;
  onGoToQuizBuilder: () => void;
};

export const QuizPlayPage = ({ onBack, onNavigateToConcept, onGoToQuizBuilder }: Props) => {
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [quizDecks, setQuizDecks] = useState<QuizDeck[]>([]);
  const [attemptLogs, setAttemptLogs] = useState<QuizAttemptLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [conceptFilter, setConceptFilter] = useState("");
  const [phase, setPhase] = useState<Phase>("setup");
  const [session, setSession] = useState<SessionQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongAnswers, setWrongAnswers] = useState<WrongAnswerRecord[]>([]);
  /** クイズ集モードのときセット。自由学習では null */
  const [sessionDeckId, setSessionDeckId] = useState<string | null>(null);
  const [sessionDeckTitle, setSessionDeckTitle] = useState<string | null>(null);
  const [deckPlayError, setDeckPlayError] = useState<string | null>(null);
  /** 同一クイズ集内で直前セッションに出題した問題 ID */
  const [lastSessionQuestionIds, setLastSessionQuestionIds] = useState<string[]>([]);
  /** クイズ集の全問題プール（再出題用） */
  const sessionPoolRef = useRef<QuizQuestion[]>([]);
  const sessionIdRef = useRef<string | null>(null);
  const questionTimingRef = useRef<{ startedAtIso: string; startMs: number } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, q, d, logs] = await Promise.all([
        storage.getAllConcepts(),
        storage.getQuizQuestions(),
        storage.getQuizDecks(),
        storage.getQuizAttemptLogs()
      ]);
      setConcepts(c);
      setQuestions(q);
      setQuizDecks(d);
      setAttemptLogs(logs);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const conceptById = useMemo(
    () => new Map(concepts.map((concept) => [concept.id, concept])),
    [concepts]
  );

  const titleById = useMemo(() => {
    const m = new Map<string, string>();
    concepts.forEach((c) => m.set(c.id, c.title || "無題"));
    return m;
  }, [concepts]);

  const questionStatsMap = useMemo(
    () => buildQuestionQuizStatsMap(attemptLogs),
    [attemptLogs]
  );

  const buildSessionItems = useCallback(
    (pool: QuizQuestion[], excludeQuestionIds?: Set<string>) =>
      buildQuizSession(pool, {
        excludeQuestionIds,
        questionStatsMap
      }),
    [questionStatsMap]
  );

  const playableFiltered = useMemo(() => {
    return sortDeck(
      questions.filter(isPlayableQuestion).filter((q) => matchesConceptFilter(q, conceptFilter))
    );
  }, [questions, conceptFilter]);

  const current = session[index];
  const currentQuestion = current?.question;
  const selectedChoice = current?.shuffledChoices.find((c) => c.id === selectedChoiceId) ?? null;
  const correctChoice =
    current?.shuffledChoices.find((c) => c.id === currentQuestion?.correctChoiceId) ?? null;
  const isCorrect = answered && selectedChoiceId === currentQuestion?.correctChoiceId;

  const visibleChoices = current?.shuffledChoices ?? [];

  const promptConcept = currentQuestion?.conceptId
    ? conceptById.get(currentQuestion.conceptId)
    : undefined;

  useEffect(() => {
    if (phase !== "play" || !currentQuestion) {
      questionTimingRef.current = null;
      return;
    }
    const ms = Date.now();
    questionTimingRef.current = {
      startedAtIso: new Date(ms).toISOString(),
      startMs: ms
    };
  }, [phase, index, currentQuestion?.id]);

  const onChoicesKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (answered || visibleChoices.length === 0) {
      return;
    }
    const i = visibleChoices.findIndex((c) => c.id === selectedChoiceId);
    const cur = i < 0 ? 0 : i;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      const next = visibleChoices[Math.min(cur + 1, visibleChoices.length - 1)];
      setSelectedChoiceId(next.id);
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      const next = visibleChoices[Math.max(cur - 1, 0)];
      setSelectedChoiceId(next.id);
    }
  };

  const beginSession = (items: SessionQuestion[]) => {
    sessionIdRef.current = `session_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
    setSession(items);
    setLastSessionQuestionIds(items.map((s) => s.question.id));
    setIndex(0);
    setSelectedChoiceId(null);
    setAnswered(false);
    setCorrectCount(0);
    setWrongAnswers([]);
    setPhase("play");
  };

  const startPlay = () => {
    setSessionDeckId(null);
    setSessionDeckTitle(null);
    sessionPoolRef.current = playableFiltered;
    beginSession(buildSessionItems(playableFiltered));
  };

  const startPlayFromQuizDeck = (
    d: QuizDeck,
    opts?: { emptyToSetup?: boolean; playAgainMode?: PlayAgainMode }
  ) => {
    setDeckPlayError(null);
    const pool = getPlayablePoolFromDeck(d, questions);
    if (pool.length === 0) {
      const msg = `「${d.title}」には出題可能な問題がありません。問題が未登録・未完成の参照のみの可能性があります。クイズ作成で整えてください。`;
      if (opts?.emptyToSetup) {
        window.alert(msg);
        restart();
      } else {
        setDeckPlayError(msg);
      }
      return;
    }

    sessionPoolRef.current = pool;
    const excludeIds =
      opts?.playAgainMode === "remaining"
        ? new Set(lastSessionQuestionIds)
        : new Set<string>();
    const items = buildSessionItems(pool, excludeIds);

    if (items.length === 0 && opts?.playAgainMode === "remaining") {
      window.alert("残りの未出題問題がありません。全体からランダムに出題します。");
      setSessionDeckId(d.id);
      setSessionDeckTitle(d.title);
      beginSession(buildSessionItems(pool));
      return;
    }

    setSessionDeckId(d.id);
    setSessionDeckTitle(d.title);
    beginSession(items);
  };

  const playAgain = async (mode: PlayAgainMode = "all") => {
    const freshLogs = await storage.getQuizAttemptLogs();
    setAttemptLogs(freshLogs);
    const freshStatsMap = buildQuestionQuizStatsMap(freshLogs);
    const buildWithFreshStats = (pool: QuizQuestion[], excludeQuestionIds?: Set<string>) =>
      buildQuizSession(pool, {
        excludeQuestionIds,
        questionStatsMap: freshStatsMap
      });

    if (sessionDeckId) {
      let d: QuizDeck | undefined = quizDecks.find((x) => x.id === sessionDeckId);
      if (!d) {
        d = (await storage.getQuizDeck(sessionDeckId)) ?? undefined;
      }
      if (d) {
        const pool = getPlayablePoolFromDeck(d, questions);
        sessionPoolRef.current = pool;
        const excludeIds =
          mode === "remaining" ? new Set(lastSessionQuestionIds) : new Set<string>();
        const items = buildWithFreshStats(pool, excludeIds);
        if (items.length === 0 && mode === "remaining") {
          window.alert("残りの未出題問題がありません。全体からランダムに出題します。");
          beginSession(buildWithFreshStats(pool));
          return;
        }
        beginSession(items);
        return;
      }
      window.alert("クイズ集が見つかりません。");
      restart();
      return;
    }

    if (mode === "remaining") {
      const exclude = new Set(lastSessionQuestionIds);
      const remaining = sessionPoolRef.current.filter((q) => !exclude.has(q.id));
      if (remaining.length === 0) {
        window.alert("残りの未出題問題がありません。全体からランダムに出題します。");
        beginSession(buildWithFreshStats(sessionPoolRef.current));
        return;
      }
      beginSession(buildWithFreshStats(remaining));
      return;
    }

    beginSession(buildWithFreshStats(sessionPoolRef.current.length > 0 ? sessionPoolRef.current : playableFiltered));
  };

  const submitAnswer = () => {
    if (!selectedChoiceId || !currentQuestion || !current) {
      return;
    }
    const sel = current.shuffledChoices.find((c) => c.id === selectedChoiceId);
    const corr = current.shuffledChoices.find((c) => c.id === currentQuestion.correctChoiceId);
    if (!sel || !corr) {
      return;
    }

    const endMs = Date.now();
    const timing = questionTimingRef.current;
    const answeredAtIso = new Date(endMs).toISOString();
    const startedAtIso = timing?.startedAtIso ?? answeredAtIso;
    let timeMs = timing ? endMs - timing.startMs : 0;
    if (!Number.isFinite(timeMs) || timeMs < 0) {
      timeMs = 0;
    }

    const isAnswerCorrect = sel.id === corr.id;

    const log: QuizAttemptLog = {
      id: `qlog_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`,
      questionId: currentQuestion.id,
      questionPromptSnapshot: currentQuestion.prompt,
      selectedChoiceId: sel.id,
      selectedChoiceTextSnapshot: sel.text,
      correctChoiceId: corr.id,
      correctChoiceTextSnapshot: corr.text,
      correct: isAnswerCorrect,
      startedAt: startedAtIso,
      answeredAt: answeredAtIso,
      timeMs,
      schemaVersion: QUIZ_ATTEMPT_LOG_SCHEMA_VERSION
    };
    if (sessionIdRef.current) {
      log.sessionId = sessionIdRef.current;
    }
    const promptConceptId = resolveQuestionConceptId(currentQuestion);
    if (promptConceptId) {
      log.conceptId = promptConceptId;
      log.questionConceptId = promptConceptId;
    }
    if (sel.linkedConceptId) {
      log.selectedLinkedConceptId = sel.linkedConceptId;
    }
    if (corr.linkedConceptId) {
      log.correctLinkedConceptId = corr.linkedConceptId;
    }
    if (sessionDeckId) {
      log.deckId = sessionDeckId;
      const snap = sessionDeckTitle?.trim();
      if (snap) {
        log.deckTitleSnapshot = snap;
      }
    }

    void storage.saveQuizAttemptLog(log).catch((err) => {
      console.warn("[QuizPlayPage] QuizAttemptLog の保存に失敗しました。", err);
    });
    setAttemptLogs((prev) => [...prev, log]);

    setAnswered(true);
    if (isAnswerCorrect) {
      setCorrectCount((n) => n + 1);
    } else {
      setWrongAnswers((prev) => [
        ...prev,
        {
          question: currentQuestion,
          selectedChoiceId: sel.id,
          selectedText: sel.text,
          correctText: corr.text,
          selectionReasons: current.selectionReasons
        }
      ]);
    }
  };

  const goNext = () => {
    if (!currentQuestion) {
      return;
    }
    if (index + 1 >= session.length) {
      setPhase("results");
      return;
    }
    setIndex((i) => i + 1);
    setSelectedChoiceId(null);
    setAnswered(false);
  };

  const restart = () => {
    sessionIdRef.current = null;
    setSessionDeckId(null);
    setSessionDeckTitle(null);
    setDeckPlayError(null);
    setLastSessionQuestionIds([]);
    sessionPoolRef.current = [];
    setPhase("setup");
    setSession([]);
    setIndex(0);
    setSelectedChoiceId(null);
    setAnswered(false);
    setCorrectCount(0);
    setWrongAnswers([]);
  };

  const conceptLabel = (choice: QuizChoice | null): string | null => {
    if (!choice?.linkedConceptId) {
      return null;
    }
    return titleById.get(choice.linkedConceptId) ?? null;
  };

  const remainingPoolCount = useMemo(() => {
    if (sessionPoolRef.current.length === 0) {
      return 0;
    }
    const exclude = new Set(lastSessionQuestionIds);
    return sessionPoolRef.current.filter((q) => !exclude.has(q.id)).length;
  }, [lastSessionQuestionIds, phase]);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-1 sm:px-0">
      <section
        className="relative rounded-3xl border border-celestial-border bg-celestial-panel/90 p-5 shadow-celestial backdrop-blur-md decorated-card sm:p-6"
        aria-labelledby="quiz-play-title"
      >
        <span className="card-corner card-corner-top-left" aria-hidden="true" />
        <span className="card-corner card-corner-top-right" aria-hidden="true" />
        <span className="card-corner card-corner-bottom-left" aria-hidden="true" />
        <span className="card-corner card-corner-bottom-right" aria-hidden="true" />

        <div className="relative z-[1] space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-celestial-gold/80">Lab · 演習場</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 id="quiz-play-title" className="text-xl font-semibold tracking-wide text-celestial-textMain sm:text-2xl">
                クイズで学習
              </h1>
              <p className="mt-1 text-sm text-celestial-textSub">
                問題プールから学習状況に応じて最大 {QUIZ_SESSION_SIZE}{" "}
                問を出題します（未学習・誤答・復習対象を優先）。選択肢が Concept にリンクしている場合、回答後に関連を表示します。
              </p>
              <OrnamentLine variant="panel" />
            </div>
            <button
              type="button"
              onClick={onBack}
              className="header-nav-button shrink-0 rounded-md border border-celestial-gold/50 bg-transparent px-3 py-2 text-sm text-celestial-softGold hover:bg-celestial-gold/10"
            >
              戻る（概念へ）
            </button>
          </div>

          {loading ? (
            <p className="text-sm text-celestial-textSub">読み込み中…</p>
          ) : phase === "setup" ? (
            <div className="space-y-8">
              <div className="space-y-3 rounded-xl border border-celestial-border/70 bg-nordic-navy/30 p-4 backdrop-blur-sm">
                <h2 className="text-sm font-semibold text-celestial-softGold">クイズ集から始める</h2>
                <p className="text-xs text-celestial-textSub">
                  クイズ集の問題プールから、学習状況に応じて最大 {QUIZ_SESSION_SIZE} 問を出題します。
                </p>
                {deckPlayError ? (
                  <p className="rounded-lg border border-amber-500/40 bg-amber-950/25 px-3 py-2 text-sm text-amber-100/95" role="alert">
                    {deckPlayError}
                  </p>
                ) : null}
                {quizDecks.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-celestial-border/80 bg-celestial-deepBlue/25 px-4 py-8 text-center">
                    <p className="text-sm text-celestial-softGold">まだクイズ集がありません</p>
                    <p className="mt-2 text-xs text-celestial-textSub">クイズ作成でクイズ集と問題を追加してください。</p>
                    <button
                      type="button"
                      onClick={onGoToQuizBuilder}
                      className="action-button mt-4 rounded-lg px-4 py-2 text-sm"
                    >
                      クイズ作成へ
                    </button>
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {quizDecks.map((qd) => {
                      const pool = getPlayablePoolFromDeck(qd, questions);
                      const totalIds = qd.questionIds.length;
                      const canStart = pool.length > 0;
                      const sessionCount = Math.min(QUIZ_SESSION_SIZE, pool.length);
                      return (
                        <li
                          key={qd.id}
                          className="rounded-2xl border border-celestial-border bg-celestial-deepBlue/25 p-4 shadow-[inset_0_0_0_1px_rgba(117,165,188,0.12)]"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0 flex-1 space-y-2">
                              <h3 className="text-base font-semibold text-celestial-textMain">{qd.title}</h3>
                              {qd.description ? (
                                <p className="text-xs leading-relaxed text-celestial-textSub line-clamp-2">{qd.description}</p>
                              ) : null}
                              <div className="flex flex-wrap items-center gap-2">
                                {qd.deckKey ? (
                                  <code className="rounded-md border border-celestial-border bg-celestial-deepBlue px-2 py-0.5 font-mono text-[11px] text-celestial-textMain">
                                    {qd.deckKey}
                                  </code>
                                ) : null}
                                <span
                                  className={`rounded-[10px] px-2 py-0.5 text-xs ${
                                    qd.visibility === "public"
                                      ? "border border-celestial-gold/50 bg-celestial-gold/10 text-celestial-gold"
                                      : "border border-celestial-border text-celestial-textSub"
                                  }`}
                                >
                                  {qd.visibility === "public" ? "公開" : "非公開"}
                                </span>
                                <span className="text-xs text-celestial-textSub">
                                  プール <span className="font-medium text-celestial-softGold">{pool.length}</span> 問
                                  {totalIds !== pool.length ? (
                                    <span className="text-celestial-textSub"> / questionIds {totalIds}</span>
                                  ) : null}
                                </span>
                                <span className="text-xs text-celestial-textSub">
                                  1回 {sessionCount} 問
                                </span>
                                <span className="text-xs text-celestial-textSub">更新 {shortDateTime(qd.updatedAt)}</span>
                              </div>
                              {(qd.domainTags?.length ?? 0) > 0 ? (
                                <div className="flex flex-wrap gap-1.5">
                                  {qd.domainTags!.map((tag) => (
                                    <span
                                      key={tag}
                                      className="rounded-[10px] border border-celestial-border/60 bg-celestial-panel/60 px-2 py-0.5 text-[11px] text-celestial-softGold"
                                    >
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                            <button
                              type="button"
                              disabled={!canStart}
                              onClick={() => startPlayFromQuizDeck(qd)}
                              className="action-button shrink-0 rounded-lg px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-45"
                              aria-label={`クイズ集「${qd.title}」で学習を開始`}
                            >
                              このクイズ集で学習
                            </button>
                          </div>
                          {!canStart ? (
                            <p className="mt-2 text-xs text-amber-200/90">このクイズ集には出題可能な問題がありません。</p>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="space-y-4 rounded-xl border border-celestial-border/60 bg-nordic-navy/20 p-4 backdrop-blur-sm">
                <h2 className="text-sm font-semibold text-celestial-softGold">自由に学習する</h2>
                <p className="text-xs text-celestial-textSub">
                  全問題から Concept で絞り込み、学習状況に応じて最大 {QUIZ_SESSION_SIZE} 問出題します。
                </p>
                <label className="block max-w-md">
                  <span className="mb-1 block text-xs text-celestial-softGold">Concept で絞り込み</span>
                  <select
                    className="w-full rounded-md border border-celestial-border bg-celestial-deepBlue px-3 py-2 text-sm text-celestial-textMain focus:outline-none focus-visible:ring-2 focus-visible:ring-celestial-gold/45"
                    value={conceptFilter}
                    onChange={(e) => setConceptFilter(e.target.value)}
                  >
                    <option value="">すべて</option>
                    {concepts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title || "無題"}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="text-sm text-celestial-textMain">
                  出題プール: <span className="font-semibold text-celestial-softGold">{playableFiltered.length}</span>{" "}
                  問（1回{" "}
                  <span className="font-semibold text-celestial-softGold">
                    {Math.min(QUIZ_SESSION_SIZE, playableFiltered.length)}
                  </span>{" "}
                  問）
                </p>
                {playableFiltered.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-celestial-border/80 bg-celestial-deepBlue/25 px-4 py-8 text-center">
                    <p className="text-sm text-celestial-softGold">出題できるクイズがありません</p>
                    <p className="mt-2 text-xs text-celestial-textSub">
                      クイズ作成で問題を追加するか、別の Concept で絞り込んでください。
                    </p>
                    <button
                      type="button"
                      onClick={onGoToQuizBuilder}
                      className="action-button mt-4 rounded-lg px-4 py-2 text-sm"
                    >
                      クイズ作成へ
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={startPlay} className="action-button rounded-lg px-5 py-2.5 text-sm">
                    学習を開始（自由モード）
                  </button>
                )}
              </div>
            </div>
          ) : phase === "results" ? (
            <div className="space-y-4 rounded-2xl border border-celestial-border bg-celestial-deepBlue/20 p-6">
              <p className="text-center text-lg font-semibold text-celestial-textMain">結果</p>
              {sessionDeckTitle ? (
                <p className="text-center text-sm text-celestial-softGold">
                  クイズ集「<span className="font-medium">{sessionDeckTitle}</span>」
                </p>
              ) : null}
              <p className="text-center text-sm text-celestial-textSub">
                解いた問題: <span className="text-celestial-softGold">{session.length}</span> 問 / 正解{" "}
                <span className="text-celestial-softGold">{correctCount}</span> 問
              </p>
              <p className="text-center text-2xl font-semibold text-celestial-gold">
                {session.length > 0 ? Math.round((correctCount / session.length) * 100) : 0}%
              </p>
              <p className="text-center text-xs text-celestial-textSub">正答率（学習ログに記録されます）</p>

              {wrongAnswers.length > 0 ? (
                <div className="rounded-xl border border-celestial-border/60 bg-celestial-panel/40 p-4 text-left">
                  <h3 className="mb-2 text-sm font-semibold text-celestial-softGold">
                    間違えた問題（{wrongAnswers.length} 問）
                  </h3>
                  <ul className="max-h-48 space-y-3 overflow-y-auto text-sm">
                    {wrongAnswers.map((wa) => (
                      <li
                        key={wa.question.id}
                        className="rounded-lg border border-celestial-border/50 bg-celestial-deepBlue/30 p-3"
                      >
                        <p className="font-medium text-celestial-textMain line-clamp-2">{wa.question.prompt}</p>
                        {(wa.selectionReasons?.length ?? 0) > 0 ? (
                          <p className="mt-1 text-[11px] text-celestial-textSub/70">
                            出題理由: {wa.selectionReasons!.join("・")}
                          </p>
                        ) : null}
                        <p className="mt-1 text-xs text-celestial-textSub">
                          あなたの解答: <span className="text-celestial-danger">{wa.selectedText}</span>
                        </p>
                        <p className="text-xs text-celestial-textSub">
                          正解: <span className="text-celestial-gold">{wa.correctText}</span>
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="flex flex-col items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => void playAgain("all")}
                  className="action-button rounded-lg px-5 py-2.5 text-sm"
                >
                  もう {Math.min(QUIZ_SESSION_SIZE, sessionPoolRef.current.length || session.length)} 問解く（学習状況を反映）
                </button>
                {remainingPoolCount > 0 ? (
                  <button
                    type="button"
                    onClick={() => void playAgain("remaining")}
                    className="rounded-lg border border-celestial-gold/45 px-4 py-2 text-sm text-celestial-softGold hover:bg-celestial-gold/10"
                  >
                    残り {Math.min(QUIZ_SESSION_SIZE, remainingPoolCount)} 問解く（未出題から）
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={restart}
                  className="rounded-lg border border-celestial-border px-4 py-2 text-sm text-celestial-textSub hover:bg-celestial-gold/10"
                >
                  クイズ選択に戻る
                </button>
                <button
                  type="button"
                  onClick={onGoToQuizBuilder}
                  className="rounded-lg border border-celestial-border px-4 py-2 text-sm text-celestial-textSub hover:bg-celestial-gold/10"
                >
                  クイズ作成へ
                </button>
              </div>
            </div>
          ) : currentQuestion ? (
            <div className="space-y-4">
              {sessionDeckTitle ? (
                <p className="text-sm font-medium text-celestial-softGold">
                  クイズ集「{sessionDeckTitle}」
                </p>
              ) : null}
              <p className="text-xs text-celestial-textSub">
                問題 {index + 1} / {session.length}
                {sessionDeckTitle ? (
                  <span className="sr-only">
                    。クイズ集「{sessionDeckTitle}」の {session.length} 問中 {index + 1} 問目です。
                  </span>
                ) : null}
              </p>

              {currentQuestion.conceptId ? (
                <p className="text-xs text-celestial-softGold">
                  問いの関連 Concept: {titleById.get(currentQuestion.conceptId) ?? "（不明）"}
                </p>
              ) : null}

              {(current?.selectionReasons.length ?? 0) > 0 ? (
                <p className="text-[11px] leading-relaxed text-celestial-textSub/70">
                  出題理由: {current!.selectionReasons.join("・")}
                </p>
              ) : null}

              <div
                className={`rounded-2xl border p-5 shadow-[inset_0_0_0_1px_rgba(117,165,188,0.12)] ${
                  answered
                    ? isCorrect
                      ? "border-celestial-gold/55 bg-[rgba(117,165,188,0.08)] shadow-[0_0_28px_rgba(117,165,188,0.14)]"
                      : "border-celestial-border bg-celestial-deepBlue/20"
                    : "border-celestial-border bg-celestial-deepBlue/25"
                }`}
              >
                <p className="text-base font-medium leading-relaxed text-celestial-textMain sm:text-lg">
                  {currentQuestion.prompt}
                </p>
              </div>

              <div
                className="space-y-2 outline-none"
                role="radiogroup"
                aria-label="選択肢"
                tabIndex={answered ? -1 : 0}
                onKeyDown={onChoicesKeyDown}
              >
                {visibleChoices.map((c) => {
                    const linkedTitle = c.linkedConceptId ? titleById.get(c.linkedConceptId) : undefined;
                    const isSel = selectedChoiceId === c.id;
                    const isCorr = c.id === currentQuestion.correctChoiceId;
                    let borderCls = "border-celestial-border/80 hover:border-celestial-gold/35";
                    if (answered) {
                      if (isCorr) {
                        borderCls = "border-celestial-gold/60 bg-celestial-gold/10";
                      } else if (isSel && !isCorr) {
                        borderCls = "border-celestial-danger/45 bg-celestial-danger/5";
                      } else {
                        borderCls = "border-celestial-border/50 opacity-70";
                      }
                    } else if (isSel) {
                      borderCls = "border-celestial-gold ring-2 ring-celestial-gold/35";
                    }
                    return (
                      <button
                        key={c.id}
                        type="button"
                        role="radio"
                        aria-checked={isSel}
                        disabled={answered}
                        onClick={() => !answered && setSelectedChoiceId(c.id)}
                        className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm text-celestial-textMain transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-celestial-gold/50 disabled:cursor-default ${borderCls}`}
                        title={answered && linkedTitle ? `Concept: ${linkedTitle}` : undefined}
                      >
                        <span
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] ${
                            isSel ? "border-celestial-gold bg-celestial-gold/20" : "border-celestial-border"
                          }`}
                          aria-hidden
                        >
                          {isSel ? "●" : ""}
                        </span>
                        <span className="min-w-0 flex-1 leading-relaxed">
                          {getQuizChoiceDisplayText({
                            choice: c,
                            promptConcept,
                            allConcepts: concepts,
                            revealAnswer: answered
                          })}
                        </span>
                        {linkedTitle && answered ? (
                          <span className="shrink-0 text-[10px] text-celestial-textSub" title={linkedTitle}>
                            ◈
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
              </div>

              {!answered ? (
                <button
                  type="button"
                  onClick={submitAnswer}
                  disabled={!selectedChoiceId}
                  className="action-button rounded-lg px-5 py-2.5 text-sm disabled:opacity-50"
                >
                  回答する
                </button>
              ) : (
                <div className="space-y-4 rounded-2xl border border-celestial-border/60 bg-nordic-navy/35 p-4 backdrop-blur-sm">
                  <p
                    className={`text-center text-sm font-semibold ${isCorrect ? "text-celestial-gold" : "text-celestial-danger"}`}
                    role="status"
                  >
                    {isCorrect ? "正解" : "不正解"}
                  </p>
                  <div className="quiz-result-illustration">
                    <img
                      src={isCorrect ? QUIZ_RESULT_IMAGE.correct.src : QUIZ_RESULT_IMAGE.wrong.src}
                      alt={isCorrect ? QUIZ_RESULT_IMAGE.correct.alt : QUIZ_RESULT_IMAGE.wrong.alt}
                      onError={() => {
                        console.warn(
                          "Quiz result image failed to load:",
                          isCorrect ? QUIZ_RESULT_IMAGE.correct.src : QUIZ_RESULT_IMAGE.wrong.src
                        );
                      }}
                    />
                  </div>
                  {!isCorrect ? (
                    <ul className="space-y-2 text-xs text-celestial-textSub sm:text-sm">
                      <li>
                        あなたの解答:{" "}
                        <span className="text-celestial-textMain">{selectedChoice?.text ?? "—"}</span>
                        {selectedChoice?.linkedConceptId ? (
                          <span className="ml-2">
                            {conceptLabel(selectedChoice) ? (
                              <button
                                type="button"
                                onClick={() => onNavigateToConcept(selectedChoice.linkedConceptId!)}
                                className="rounded border border-celestial-gold/40 px-2 py-0.5 text-celestial-softGold hover:bg-celestial-gold/10"
                              >
                                Concept: {conceptLabel(selectedChoice)}
                              </button>
                            ) : (
                              <span className="text-celestial-textSub">（リンク先 Concept なし）</span>
                            )}
                          </span>
                        ) : null}
                      </li>
                      <li>
                        正解: <span className="text-celestial-textMain">{correctChoice?.text ?? "—"}</span>
                        {correctChoice?.linkedConceptId ? (
                          <span className="ml-2">
                            {conceptLabel(correctChoice) ? (
                              <button
                                type="button"
                                onClick={() => onNavigateToConcept(correctChoice.linkedConceptId!)}
                                className="rounded border border-celestial-gold/40 px-2 py-0.5 text-celestial-softGold hover:bg-celestial-gold/10"
                              >
                                Concept: {conceptLabel(correctChoice)}
                              </button>
                            ) : (
                              <span className="text-celestial-textSub">（リンク先 Concept なし）</span>
                            )}
                          </span>
                        ) : null}
                      </li>
                    </ul>
                  ) : null}
                  {(() => {
                    const explanationText = resolveResultExplanationText(
                      currentQuestion,
                      correctChoice,
                      Boolean(isCorrect)
                    );
                    if (!explanationText) {
                      return null;
                    }
                    return (
                      <div className="quiz-result-explanation rounded-lg border border-celestial-border/50 bg-celestial-panel/40 p-3 text-sm leading-relaxed text-celestial-textMain">
                        <p className="mb-1 text-xs font-medium text-celestial-softGold">解説</p>
                        <p>{explanationText}</p>
                      </div>
                    );
                  })()}
                  <button type="button" onClick={goNext} className="action-button rounded-lg px-5 py-2 text-sm">
                    {index + 1 >= session.length ? "結果を見る" : "次の問題へ"}
                  </button>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
};
