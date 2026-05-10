import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Concept } from "../types/concept";
import type { QuizChoice, QuizQuestion, QuizVisibility } from "../types/quiz";
import { QUIZ_QUESTION_SCHEMA_VERSION } from "../types/quiz";
import { getStorage } from "../storage";
import { nowIso } from "../utils/date";
import { applyAutoLinkedConceptIdsToChoices, resolveChoiceConceptLink } from "../utils/quizConceptLink";

const storage = getStorage();

const createQuizQuestionId = (): string =>
  `quiz_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

const createChoiceId = (): string =>
  `choice_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const MAX_DOMAIN_TAGS_IN_LABEL = 3;

const normalizeDomainTagsForLabel = (tags: string[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tags) {
    const s = t.trim();
    if (!s || seen.has(s)) {
      continue;
    }
    seen.add(s);
    out.push(s);
  }
  return out;
};

/** ネイティブ select の option 表示用（保存値は concept.id のまま） */
const formatConceptSelectLabel = (concept: Concept): string => {
  const title = concept.title?.trim() ? concept.title.trim() : "無題のConcept";
  const tags = normalizeDomainTagsForLabel(concept.domainTags ?? []);
  if (tags.length === 0) {
    return title;
  }
  const head = tags.slice(0, MAX_DOMAIN_TAGS_IN_LABEL);
  const hidden = tags.length - head.length;
  const inner = head.join(" / ") + (hidden > 0 ? ` +${hidden}` : "");
  return `${title} 〔${inner}〕`;
};

const defaultChoices = (): QuizChoice[] => [
  { id: createChoiceId(), text: "" },
  { id: createChoiceId(), text: "" }
];

type Props = {
  open: boolean;
  mode: "create" | "edit";
  question?: QuizQuestion | null;
  concepts: Concept[];
  onClose: () => void;
  onSaved: () => void;
  /** 保存直後に呼ばれる（クイズ集への紐づけなど） */
  onSavedQuestion?: (saved: QuizQuestion) => void;
};

export const QuizQuestionFormModal = ({
  open,
  mode,
  question,
  concepts,
  onClose,
  onSaved,
  onSavedQuestion
}: Props) => {
  const [conceptId, setConceptId] = useState("");
  const [prompt, setPrompt] = useState("");
  const [choices, setChoices] = useState<QuizChoice[]>(defaultChoices);
  const [correctChoiceId, setCorrectChoiceId] = useState("");
  const [explanation, setExplanation] = useState("");
  const [visibility, setVisibility] = useState<QuizVisibility>("private");
  const [sortOrderInput, setSortOrderInput] = useState("");
  const [questionId, setQuestionId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setError(null);
    if (mode === "edit" && question) {
      setQuestionId(question.id);
      setConceptId(question.conceptId ?? "");
      setPrompt(question.prompt);
      setChoices(question.choices.length > 0 ? question.choices.map((c) => ({ ...c })) : defaultChoices());
      setCorrectChoiceId(question.correctChoiceId);
      setExplanation(question.explanation ?? "");
      setVisibility(question.visibility);
      setSortOrderInput(question.sortOrder !== undefined ? String(question.sortOrder) : "");
    } else {
      const ch = defaultChoices();
      setQuestionId(createQuizQuestionId());
      setConceptId("");
      setPrompt("");
      setChoices(ch);
      setCorrectChoiceId(ch[0]?.id ?? "");
      setExplanation("");
      setVisibility("private");
      setSortOrderInput("");
    }
  }, [open, mode, question]);

  const addChoice = () => {
    const id = createChoiceId();
    setChoices((prev) => [...prev, { id, text: "" }]);
  };

  const removeChoice = (id: string) => {
    setChoices((prev) => {
      if (prev.length <= 2) {
        return prev;
      }
      const next = prev.filter((c) => c.id !== id);
      setCorrectChoiceId((cur) => {
        if (cur !== id) {
          return cur;
        }
        return next[0]?.id ?? "";
      });
      return next;
    });
  };

  const updateChoiceText = (id: string, text: string) => {
    setChoices((prev) => prev.map((c) => (c.id === id ? { ...c, text } : c)));
  };

  const choiceLinkById = useMemo(() => {
    const m = new Map<string, ReturnType<typeof resolveChoiceConceptLink>>();
    choices.forEach((c) => {
      m.set(c.id, resolveChoiceConceptLink(c.text.trim(), concepts));
    });
    return m;
  }, [choices, concepts]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedPrompt = prompt.trim();
    const cleanedChoices = choices
      .map((c) => ({ id: c.id, text: c.text.trim() }))
      .filter((c) => c.text.length > 0);

    if (!trimmedPrompt) {
      setError("問題文を入力してください。");
      return;
    }
    if (cleanedChoices.length < 2) {
      setError("選択肢は2件以上、それぞれ本文を入力してください。");
      return;
    }
    if (!cleanedChoices.some((c) => c.id === correctChoiceId)) {
      setError("正解となる選択肢を選んでください。");
      return;
    }

    const sortOrderParsed = sortOrderInput.trim() === "" ? undefined : Number(sortOrderInput);
    const sortOrder =
      sortOrderParsed !== undefined && Number.isFinite(sortOrderParsed) ? sortOrderParsed : undefined;

    const choicesWithLinks = applyAutoLinkedConceptIdsToChoices(cleanedChoices, concepts);

    const payload: QuizQuestion = {
      id: questionId,
      prompt: trimmedPrompt,
      choices: choicesWithLinks,
      correctChoiceId,
      explanation: explanation.trim() || undefined,
      visibility,
      sortOrder,
      schemaVersion: mode === "edit" && question ? question.schemaVersion : QUIZ_QUESTION_SCHEMA_VERSION,
      createdAt: mode === "edit" && question ? question.createdAt : nowIso(),
      updatedAt: nowIso()
    };
    if (conceptId.trim()) {
      payload.conceptId = conceptId.trim();
    }

    setSubmitting(true);
    setError(null);
    try {
      await storage.saveQuizQuestion(payload);
      onSavedQuestion?.(payload);
      onSaved();
      onClose();
    } catch {
      setError("保存に失敗しました。");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return null;
  }

  const title = mode === "create" ? "クイズを作成" : "クイズを編集";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-nordic-overlay px-3 py-6 sm:px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quiz-form-title"
    >
      <form
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto scrollbar-none rounded-2xl border border-celestial-border bg-celestial-panel p-4 shadow-xl sm:p-5"
        onSubmit={handleSubmit}
      >
        <header className="mb-4 flex items-center justify-between gap-2">
          <h2 id="quiz-form-title" className="text-lg font-semibold text-celestial-textMain">
            {title}
          </h2>
          <button
            type="button"
            className="rounded-md px-2 py-1 text-sm text-celestial-softGold transition-colors hover:bg-celestial-gold/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-celestial-gold/55"
            onClick={onClose}
          >
            閉じる
          </button>
        </header>

        {concepts.length === 0 ? (
          <p className="text-sm text-celestial-textSub">
            概念がまだありません。選択肢と Concept タイトルの自動リンクは利用できませんが、クイズ自体は保存できます。
          </p>
        ) : (
          <p className="text-xs text-celestial-textSub">
            選択肢のテキストが Concept タイトルと一致（正規化後）すると、保存時に自動で Concept にリンクします。同名タイトルが複数ある場合はリンクしません。
          </p>
        )}

        <div className="grid gap-4">
          <label className="block">
            <span className="mb-1 block text-sm text-celestial-textMain">問い全体の関連 Concept（任意）</span>
            <select
              className="w-full rounded-md border border-celestial-border bg-celestial-deepBlue px-3 py-2 text-sm text-celestial-textMain focus:outline-none focus-visible:ring-2 focus-visible:ring-celestial-gold/45"
              value={conceptId}
              onChange={(e) => setConceptId(e.target.value)}
              disabled={concepts.length === 0}
            >
              <option value="">なし</option>
              {concepts.map((c) => (
                <option key={c.id} value={c.id}>
                  {formatConceptSelectLabel(c)}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm text-celestial-textMain">問題文 *</span>
            <textarea
              className="min-h-[100px] w-full rounded-md border border-celestial-border bg-celestial-deepBlue px-3 py-2 text-sm text-celestial-textMain placeholder:text-celestial-textSub focus:outline-none focus-visible:ring-2 focus-visible:ring-celestial-gold/45"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="問いを入力…"
            />
          </label>

          <fieldset className="min-w-0">
            <legend className="mb-2 text-sm font-medium text-celestial-textMain">選択肢 *（2件以上）</legend>
            <ul className="space-y-2">
              {choices.map((c) => {
                const link = choiceLinkById.get(c.id) ?? { state: "none" as const };
                return (
                  <li key={c.id} className="flex flex-col gap-2 sm:flex-row sm:items-start">
                    <div className="min-w-0 flex-1 space-y-1">
                      <label className="flex items-start gap-2 rounded-lg border border-celestial-border/80 bg-celestial-deepBlue/50 p-2">
                        <input
                          type="radio"
                          name="correctChoice"
                          className="mt-1 shrink-0 border-celestial-border text-celestial-gold focus:ring-celestial-gold/50"
                          checked={correctChoiceId === c.id}
                          onChange={() => setCorrectChoiceId(c.id)}
                          aria-label="この選択肢を正解にする"
                        />
                        <input
                          type="text"
                          className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-sm text-celestial-textMain placeholder:text-celestial-textSub focus:border-celestial-gold/40 focus:outline-none"
                          value={c.text}
                          onChange={(e) => updateChoiceText(c.id, e.target.value)}
                          placeholder="選択肢の本文（Concept タイトルと一致で自動リンク）"
                          aria-label="選択肢の本文"
                        />
                      </label>
                      <div className="pl-7 text-xs">
                        {link.state === "linked" ? (
                          <span className="inline-flex rounded-md border border-celestial-gold/35 bg-celestial-gold/10 px-2 py-0.5 text-celestial-softGold">
                            Conceptリンク済み: {link.matchedTitle}
                          </span>
                        ) : null}
                        {link.state === "none" && c.text.trim() ? (
                          <span className="text-celestial-textSub">未リンク</span>
                        ) : null}
                        {link.state === "ambiguous" ? (
                          <span className="text-celestial-danger">同名Conceptが複数あります</span>
                        ) : null}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="shrink-0 rounded-md border border-celestial-border px-2 py-1 text-xs text-celestial-softGold hover:bg-celestial-gold/10 disabled:cursor-not-allowed disabled:opacity-40"
                      onClick={() => removeChoice(c.id)}
                      disabled={choices.length <= 2}
                      aria-label="この選択肢を削除"
                    >
                      削除
                    </button>
                  </li>
                );
              })}
            </ul>
            <button
              type="button"
              className="mt-2 rounded-md border border-celestial-gold/40 px-3 py-1.5 text-xs text-celestial-softGold hover:bg-celestial-gold/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-celestial-gold/50"
              onClick={addChoice}
            >
              選択肢を追加
            </button>
          </fieldset>

          <label className="block">
            <span className="mb-1 block text-sm text-celestial-textMain">解説（任意）</span>
            <textarea
              className="min-h-[72px] w-full rounded-md border border-celestial-border bg-celestial-deepBlue px-3 py-2 text-sm text-celestial-textMain placeholder:text-celestial-textSub focus:outline-none focus-visible:ring-2 focus-visible:ring-celestial-gold/45"
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="回答後に表示する解説…"
            />
          </label>

          <div>
            <span className="mb-1 block text-sm text-celestial-textMain" id="visibility-label">
              公開設定
            </span>
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-labelledby="visibility-label"
            >
              <button
                type="button"
                className={`rounded-lg border px-3 py-2 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-celestial-gold/55 ${
                  visibility === "private"
                    ? "border-celestial-gold bg-celestial-gold/15 text-celestial-textMain"
                    : "border-celestial-border text-celestial-softGold hover:bg-celestial-gold/10"
                }`}
                onClick={() => setVisibility("private")}
              >
                非公開
              </button>
              <button
                type="button"
                className={`rounded-lg border px-3 py-2 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-celestial-gold/55 ${
                  visibility === "public"
                    ? "border-celestial-gold bg-celestial-gold/15 text-celestial-textMain"
                    : "border-celestial-border text-celestial-softGold hover:bg-celestial-gold/10"
                }`}
                onClick={() => setVisibility("public")}
              >
                公開
              </button>
            </div>
          </div>

          <label className="block">
            <span className="mb-1 block text-sm text-celestial-textMain">表示順（任意・数値）</span>
            <input
              type="number"
              className="w-full max-w-[200px] rounded-md border border-celestial-border bg-celestial-deepBlue px-3 py-2 text-sm text-celestial-textMain focus:outline-none focus-visible:ring-2 focus-visible:ring-celestial-gold/45"
              value={sortOrderInput}
              onChange={(e) => setSortOrderInput(e.target.value)}
              placeholder="空欄で未指定"
            />
          </label>
        </div>

        {error ? <p className="mt-4 text-sm text-celestial-danger">{error}</p> : null}

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="rounded-lg border border-celestial-border px-4 py-2 text-sm text-celestial-softGold hover:bg-celestial-gold/10"
            onClick={onClose}
          >
            キャンセル
          </button>
          <button
            type="submit"
            className="action-button rounded-lg px-4 py-2 text-sm disabled:opacity-60"
            disabled={submitting}
          >
            {submitting ? "保存中…" : "保存"}
          </button>
        </div>
      </form>
    </div>
  );
};
