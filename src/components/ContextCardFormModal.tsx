import { useEffect, useState, type FormEvent } from "react";
import type { ContextCard, ContextCardInput } from "../types/contextCard";
import { createEmptyContextCardInput } from "../types/contextCard";
import {
  appendKeyConcepts,
  extractIndexTerms,
  validateIndexPageRange,
  type IndexExtractionResult
} from "../utils/extractIndexTerms";

const splitCsv = (value: string): string[] =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const joinCsv = (items: string[]): string => items.join(", ");

type Props = {
  open: boolean;
  mode: "create" | "edit";
  baseContextCard?: ContextCard;
  onClose: () => void;
  onSubmit: (payload: ContextCardInput) => Promise<ContextCard | undefined>;
};

export const ContextCardFormModal = ({
  open,
  mode,
  baseContextCard,
  onClose,
  onSubmit
}: Props) => {
  const [form, setForm] = useState<ContextCardInput>(createEmptyContextCardInput());
  const [domainTagInput, setDomainTagInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [indexText, setIndexText] = useState("");
  const [indexStartPage, setIndexStartPage] = useState("");
  const [indexEndPage, setIndexEndPage] = useState("");
  const [indexError, setIndexError] = useState<string | null>(null);
  const [indexResult, setIndexResult] = useState<IndexExtractionResult | null>(null);
  const [selectedTerms, setSelectedTerms] = useState<string[]>([]);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (mode === "edit" && baseContextCard) {
      setForm({
        title: baseContextCard.title,
        domainTags: baseContextCard.domainTags,
        centralQuestion: baseContextCard.centralQuestion,
        background: baseContextCard.background,
        flow: baseContextCard.flow,
        keyConcepts: baseContextCard.keyConcepts,
        linkedConcepts: baseContextCard.linkedConcepts ?? []
      });
      setDomainTagInput(joinCsv(baseContextCard.domainTags));
    } else {
      setForm(createEmptyContextCardInput());
      setDomainTagInput("");
    }
    setError(null);
    setIndexText("");
    setIndexStartPage("");
    setIndexEndPage("");
    setIndexError(null);
    setIndexResult(null);
    setSelectedTerms([]);
  }, [open, mode, baseContextCard]);

  const handleExtractIndex = () => {
    const range = validateIndexPageRange(indexStartPage, indexEndPage);
    if ("error" in range) {
      setIndexError(range.error);
      setIndexResult(null);
      setSelectedTerms([]);
      return;
    }
    if (!indexText.trim()) {
      setIndexError("索引テキストを入力してください。");
      setIndexResult(null);
      setSelectedTerms([]);
      return;
    }
    const result = extractIndexTerms(indexText, range.startPage, range.endPage);
    setIndexError(null);
    setIndexResult(result);
    setSelectedTerms(result.terms.map((term) => term.term));
  };

  const handleAddSelectedTerms = () => {
    if (!indexResult || selectedTerms.length === 0) {
      return;
    }
    const ordered = indexResult.terms
      .map((term) => term.term)
      .filter((term) => selectedTerms.includes(term));
    setForm((prev) => ({
      ...prev,
      keyConcepts: appendKeyConcepts(prev.keyConcepts, ordered)
    }));
  };

  if (!open) {
    return null;
  }

  const selectedCount = indexResult
    ? indexResult.terms.filter((term) => selectedTerms.includes(term.term)).length
    : 0;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.title.trim()) {
      setError("タイトルは必須です。");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload: ContextCardInput = {
        ...form,
        title: form.title.trim(),
        domainTags: splitCsv(domainTagInput),
        linkedConcepts: form.linkedConcepts ?? []
      };
      const result = await onSubmit(payload);
      if (result) {
        onClose();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました。");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-nordic-navy/40 px-4 py-6">
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden rounded-3xl border border-celestial-border bg-celestial-panel shadow-celestial">
        <div className="flex-shrink-0 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-celestial-textMain">
                {mode === "edit" ? "文脈カードを編集" : "文脈カードを作成"}
              </h2>
              <p className="text-sm text-celestial-textSub">
                文脈カードを保存すると、後で一覧から参照できます。
              </p>
            </div>
            <button
              type="button"
              className="rounded-md border border-celestial-gold/30 bg-celestial-panel px-3 py-2 text-sm text-celestial-softGold hover:bg-celestial-gold/10"
              onClick={onClose}
            >
              閉じる
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-none px-6 pb-6">
          <form className="space-y-4" onSubmit={handleSubmit}>
            {error && (
              <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
            )}

            <div>
              <label htmlFor="context-card-title" className="mb-1 block text-sm font-medium text-celestial-softGold">タイトル</label>
              <input
                id="context-card-title"
                className="w-full rounded-2xl border border-celestial-gold/30 bg-celestial-deepBlue px-4 py-3 text-sm text-celestial-textMain"
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-celestial-softGold">分野タグ（カンマ区切り）</label>
              <input
                className="w-full rounded-2xl border border-celestial-gold/30 bg-celestial-deepBlue px-4 py-3 text-sm text-celestial-textMain"
                value={domainTagInput}
                onChange={(e) => setDomainTagInput(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-celestial-softGold">中心的な問い</label>
              <textarea
                rows={3}
                className="w-full rounded-2xl border border-celestial-gold/30 bg-celestial-deepBlue px-4 py-3 text-sm text-celestial-textMain"
                value={form.centralQuestion}
                onChange={(e) => setForm((prev) => ({ ...prev, centralQuestion: e.target.value }))}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-celestial-softGold">背景</label>
              <textarea
                rows={3}
                className="w-full rounded-2xl border border-celestial-gold/30 bg-celestial-deepBlue px-4 py-3 text-sm text-celestial-textMain"
                value={form.background}
                onChange={(e) => setForm((prev) => ({ ...prev, background: e.target.value }))}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-celestial-softGold">流れ</label>
              <textarea
                rows={3}
                className="w-full rounded-2xl border border-celestial-gold/30 bg-celestial-deepBlue px-4 py-3 text-sm text-celestial-textMain"
                value={form.flow}
                onChange={(e) => setForm((prev) => ({ ...prev, flow: e.target.value }))}
              />
            </div>

            <div className="space-y-3 rounded-2xl border border-celestial-gold/30 bg-celestial-deepBlue/40 p-4">
              <div>
                <p className="text-sm font-medium text-celestial-softGold">索引から抽出</p>
                <p className="mt-1 text-xs text-celestial-textSub">
                  索引を貼り付け、ページ範囲に合う用語を重要概念へ追加できます。索引自体は保存されません。
                </p>
              </div>
              <label className="block">
                <span className="mb-1 block text-sm text-celestial-textSub">索引テキスト</span>
                <textarea
                  rows={5}
                  aria-label="索引テキスト"
                  placeholder={"インターネット 12, 38, 52\nISP 40-42\nFTTH 44\nモデム 18, 47\nデータ通信 35, 48-51"}
                  className="w-full rounded-2xl border border-celestial-gold/30 bg-celestial-deepBlue px-4 py-3 text-sm text-celestial-textMain"
                  value={indexText}
                  onChange={(e) => setIndexText(e.target.value)}
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-sm text-celestial-textSub">開始ページ</span>
                  <input
                    inputMode="numeric"
                    aria-label="開始ページ"
                    className="w-full rounded-2xl border border-celestial-gold/30 bg-celestial-deepBlue px-4 py-3 text-sm text-celestial-textMain"
                    value={indexStartPage}
                    onChange={(e) => setIndexStartPage(e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm text-celestial-textSub">終了ページ</span>
                  <input
                    inputMode="numeric"
                    aria-label="終了ページ"
                    className="w-full rounded-2xl border border-celestial-gold/30 bg-celestial-deepBlue px-4 py-3 text-sm text-celestial-textMain"
                    value={indexEndPage}
                    onChange={(e) => setIndexEndPage(e.target.value)}
                  />
                </label>
              </div>
              {indexError && (
                <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{indexError}</p>
              )}
              <button
                type="button"
                className="rounded-2xl border border-celestial-gold/30 bg-celestial-panel px-4 py-2 text-sm text-celestial-softGold hover:bg-celestial-panelHover"
                onClick={handleExtractIndex}
              >
                指定範囲から用語を抽出
              </button>
              {indexResult && (
                <div className="space-y-3">
                  {indexResult.terms.length === 0 ? (
                    <p className="text-sm text-celestial-textSub">指定範囲に該当する用語はありませんでした。</p>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm text-celestial-textSub">
                          抽出 {indexResult.terms.length} 件 / 選択 {selectedCount} 件
                        </p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="rounded-md border border-celestial-gold/30 px-2 py-1 text-xs text-celestial-softGold hover:bg-celestial-gold/10"
                            onClick={() => setSelectedTerms(indexResult.terms.map((term) => term.term))}
                          >
                            全選択
                          </button>
                          <button
                            type="button"
                            className="rounded-md border border-celestial-gold/30 px-2 py-1 text-xs text-celestial-softGold hover:bg-celestial-gold/10"
                            onClick={() => setSelectedTerms([])}
                          >
                            全解除
                          </button>
                        </div>
                      </div>
                      <ul className="max-h-48 space-y-2 overflow-y-auto">
                        {indexResult.terms.map((term) => {
                          const checked = selectedTerms.includes(term.term);
                          return (
                            <li key={term.term}>
                              <label className="flex items-start gap-2 text-sm text-celestial-textMain">
                                <input
                                  type="checkbox"
                                  className="mt-1"
                                  checked={checked}
                                  onChange={() =>
                                    setSelectedTerms((prev) =>
                                      checked ? prev.filter((item) => item !== term.term) : [...prev, term.term]
                                    )
                                  }
                                />
                                <span>
                                  {term.term}
                                  <span className="ml-2 text-xs text-celestial-textSub">
                                    {term.matchedPages.join(", ")}
                                  </span>
                                </span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    </>
                  )}
                  {indexResult.unparsedLines.length > 0 && (
                    <details className="text-sm text-celestial-textSub">
                      <summary>解釈できなかった行 {indexResult.unparsedLines.length} 件</summary>
                      <ul className="mt-2 space-y-1">
                        {indexResult.unparsedLines.map((line, index) => (
                          <li key={`${index}-${line}`} className="font-mono text-xs">
                            {line}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                  <button
                    type="button"
                    disabled={selectedCount === 0}
                    className="action-button rounded-2xl px-4 py-2 text-sm disabled:opacity-60"
                    onClick={handleAddSelectedTerms}
                  >
                    選択した用語を重要概念に追加
                  </button>
                </div>
              )}
            </div>

            <div>
              <label htmlFor="context-card-key-concepts" className="mb-1 block text-sm font-medium text-celestial-softGold">重要概念</label>
              <textarea
                id="context-card-key-concepts"
                rows={3}
                className="w-full rounded-2xl border border-celestial-gold/30 bg-celestial-deepBlue px-4 py-3 text-sm text-celestial-textMain"
                value={form.keyConcepts}
                onChange={(e) => setForm((prev) => ({ ...prev, keyConcepts: e.target.value }))}
              />
            </div>

            <div className="flex justify-end gap-3 pt-3">
              <button
                type="button"
                className="rounded-2xl border border-celestial-gold/30 bg-celestial-panel px-4 py-2 text-sm text-celestial-softGold hover:bg-celestial-panelHover"
                onClick={onClose}
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={saving}
                className="action-button rounded-2xl px-4 py-2 text-sm disabled:opacity-60"
              >
                {saving ? "保存中..." : "保存する"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
