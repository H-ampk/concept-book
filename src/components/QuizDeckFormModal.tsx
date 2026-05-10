import { useCallback, useEffect, useMemo, useState } from "react";
import { getStorage } from "../storage";
import type { Concept } from "../types/concept";
import type { QuizDeck, QuizQuestion, QuizVisibility } from "../types/quiz";
import { QUIZ_DECK_SCHEMA_VERSION } from "../types/quiz";
import { nowIso, shortDateTime } from "../utils/date";
import { QuizQuestionFormModal } from "./QuizQuestionFormModal";

const storage = getStorage();

const createDeckId = (): string =>
  `deck_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

const dedupeQuestionIds = (ids: string[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    const t = id.trim();
    if (!t || seen.has(t)) {
      continue;
    }
    seen.add(t);
    out.push(t);
  }
  return out;
};

const parseDomainTagsInput = (input: string): string[] | undefined => {
  const parts = input
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    if (seen.has(p)) {
      continue;
    }
    seen.add(p);
    out.push(p);
  }
  return out.length > 0 ? out : undefined;
};

const emptyDeck = (): QuizDeck => {
  const t = nowIso();
  return {
    id: createDeckId(),
    title: "",
    questionIds: [],
    visibility: "private",
    schemaVersion: QUIZ_DECK_SCHEMA_VERSION,
    createdAt: t,
    updatedAt: t
  };
};

type Props = {
  open: boolean;
  /** null のとき新規作成 */
  initialDeck: QuizDeck | null;
  concepts: Concept[];
  allQuestions: QuizQuestion[];
  onClose: () => void;
  onReload: () => Promise<void>;
};

export const QuizDeckFormModal = ({
  open,
  initialDeck,
  concepts,
  allQuestions,
  onClose,
  onReload
}: Props) => {
  const [draft, setDraft] = useState<QuizDeck>(() => emptyDeck());
  const [tagsInput, setTagsInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [questionFormOpen, setQuestionFormOpen] = useState(false);
  const [questionFormMode, setQuestionFormMode] = useState<"create" | "edit">("create");
  const [editingQuestion, setEditingQuestion] = useState<QuizQuestion | null>(null);

  const questionById = useMemo(() => {
    const m = new Map<string, QuizQuestion>();
    allQuestions.forEach((q) => m.set(q.id, q));
    return m;
  }, [allQuestions]);

  const resetFromProps = useCallback(() => {
    if (initialDeck) {
      setDraft({
        ...initialDeck,
        questionIds: [...initialDeck.questionIds]
      });
      setTagsInput(initialDeck.domainTags?.join(", ") ?? "");
    } else {
      setDraft(emptyDeck());
      setTagsInput("");
    }
    setPickerOpen(false);
    setQuestionFormOpen(false);
    setEditingQuestion(null);
  }, [initialDeck]);

  useEffect(() => {
    if (open) {
      resetFromProps();
    }
  }, [open, resetFromProps]);

  const deckIdSet = useMemo(() => new Set(draft.questionIds), [draft.questionIds]);

  const persistDeckToStorage = useCallback(
    async (next: QuizDeck): Promise<QuizDeck | null> => {
      const title = next.title.trim();
      if (!title) {
        window.alert("クイズ集タイトルを入力してください。");
        return null;
      }
      const deckKeyRaw = next.deckKey?.trim();
      const payload: QuizDeck = {
        ...next,
        title,
        questionIds: dedupeQuestionIds(next.questionIds),
        visibility: next.visibility,
        updatedAt: nowIso(),
        deckKey: deckKeyRaw || undefined,
        domainTags: parseDomainTagsInput(tagsInput),
        schemaVersion: next.schemaVersion,
        createdAt: next.createdAt,
        id: next.id
      };
      const desc = next.description?.trim();
      if (desc) {
        payload.description = desc;
      } else {
        delete payload.description;
      }
      if (!deckKeyRaw) {
        delete payload.deckKey;
      }
      if (!payload.domainTags?.length) {
        delete payload.domainTags;
      }
      try {
        await storage.saveQuizDeck(payload);
        setDraft(payload);
        setTagsInput(payload.domainTags?.join(", ") ?? "");
        await onReload();
        return payload;
      } catch (e) {
        console.error(e);
        window.alert("クイズ集の保存に失敗しました。");
        return null;
      }
    },
    [onReload, tagsInput]
  );

  const handleSaveMeta = async () => {
    setSaving(true);
    try {
      await persistDeckToStorage({ ...draft, updatedAt: nowIso() });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndClose = async () => {
    setSaving(true);
    try {
      const saved = await persistDeckToStorage({ ...draft, updatedAt: nowIso() });
      if (saved) {
        onClose();
      }
    } finally {
      setSaving(false);
    }
  };

  const openNewQuestion = async () => {
    if (!draft.title.trim()) {
      window.alert("先にクイズ集タイトルを入力し、「クイズ集を保存」を押してください。");
      return;
    }
    setSaving(true);
    try {
      const saved = await persistDeckToStorage(draft);
      if (!saved) {
        return;
      }
      setQuestionFormMode("create");
      setEditingQuestion(null);
      setQuestionFormOpen(true);
    } finally {
      setSaving(false);
    }
  };

  const openEditQuestion = (q: QuizQuestion) => {
    setQuestionFormMode("edit");
    setEditingQuestion(q);
    setQuestionFormOpen(true);
  };

  const onQuestionSavedWithPayload = async (saved: QuizQuestion) => {
    if (questionFormMode !== "create") {
      return;
    }
    const latest = (await storage.getQuizDeck(draft.id)) ?? draft;
    const nextIds = dedupeQuestionIds([...latest.questionIds, saved.id]);
    await persistDeckToStorage({ ...latest, questionIds: nextIds, updatedAt: nowIso() });
  };

  const moveQuestion = async (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= draft.questionIds.length) {
      return;
    }
    const nextIds = [...draft.questionIds];
    [nextIds[index], nextIds[j]] = [nextIds[j], nextIds[index]];
    const next: QuizDeck = { ...draft, questionIds: nextIds, updatedAt: nowIso() };
    setDraft(next);
    const saved = await persistDeckToStorage(next);
    if (!saved) {
      const restored = await storage.getQuizDeck(draft.id);
      if (restored) {
        setDraft({ ...restored, questionIds: [...restored.questionIds] });
        setTagsInput(restored.domainTags?.join(", ") ?? "");
      }
    }
  };

  const removeFromDeck = async (qid: string) => {
    const nextIds = draft.questionIds.filter((id) => id !== qid);
    const next: QuizDeck = { ...draft, questionIds: nextIds, updatedAt: nowIso() };
    setDraft(next);
    const saved = await persistDeckToStorage(next);
    if (!saved) {
      const restored = await storage.getQuizDeck(draft.id);
      if (restored) {
        setDraft({ ...restored, questionIds: [...restored.questionIds] });
        setTagsInput(restored.domainTags?.join(", ") ?? "");
      }
    }
  };

  const addExistingQuestion = async (q: QuizQuestion) => {
    if (deckIdSet.has(q.id)) {
      return;
    }
    if (!draft.title.trim()) {
      window.alert("先にクイズ集タイトルを入力し、「クイズ集を保存」を押してください。");
      return;
    }
    setSaving(true);
    try {
      const first = await persistDeckToStorage(draft);
      if (!first) {
        return;
      }
      const latest = (await storage.getQuizDeck(draft.id)) ?? first;
      const nextIds = dedupeQuestionIds([...latest.questionIds, q.id]);
      await persistDeckToStorage({ ...latest, questionIds: nextIds, updatedAt: nowIso() });
      setPickerOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const deleteQuestionPermanently = async (q: QuizQuestion) => {
    if (
      !window.confirm(
        `【完全削除】この問題をデータベースから削除します。\n\n全クイズ集の questionIds からも除去されます。取り消せません。\n\n${q.prompt.slice(0, 120)}${q.prompt.length > 120 ? "…" : ""}`
      )
    ) {
      return;
    }
    try {
      await storage.deleteQuizQuestion(q.id);
      setDraft((d) => ({
        ...d,
        questionIds: d.questionIds.filter((id) => id !== q.id),
        updatedAt: nowIso()
      }));
      await onReload();
    } catch {
      window.alert("削除に失敗しました。");
    }
  };

  if (!open) {
    return null;
  }

  const titleLabel = initialDeck ? "クイズ集を編集" : "新規クイズ集";
  const availableToAdd = allQuestions.filter((q) => !deckIdSet.has(q.id));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-nordic-overlay px-2 py-6 sm:px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quiz-deck-form-title"
    >
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto scrollbar-none rounded-2xl border border-celestial-border bg-celestial-panel p-4 shadow-xl sm:p-6">
        <header className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 id="quiz-deck-form-title" className="text-lg font-semibold text-celestial-textMain">
              {titleLabel}
            </h2>
            <p className="mt-1 text-xs text-celestial-textSub">
              分野・テーマ単位のクイズ集です。問題はこの中で追加・並べ替えます（問題データ自体は独立保存されます）。
            </p>
          </div>
          <button
            type="button"
            className="rounded-md px-2 py-1 text-sm text-celestial-softGold hover:bg-celestial-gold/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-celestial-gold/55"
            onClick={onClose}
          >
            閉じる
          </button>
        </header>

        <div className="space-y-4 border-b border-celestial-border/50 pb-5">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-celestial-textMain">クイズ集タイトル *</span>
            <input
              type="text"
              className="w-full rounded-md border border-celestial-border bg-celestial-deepBlue px-3 py-2 text-sm text-celestial-textMain focus:outline-none focus-visible:ring-2 focus-visible:ring-celestial-gold/45"
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              placeholder="例: 心理学検定・社会心理"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-celestial-textMain">説明（任意）</span>
            <textarea
              className="min-h-[72px] w-full rounded-md border border-celestial-border bg-celestial-deepBlue px-3 py-2 text-sm text-celestial-textMain focus:outline-none focus-visible:ring-2 focus-visible:ring-celestial-gold/45"
              value={draft.description ?? ""}
              onChange={(e) =>
                setDraft((d) => ({ ...d, description: e.target.value || undefined }))
              }
              placeholder="このセットの目的や対象…"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-celestial-textMain">識別ID（任意）</span>
            <input
              type="text"
              className="w-full rounded-md border border-celestial-border bg-celestial-deepBlue px-3 py-2 font-mono text-sm text-celestial-textMain focus:outline-none focus-visible:ring-2 focus-visible:ring-celestial-gold/45"
              value={draft.deckKey ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, deckKey: e.target.value || undefined }))}
              placeholder="psychology-social"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-celestial-textMain">タグ（任意・カンマ区切り）</span>
            <input
              type="text"
              className="w-full rounded-md border border-celestial-border bg-celestial-deepBlue px-3 py-2 text-sm text-celestial-textMain focus:outline-none focus-visible:ring-2 focus-visible:ring-celestial-gold/45"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="心理学検定, 社会心理, 同調"
            />
          </label>

          <div>
            <span className="mb-1 block text-sm font-medium text-celestial-textMain">公開設定</span>
            <div className="flex flex-wrap gap-2" role="group" aria-label="公開設定">
              {(
                [
                  ["private", "非公開"],
                  ["public", "公開"]
                ] as const
              ).map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  className={`rounded-lg border px-3 py-2 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-celestial-gold/55 ${
                    draft.visibility === v
                      ? "border-celestial-gold bg-celestial-gold/15 text-celestial-textMain"
                      : "border-celestial-border text-celestial-softGold hover:bg-celestial-gold/10"
                  }`}
                  onClick={() => setDraft((d) => ({ ...d, visibility: v as QuizVisibility }))}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving}
              className="rounded-lg border border-celestial-gold/50 bg-celestial-gold/10 px-3 py-2 text-sm text-celestial-softGold hover:bg-celestial-gold/20 disabled:opacity-50"
              onClick={() => void handleSaveMeta()}
            >
              クイズ集を保存
            </button>
          </div>
        </div>

        <section className="mt-5 space-y-3" aria-labelledby="deck-questions-heading">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h3 id="deck-questions-heading" className="text-sm font-semibold text-celestial-softGold">
              このクイズ集の問題（出題順）
            </h3>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-lg border border-celestial-gold/45 px-3 py-1.5 text-xs text-celestial-softGold hover:bg-celestial-gold/10"
                onClick={() => void openNewQuestion()}
              >
                新しい問題を追加
              </button>
              <button
                type="button"
                className={`rounded-lg border px-3 py-1.5 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-celestial-gold/55 ${
                  pickerOpen
                    ? "border-celestial-gold bg-celestial-gold/15 text-celestial-textMain"
                    : "border-celestial-border text-celestial-softGold hover:bg-celestial-gold/10"
                }`}
                onClick={() => setPickerOpen((p) => !p)}
              >
                既存の問題を追加
              </button>
            </div>
          </div>

          {pickerOpen ? (
            <div className="max-h-48 overflow-y-auto scrollbar-none rounded-xl border border-celestial-border/60 bg-nordic-navy/35 p-3">
              {availableToAdd.length === 0 ? (
                <p className="text-xs text-celestial-textSub">追加できる他の問題がありません。</p>
              ) : (
                <ul className="space-y-2">
                  {availableToAdd.map((q) => (
                    <li
                      key={q.id}
                      className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-celestial-border/40 bg-celestial-deepBlue/30 px-3 py-2"
                    >
                      <p className="min-w-0 flex-1 text-xs text-celestial-textMain line-clamp-2">{q.prompt}</p>
                      <button
                        type="button"
                        className="shrink-0 rounded border border-celestial-gold/40 px-2 py-1 text-xs text-celestial-softGold hover:bg-celestial-gold/10"
                        onClick={() => void addExistingQuestion(q)}
                      >
                        追加
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          {draft.questionIds.length === 0 ? (
            <p className="rounded-lg border border-dashed border-celestial-border/70 bg-celestial-deepBlue/20 px-4 py-6 text-center text-sm text-celestial-textSub">
              まだ問題がありません。「新しい問題を追加」または「既存の問題を追加」から登録できます。
            </p>
          ) : (
            <ol className="space-y-3">
              {draft.questionIds.map((qid, index) => {
                const q = questionById.get(qid);
                return (
                  <li
                    key={qid}
                    className="rounded-xl border border-celestial-border/70 bg-celestial-deepBlue/25 p-3 backdrop-blur-sm"
                  >
                    <div className="flex flex-wrap items-start gap-2">
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-celestial-gold/40 bg-celestial-gold/10 text-xs font-semibold text-celestial-softGold">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        {q ? (
                          <p className="text-sm font-medium leading-snug text-celestial-textMain">{q.prompt}</p>
                        ) : (
                          <p className="text-sm text-amber-400/90">
                            データ未同期（ID: <code className="font-mono text-xs">{qid}</code>）
                          </p>
                        )}
                        {q ? (
                          <p className="mt-1 text-[11px] text-celestial-textSub">
                            更新 {shortDateTime(q.updatedAt)} · {q.visibility === "public" ? "公開" : "非公開"}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={index === 0}
                        className="rounded border border-celestial-border px-2 py-1 text-xs text-celestial-textMain hover:border-celestial-gold/50 disabled:opacity-40"
                        onClick={() => void moveQuestion(index, -1)}
                        aria-label={`問題 ${index + 1} を上へ`}
                      >
                        上へ
                      </button>
                      <button
                        type="button"
                        disabled={index >= draft.questionIds.length - 1}
                        className="rounded border border-celestial-border px-2 py-1 text-xs text-celestial-textMain hover:border-celestial-gold/50 disabled:opacity-40"
                        onClick={() => void moveQuestion(index, 1)}
                        aria-label={`問題 ${index + 1} を下へ`}
                      >
                        下へ
                      </button>
                      {q ? (
                        <>
                          <button
                            type="button"
                            className="rounded border border-celestial-gold/40 px-2 py-1 text-xs text-celestial-softGold hover:bg-celestial-gold/10"
                            onClick={() => openEditQuestion(q)}
                          >
                            編集
                          </button>
                          <button
                            type="button"
                            className="rounded border border-celestial-border px-2 py-1 text-xs text-celestial-textSub hover:border-amber-500/50 hover:text-amber-200"
                            onClick={() => void removeFromDeck(qid)}
                          >
                            Deckから外す
                          </button>
                          <button
                            type="button"
                            className="rounded border border-rose-500/40 px-2 py-1 text-xs text-rose-200/90 hover:bg-rose-950/40"
                            onClick={() => void deleteQuestionPermanently(q)}
                          >
                            完全削除
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="rounded border border-celestial-border px-2 py-1 text-xs text-celestial-textSub hover:border-amber-500/50"
                          onClick={() => void removeFromDeck(qid)}
                        >
                          参照を外す
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-celestial-border/50 pt-4">
          <button
            type="button"
            className="rounded-lg border border-celestial-border px-4 py-2 text-sm text-celestial-softGold hover:bg-celestial-gold/10"
            onClick={onClose}
          >
            キャンセル
          </button>
          <button
            type="button"
            disabled={saving}
            className="action-button rounded-lg px-4 py-2 text-sm disabled:opacity-60"
            onClick={() => void handleSaveAndClose()}
          >
            {saving ? "保存中…" : "保存して閉じる"}
          </button>
        </div>
      </div>

      <QuizQuestionFormModal
        open={questionFormOpen}
        mode={questionFormMode}
        question={editingQuestion}
        concepts={concepts}
        onClose={() => setQuestionFormOpen(false)}
        onSaved={() => void onReload()}
        onSavedQuestion={(saved) => void onQuestionSavedWithPayload(saved)}
      />
    </div>
  );
};
