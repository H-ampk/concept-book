import { useCallback, useEffect, useMemo, useState } from "react";
import { getStorage } from "../storage";
import type { Concept } from "../types/concept";
import type { QuizDeck, QuizQuestion, QuizVisibility } from "../types/quiz";
import { shortDateTime } from "../utils/date";
import { OrnamentLine } from "./common/OrnamentLine";
import { QuizDeckFormModal } from "./QuizDeckFormModal";

const storage = getStorage();

type VisibilityFilter = "all" | QuizVisibility;

type Props = {
  onBack: () => void;
};

export const QuizBuilderPage = ({ onBack }: Props) => {
  const [decks, setDecks] = useState<QuizDeck[]>([]);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [loading, setLoading] = useState(true);
  const [deckKeyFilter, setDeckKeyFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>("all");
  const [deckModalOpen, setDeckModalOpen] = useState(false);
  const [editingDeck, setEditingDeck] = useState<QuizDeck | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [allDecks, allQuestions, allConcepts] = await Promise.all([
        storage.getQuizDecks(),
        storage.getQuizQuestions(),
        storage.getAllConcepts()
      ]);
      setDecks(allDecks);
      setQuestions(allQuestions);
      setConcepts(allConcepts);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredDecks = useMemo(() => {
    const keyQ = deckKeyFilter.trim().toLowerCase();
    const tagQ = tagFilter.trim().toLowerCase();
    return decks
      .filter((d) => {
        if (visibilityFilter !== "all" && d.visibility !== visibilityFilter) {
          return false;
        }
        if (keyQ) {
          const dk = d.deckKey?.toLowerCase() ?? "";
          if (!dk.includes(keyQ)) {
            return false;
          }
        }
        if (tagQ) {
          const tags = d.domainTags ?? [];
          if (!tags.some((t) => t.toLowerCase().includes(tagQ))) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [decks, deckKeyFilter, tagFilter, visibilityFilter]);

  const openCreateDeck = () => {
    setEditingDeck(null);
    setDeckModalOpen(true);
  };

  const openEditDeck = (d: QuizDeck) => {
    setEditingDeck(d);
    setDeckModalOpen(true);
  };

  const handleDeleteDeck = async (d: QuizDeck) => {
    if (
      !window.confirm(
        `クイズ集「${d.title}」を削除しますか？\n\n含まれる問題データ本体は削除されません（他のクイズ集からも参照可能なままです）。`
      )
    ) {
      return;
    }
    try {
      await storage.deleteQuizDeck(d.id);
      await load();
    } catch {
      window.alert("削除に失敗しました。");
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-1 sm:px-0">
      <section
        className="relative rounded-3xl border border-celestial-border bg-celestial-panel/90 p-5 shadow-celestial backdrop-blur-md decorated-card sm:p-6"
        aria-labelledby="quiz-builder-title"
      >
        <span className="card-corner card-corner-top-left" aria-hidden="true" />
        <span className="card-corner card-corner-top-right" aria-hidden="true" />
        <span className="card-corner card-corner-bottom-left" aria-hidden="true" />
        <span className="card-corner card-corner-bottom-right" aria-hidden="true" />

        <div className="relative z-[1] space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-celestial-gold/80">Lab · 実験室</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 id="quiz-builder-title" className="text-xl font-semibold tracking-wide text-celestial-textMain sm:text-2xl">
                クイズ作成
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-celestial-textSub">
                分野・テーマごとのクイズ集（QuizDeck）を中心に、セットの中へ問題を追加・並べ替えします。問題は独立データとして保存され、複数のクイズ集に同じ問題を入れられます。
              </p>
              <OrnamentLine variant="panel" />
            </div>
            <button
              type="button"
              onClick={onBack}
              className="header-nav-button shrink-0 rounded-md border border-celestial-gold/50 bg-transparent px-3 py-2 text-sm text-celestial-softGold hover:bg-celestial-gold/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-celestial-gold/55"
            >
              戻る（概念へ）
            </button>
          </div>

          <div className="flex flex-col gap-3 rounded-xl border border-celestial-border/70 bg-nordic-navy/30 p-4 backdrop-blur-sm sm:flex-row sm:flex-wrap sm:items-end">
            <button
              type="button"
              onClick={openCreateDeck}
              className="action-button order-first rounded-lg px-4 py-2.5 text-sm sm:order-none"
            >
              新規クイズ集を作成
            </button>

            <label className="block min-w-[160px] flex-1">
              <span className="mb-1 block text-xs text-celestial-softGold">識別ID（deckKey）で絞り込み</span>
              <input
                type="search"
                className="w-full rounded-md border border-celestial-border bg-celestial-deepBlue px-3 py-2 font-mono text-sm text-celestial-textMain placeholder:text-celestial-textSub focus:outline-none focus-visible:ring-2 focus-visible:ring-celestial-gold/45"
                value={deckKeyFilter}
                onChange={(e) => setDeckKeyFilter(e.target.value)}
                placeholder="部分一致…"
              />
            </label>

            <label className="block min-w-[160px] flex-1">
              <span className="mb-1 block text-xs text-celestial-softGold">タグ（部分一致）</span>
              <input
                type="search"
                className="w-full rounded-md border border-celestial-border bg-celestial-deepBlue px-3 py-2 text-sm text-celestial-textMain placeholder:text-celestial-textSub focus:outline-none focus-visible:ring-2 focus-visible:ring-celestial-gold/45"
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                placeholder="例: 社会心理"
              />
            </label>

            <label className="block min-w-[140px]">
              <span className="mb-1 block text-xs text-celestial-softGold">公開状態</span>
              <select
                className="w-full rounded-md border border-celestial-border bg-celestial-deepBlue px-3 py-2 text-sm text-celestial-textMain focus:outline-none focus-visible:ring-2 focus-visible:ring-celestial-gold/45"
                value={visibilityFilter}
                onChange={(e) => setVisibilityFilter(e.target.value as VisibilityFilter)}
              >
                <option value="all">すべて</option>
                <option value="private">非公開のみ</option>
                <option value="public">公開のみ</option>
              </select>
            </label>
          </div>

          {loading ? (
            <p className="text-sm text-celestial-textSub">読み込み中…</p>
          ) : filteredDecks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-celestial-border/80 bg-celestial-deepBlue/30 px-6 py-12 text-center">
              <p className="text-sm font-medium text-celestial-softGold">
                {decks.length === 0 ? "まだクイズ集がありません" : "条件に一致するクイズ集がありません"}
              </p>
              <p className="mt-2 text-sm text-celestial-textSub">
                テーマや試験単位でクイズ集を作り、その中に問題を追加していきます。
              </p>
              {decks.length === 0 ? (
                <button type="button" onClick={openCreateDeck} className="action-button mt-6 rounded-lg px-4 py-2 text-sm">
                  新規クイズ集を作成
                </button>
              ) : null}
            </div>
          ) : (
            <ul className="space-y-4">
              {filteredDecks.map((d) => (
                <li
                  key={d.id}
                  className="rounded-2xl border border-celestial-border bg-celestial-deepBlue/25 p-4 shadow-[inset_0_0_0_1px_rgba(77,255,154,0.06)] backdrop-blur-sm"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1 space-y-2">
                      <h2 className="text-base font-semibold text-celestial-textMain">{d.title}</h2>
                      {d.description ? (
                        <p className="text-sm leading-relaxed text-celestial-textSub line-clamp-2">{d.description}</p>
                      ) : null}
                      <div className="flex flex-wrap items-center gap-2">
                        {d.deckKey ? (
                          <code className="rounded-md border border-emerald-500/35 bg-emerald-950/40 px-2 py-0.5 font-mono text-[11px] text-emerald-200/95">
                            {d.deckKey}
                          </code>
                        ) : null}
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${
                            d.visibility === "public"
                              ? "border border-celestial-gold/50 bg-celestial-gold/10 text-celestial-gold"
                              : "border border-celestial-border text-celestial-textSub"
                          }`}
                        >
                          {d.visibility === "public" ? "公開" : "非公開"}
                        </span>
                        <span className="text-xs text-celestial-textSub">問題 {d.questionIds.length} 問</span>
                        <span className="text-xs text-celestial-textSub">更新 {shortDateTime(d.updatedAt)}</span>
                      </div>
                      {(d.domainTags?.length ?? 0) > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {d.domainTags!.map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full border border-celestial-border/60 bg-celestial-panel/60 px-2 py-0.5 text-[11px] text-celestial-softGold"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openEditDeck(d)}
                        className="rounded-lg border border-celestial-gold/40 px-3 py-1.5 text-xs text-celestial-softGold hover:bg-celestial-gold/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-celestial-gold/50"
                      >
                        編集
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteDeck(d)}
                        className="rounded-lg border border-celestial-border px-3 py-1.5 text-xs text-celestial-textSub hover:border-celestial-danger/50 hover:text-celestial-danger focus:outline-none focus-visible:ring-2 focus-visible:ring-celestial-danger/40"
                      >
                        削除
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <QuizDeckFormModal
        open={deckModalOpen}
        initialDeck={editingDeck}
        concepts={concepts}
        allQuestions={questions}
        onClose={() => {
          setDeckModalOpen(false);
          setEditingDeck(null);
        }}
        onReload={load}
      />
    </div>
  );
};
