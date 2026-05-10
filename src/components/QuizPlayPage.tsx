import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { getStorage } from "../storage";
import type { Concept } from "../types/concept";
import type { QuizAttemptLog, QuizChoice, QuizQuestion } from "../types/quiz";
import { QUIZ_ATTEMPT_LOG_SCHEMA_VERSION } from "../types/quiz";
import { OrnamentLine } from "./common/OrnamentLine";

const storage = getStorage();

const isPlayableQuestion = (q: QuizQuestion): boolean => {
  if (!q.prompt?.trim()) {
    return false;
  }
  const withText = q.choices.filter((c) => c.text.trim().length > 0);
  if (withText.length < 2) {
    return false;
  }
  if (!q.correctChoiceId || !q.choices.some((c) => c.id === q.correctChoiceId)) {
    return false;
  }
  const correct = q.choices.find((c) => c.id === q.correctChoiceId);
  if (!correct || !correct.text.trim()) {
    return false;
  }
  return true;
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

type Props = {
  onBack: () => void;
  onNavigateToConcept: (conceptId: string) => void;
  onGoToQuizBuilder: () => void;
};

export const QuizPlayPage = ({ onBack, onNavigateToConcept, onGoToQuizBuilder }: Props) => {
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [conceptFilter, setConceptFilter] = useState("");
  const [phase, setPhase] = useState<Phase>("setup");
  const [deck, setDeck] = useState<QuizQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const sessionIdRef = useRef<string | null>(null);
  const questionTimingRef = useRef<{ startedAtIso: string; startMs: number } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, q] = await Promise.all([storage.getAllConcepts(), storage.getQuizQuestions()]);
      setConcepts(c);
      setQuestions(q);
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

  const playableFiltered = useMemo(() => {
    return sortDeck(
      questions.filter(isPlayableQuestion).filter((q) => matchesConceptFilter(q, conceptFilter))
    );
  }, [questions, conceptFilter]);

  const current = deck[index];
  const selectedChoice = current?.choices.find((c) => c.id === selectedChoiceId) ?? null;
  const correctChoice = current?.choices.find((c) => c.id === current.correctChoiceId) ?? null;
  const isCorrect = answered && selectedChoiceId === current?.correctChoiceId;

  const visibleChoices = useMemo(
    () => (current ? current.choices.filter((c) => c.text.trim().length > 0) : []),
    [current]
  );

  useEffect(() => {
    if (phase !== "play" || !current) {
      questionTimingRef.current = null;
      return;
    }
    const ms = Date.now();
    questionTimingRef.current = {
      startedAtIso: new Date(ms).toISOString(),
      startMs: ms
    };
  }, [phase, index, current?.id]);

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

  const startPlay = () => {
    sessionIdRef.current = `session_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
    setDeck(playableFiltered);
    setIndex(0);
    setSelectedChoiceId(null);
    setAnswered(false);
    setCorrectCount(0);
    setPhase("play");
  };

  const submitAnswer = () => {
    if (!selectedChoiceId || !current) {
      return;
    }
    const sel = current.choices.find((c) => c.id === selectedChoiceId);
    const corr = current.choices.find((c) => c.id === current.correctChoiceId);
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

    const log: QuizAttemptLog = {
      id: `qlog_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`,
      questionId: current.id,
      questionPromptSnapshot: current.prompt,
      selectedChoiceId: sel.id,
      selectedChoiceTextSnapshot: sel.text,
      correctChoiceId: corr.id,
      correctChoiceTextSnapshot: corr.text,
      correct: sel.id === corr.id,
      startedAt: startedAtIso,
      answeredAt: answeredAtIso,
      timeMs,
      schemaVersion: QUIZ_ATTEMPT_LOG_SCHEMA_VERSION
    };
    if (sessionIdRef.current) {
      log.sessionId = sessionIdRef.current;
    }
    if (current.conceptId) {
      log.questionConceptId = current.conceptId;
    }
    if (sel.linkedConceptId) {
      log.selectedLinkedConceptId = sel.linkedConceptId;
    }
    if (corr.linkedConceptId) {
      log.correctLinkedConceptId = corr.linkedConceptId;
    }

    void storage.saveQuizAttemptLog(log).catch((err) => {
      console.warn("[QuizPlayPage] QuizAttemptLog の保存に失敗しました。", err);
    });

    setAnswered(true);
    if (selectedChoiceId === current.correctChoiceId) {
      setCorrectCount((n) => n + 1);
    }
  };

  const goNext = () => {
    if (!current) {
      return;
    }
    if (index + 1 >= deck.length) {
      setPhase("results");
      return;
    }
    setIndex((i) => i + 1);
    setSelectedChoiceId(null);
    setAnswered(false);
  };

  const restart = () => {
    sessionIdRef.current = null;
    setPhase("setup");
    setDeck([]);
    setIndex(0);
    setSelectedChoiceId(null);
    setAnswered(false);
    setCorrectCount(0);
  };

  const conceptLabel = (choice: QuizChoice | null): string | null => {
    if (!choice?.linkedConceptId) {
      return null;
    }
    return titleById.get(choice.linkedConceptId) ?? null;
  };

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
                作成した問いで概念理解を確認します。選択肢が Concept にリンクしている場合、回答後に関連を表示します。
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
            <div className="space-y-4 rounded-xl border border-celestial-border/70 bg-nordic-navy/30 p-4 backdrop-blur-sm">
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
                出題対象: <span className="font-semibold text-celestial-softGold">{playableFiltered.length}</span>{" "}
                問
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
                  学習を開始
                </button>
              )}
            </div>
          ) : phase === "results" ? (
            <div className="space-y-4 rounded-2xl border border-celestial-border bg-celestial-deepBlue/20 p-6 text-center">
              <p className="text-lg font-semibold text-celestial-textMain">結果</p>
              <p className="text-sm text-celestial-textSub">
                解いた問題: <span className="text-celestial-softGold">{deck.length}</span> 問 / 正解{" "}
                <span className="text-celestial-softGold">{correctCount}</span> 問
              </p>
              <p className="text-2xl font-semibold text-celestial-gold">
                {deck.length > 0 ? Math.round((correctCount / deck.length) * 100) : 0}%
              </p>
              <p className="text-xs text-celestial-textSub">正答率（画面内のみ・ログは保存されません）</p>
              <div className="flex flex-wrap justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={restart}
                  className="rounded-lg border border-celestial-gold/45 px-4 py-2 text-sm text-celestial-softGold hover:bg-celestial-gold/10"
                >
                  もう一度解く
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
          ) : current ? (
            <div className="space-y-4">
              <p className="text-xs text-celestial-textSub">
                問題 {index + 1} / {deck.length}
              </p>

              {current.conceptId ? (
                <p className="text-xs text-celestial-softGold">
                  問いの関連 Concept: {titleById.get(current.conceptId) ?? "（不明）"}
                </p>
              ) : null}

              <div
                className={`rounded-2xl border p-5 shadow-[inset_0_0_0_1px_rgba(77,255,154,0.08)] ${
                  answered
                    ? isCorrect
                      ? "border-celestial-gold/55 bg-[rgba(77,255,154,0.06)] shadow-[0_0_28px_rgba(77,255,154,0.12)]"
                      : "border-celestial-border bg-celestial-deepBlue/20"
                    : "border-celestial-border bg-celestial-deepBlue/25"
                }`}
              >
                <p className="text-base font-medium leading-relaxed text-celestial-textMain sm:text-lg">
                  {current.prompt}
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
                    const isCorr = c.id === current.correctChoiceId;
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
                        title={linkedTitle ? `Concept: ${linkedTitle}` : undefined}
                      >
                        <span
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] ${
                            isSel ? "border-celestial-gold bg-celestial-gold/20" : "border-celestial-border"
                          }`}
                          aria-hidden
                        >
                          {isSel ? "●" : ""}
                        </span>
                        <span className="min-w-0 flex-1 leading-relaxed">{c.text}</span>
                        {linkedTitle && !answered ? (
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
                    className={`text-sm font-semibold ${isCorrect ? "text-celestial-gold" : "text-celestial-danger"}`}
                    role="status"
                  >
                    {isCorrect ? "正解です" : "不正解です"}
                  </p>
                  <ul className="space-y-2 text-xs text-celestial-textSub sm:text-sm">
                    <li>
                      あなたの解答: <span className="text-celestial-textMain">{selectedChoice?.text ?? "—"}</span>
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
                  {current.explanation ? (
                    <div className="rounded-lg border border-celestial-border/50 bg-celestial-panel/40 p-3 text-sm leading-relaxed text-celestial-textMain">
                      <p className="mb-1 text-xs font-medium text-celestial-softGold">解説</p>
                      {current.explanation}
                    </div>
                  ) : null}
                  <button type="button" onClick={goNext} className="action-button rounded-lg px-5 py-2 text-sm">
                    {index + 1 >= deck.length ? "結果を見る" : "次の問題へ"}
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
