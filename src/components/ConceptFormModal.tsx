import { useEffect, useMemo, useState, type FormEvent } from "react";
import { conceptStatusList, createEmptyConceptInput, type Concept, type ConceptInput } from "../types/concept";

type Props = {
  open: boolean;
  mode: "create" | "edit";
  baseConcept?: Concept;
  allConcepts: Concept[];
  onClose: () => void;
  onSubmit: (payload: ConceptInput) => Promise<void>;
};

const joinCsv = (items: string[]): string => items.join(", ");
const splitCsv = (value: string): string[] =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

export const ConceptFormModal = ({ open, mode, baseConcept, allConcepts, onClose, onSubmit }: Props) => {
  const [form, setForm] = useState<ConceptInput>(createEmptyConceptInput());
  const [domainTagInput, setDomainTagInput] = useState("");
  const [researchTagInput, setResearchTagInput] = useState("");
  const [relatedInput, setRelatedInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (mode === "edit" && baseConcept) {
      setForm({
        title: baseConcept.title,
        definition: baseConcept.definition,
        myInterpretation: baseConcept.myInterpretation,
        domainTags: baseConcept.domainTags,
        researchTags: baseConcept.researchTags,
        relatedIds: baseConcept.relatedIds,
        source: baseConcept.source,
        notes: baseConcept.notes,
        status: baseConcept.status,
        favorite: baseConcept.favorite
      });
      setDomainTagInput(joinCsv(baseConcept.domainTags));
      setResearchTagInput(joinCsv(baseConcept.researchTags));
      setRelatedInput(joinCsv(baseConcept.relatedIds));
    } else {
      const empty = createEmptyConceptInput();
      setForm(empty);
      setDomainTagInput("");
      setResearchTagInput("");
      setRelatedInput("");
    }
    setError(null);
  }, [open, mode, baseConcept]);

  const relatedCandidates = useMemo(
    () => allConcepts.filter((concept) => concept.id !== baseConcept?.id),
    [allConcepts, baseConcept?.id]
  );

  if (!open) {
    return null;
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.title.trim()) {
      setError("タイトルは必須です。");
      return;
    }
    const payload: ConceptInput = {
      ...form,
      title: form.title.trim(),
      domainTags: splitCsv(domainTagInput),
      researchTags: splitCsv(researchTagInput),
      relatedIds: splitCsv(relatedInput),
      source: {
        book: form.source.book.trim(),
        page: form.source.page.trim(),
        author: form.source.author?.trim() || null
      }
    };

    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(payload);
      onClose();
    } catch {
      setError("保存に失敗しました。");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
      <form className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl" onSubmit={handleSubmit}>
        <header className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            {mode === "create" ? "新しい概念" : "概念を編集"}
          </h2>
          <button className="rounded-md px-2 py-1 text-sm text-slate-500 hover:bg-slate-100" onClick={onClose} type="button">
            閉じる
          </button>
        </header>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="md:col-span-2">
            <span className="mb-1 block text-sm text-slate-700">タイトル *</span>
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            />
          </label>

          <label className="md:col-span-2">
            <span className="mb-1 block text-sm text-slate-700">定義</span>
            <textarea
              className="min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={form.definition}
              onChange={(e) => setForm((prev) => ({ ...prev, definition: e.target.value }))}
            />
          </label>

          <label className="md:col-span-2">
            <span className="mb-1 block text-sm text-slate-700">自分の解釈</span>
            <textarea
              className="min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={form.myInterpretation}
              onChange={(e) => setForm((prev) => ({ ...prev, myInterpretation: e.target.value }))}
            />
          </label>

          <label>
            <span className="mb-1 block text-sm text-slate-700">分野タグ（カンマ区切り）</span>
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={domainTagInput}
              onChange={(e) => setDomainTagInput(e.target.value)}
            />
          </label>

          <label>
            <span className="mb-1 block text-sm text-slate-700">研究テーマタグ（カンマ区切り）</span>
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={researchTagInput}
              onChange={(e) => setResearchTagInput(e.target.value)}
            />
          </label>

          <label>
            <span className="mb-1 block text-sm text-slate-700">状態</span>
            <select
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={form.status}
              onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as Concept["status"] }))}
            >
              {conceptStatusList.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>

          <label className="md:col-span-2">
            <span className="mb-1 block text-sm text-slate-700">関連概念ID（カンマ区切り）</span>
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={relatedInput}
              onChange={(e) => setRelatedInput(e.target.value)}
              placeholder="concept_xxx, concept_yyy"
            />
            <p className="mt-1 text-xs text-slate-500">
              候補: {relatedCandidates.slice(0, 8).map((c) => c.id).join(", ") || "なし"}
            </p>
          </label>

          <label className="md:col-span-2">
            <span className="mb-1 block text-sm text-slate-700">メモ</span>
            <textarea
              className="min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
            />
          </label>

          <label>
            <span className="mb-1 block text-sm text-slate-700">出典（書籍）</span>
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={form.source.book}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, source: { ...prev.source, book: e.target.value } }))
              }
            />
          </label>
          <label>
            <span className="mb-1 block text-sm text-slate-700">ページ</span>
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={form.source.page}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, source: { ...prev.source, page: e.target.value } }))
              }
            />
          </label>
          <label className="md:col-span-2">
            <span className="mb-1 block text-sm text-slate-700">著者</span>
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={form.source.author ?? ""}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, source: { ...prev.source, author: e.target.value } }))
              }
            />
          </label>
        </div>

        <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.favorite}
            onChange={(e) => setForm((prev) => ({ ...prev, favorite: e.target.checked }))}
          />
          お気に入りにする
        </label>

        {error && <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

        <footer className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700"
            onClick={onClose}
          >
            キャンセル
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-slate-800 px-3 py-2 text-sm text-white disabled:opacity-70"
          >
            {submitting ? "保存中..." : "保存"}
          </button>
        </footer>
      </form>
    </div>
  );
};
