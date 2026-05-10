import { useCallback, useEffect, useMemo, useState } from "react";
import { getStorage } from "../storage";
import type { Concept } from "../types/concept";
import type { QuizQuestion, QuizVisibility } from "../types/quiz";
import { shortDateTime } from "../utils/date";
import { OrnamentLine } from "./common/OrnamentLine";
import { QuizQuestionFormModal } from "./QuizQuestionFormModal";

const storage = getStorage();

type VisibilityFilter = "all" | QuizVisibility;

type Props = {
  onBack: () => void;
};

export const QuizBuilderPage = ({ onBack }: Props) => {
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [conceptFilter, setConceptFilter] = useState<string>("");
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingQuestion, setEditingQuestion] = useState<QuizQuestion | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [allConcepts, allQuestions] = await Promise.all([
        storage.getAllConcepts(),
        storage.getQuizQuestions()
      ]);
      setConcepts(allConcepts);
      setQuestions(allQuestions);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const conceptTitleById = useMemo(() => {
    const m = new Map<string, string>();
    concepts.forEach((c) => m.set(c.id, c.title || "無題"));
    return m;
  }, [concepts]);

  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      if (conceptFilter) {
        const matchesQuestionConcept = q.conceptId === conceptFilter;
        const matchesChoiceLink = q.choices.some((c) => c.linkedConceptId === conceptFilter);
        if (!matchesQuestionConcept && !matchesChoiceLink) {
          return false;
        }
      }
      if (visibilityFilter !== "all" && q.visibility !== visibilityFilter) {
        return false;
      }
      return true;
    });
  }, [questions, conceptFilter, visibilityFilter]);

  const openCreate = () => {
    setFormMode("create");
    setEditingQuestion(null);
    setFormOpen(true);
  };

  const openEdit = (q: QuizQuestion) => {
    setFormMode("edit");
    setEditingQuestion(q);
    setFormOpen(true);
  };

  const handleDelete = async (q: QuizQuestion) => {
    if (
      !window.confirm(
        `このクイズを削除しますか？\n\n${q.prompt.slice(0, 80)}${q.prompt.length > 80 ? "…" : ""}`
      )
    ) {
      return;
    }
    try {
      await storage.deleteQuizQuestion(q.id);
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
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-celestial-gold/80">Lab · 禁術実験室</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 id="quiz-builder-title" className="text-xl font-semibold tracking-wide text-celestial-textMain sm:text-2xl">
                クイズ作成
              </h1>
              <p className="mt-1 text-sm text-celestial-textSub">
                Concept に紐づく問い・選択肢・正解・解説を作成します。
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

          <div className="flex flex-col gap-3 rounded-xl border border-celestial-border/70 bg-nordic-navy/30 p-4 backdrop-blur-sm sm:flex-row sm:flex-wrap sm:items-end">
            <button
              type="button"
              onClick={openCreate}
              className="action-button order-first rounded-lg px-4 py-2.5 text-sm sm:order-none"
            >
              新規クイズ作成
            </button>
            {concepts.length === 0 ? (
              <p className="text-xs text-celestial-textSub">
                概念がまだない場合でもクイズは保存できます。選択肢と Concept タイトルの自動リンクは、概念を追加すると利用できます。
              </p>
            ) : null}

            <label className="block min-w-[200px] flex-1">
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

            <label className="block min-w-[160px]">
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
          ) : filteredQuestions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-celestial-border/80 bg-celestial-deepBlue/30 px-6 py-12 text-center">
              <p className="text-sm font-medium text-celestial-softGold">まだクイズがありません</p>
              <p className="mt-2 text-sm text-celestial-textSub">
                Concept に紐づく問いを作成してみましょう。
              </p>
              <button type="button" onClick={openCreate} className="action-button mt-6 rounded-lg px-4 py-2 text-sm">
                新規クイズ作成
              </button>
            </div>
          ) : (
            <ul className="space-y-3">
              {filteredQuestions.map((q) => {
                const linkCount = q.choices.filter((c) => c.linkedConceptId).length;
                const linkedTitles = [
                  ...new Set(
                    q.choices
                      .map((c) => c.linkedConceptId)
                      .filter(Boolean)
                      .map((id) => conceptTitleById.get(id!) ?? "")
                      .filter(Boolean)
                  )
                ];
                const linkPreview =
                  linkedTitles.length > 0
                    ? `（${linkedTitles.slice(0, 3).join("・")}${linkedTitles.length > 3 ? "…" : ""}）`
                    : "";
                return (
                <li
                  key={q.id}
                  className="rounded-2xl border border-celestial-border bg-celestial-deepBlue/25 p-4 shadow-[inset_0_0_0_1px_rgba(77,255,154,0.06)] backdrop-blur-sm"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1 space-y-2">
                      <p className="text-sm font-medium leading-snug text-celestial-textMain">{q.prompt}</p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-celestial-textSub">
                        <span className="rounded-md border border-celestial-border/60 bg-celestial-panel/80 px-2 py-0.5 text-celestial-softGold">
                          問いの関連:{" "}
                          {q.conceptId ? conceptTitleById.get(q.conceptId) ?? "（不明）" : "なし"}
                        </span>
                        <span
                          className="rounded-md border border-celestial-border/50 bg-celestial-panel/50 px-2 py-0.5 text-celestial-textSub"
                          title={linkedTitles.join("、")}
                        >
                          選択肢リンク {linkCount} 件{linkPreview}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 ${
                            q.visibility === "public"
                              ? "border border-celestial-gold/50 bg-celestial-gold/10 text-celestial-gold"
                              : "border border-celestial-border text-celestial-textSub"
                          }`}
                        >
                          {q.visibility === "public" ? "公開" : "非公開"}
                        </span>
                        <span>選択肢 {q.choices.length} 件</span>
                        <span>更新 {shortDateTime(q.updatedAt)}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(q)}
                        className="rounded-lg border border-celestial-gold/40 px-3 py-1.5 text-xs text-celestial-softGold hover:bg-celestial-gold/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-celestial-gold/50"
                      >
                        編集
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(q)}
                        className="rounded-lg border border-celestial-border px-3 py-1.5 text-xs text-celestial-textSub hover:border-celestial-danger/50 hover:text-celestial-danger focus:outline-none focus-visible:ring-2 focus-visible:ring-celestial-danger/40"
                        aria-label="このクイズを削除"
                      >
                        削除
                      </button>
                    </div>
                  </div>
                </li>
              );
              })}
            </ul>
          )}
        </div>
      </section>

      <QuizQuestionFormModal
        open={formOpen}
        mode={formMode}
        question={editingQuestion}
        concepts={concepts}
        onClose={() => setFormOpen(false)}
        onSaved={() => void load()}
      />
    </div>
  );
};
