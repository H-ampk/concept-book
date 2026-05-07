import { useEffect, useState, type FormEvent } from "react";
import type { ContextCard, ContextCardInput } from "../types/contextCard";
import { createEmptyContextCardInput } from "../types/contextCard";

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
  }, [open, mode, baseContextCard]);

  if (!open) {
    return null;
  }

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

        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <form className="space-y-4" onSubmit={handleSubmit}>
            {error && (
              <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-celestial-softGold">タイトル</label>
              <input
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

            <div>
              <label className="mb-1 block text-sm font-medium text-celestial-softGold">重要概念</label>
              <textarea
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
                className="rounded-2xl bg-celestial-gold px-4 py-2 text-sm text-celestial-base hover:bg-celestial-softGold disabled:opacity-60"
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
