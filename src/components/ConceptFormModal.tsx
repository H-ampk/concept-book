import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { conceptStatusList, createEmptyConceptInput, type Concept, type ConceptInput } from "../types/concept";
import type { ConceptMediaRef } from "../types/media";
import { getStorage } from "../storage";
import { RelatedConceptPicker } from "./RelatedConceptPicker";

const storage = getStorage();

type Props = {
  open: boolean;
  mode: "create" | "edit";
  baseConcept?: Concept;
  allConcepts: Concept[];
  onClose: () => void;
  /** 保存した概念を返す（新規作成時は addMedia 用）。編集時は更新後の概念。 */
  onSubmit: (payload: ConceptInput) => Promise<Concept | undefined>;
  /** メディア追加・削除後に一覧を再読込 */
  reloadConcepts?: () => Promise<void>;
};

const joinCsv = (items: string[]): string => items.join(", ");
const splitCsv = (value: string): string[] =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

type PendingMedia = {
  file: File;
  caption: string;
  objectUrl: string;
};

export const ConceptFormModal = ({
  open,
  mode,
  baseConcept,
  allConcepts,
  onClose,
  onSubmit,
  reloadConcepts
}: Props) => {
  const [form, setForm] = useState<ConceptInput>(createEmptyConceptInput());
  const [domainTagInput, setDomainTagInput] = useState("");
  const [researchTagInput, setResearchTagInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingMedia, setPendingMedia] = useState<PendingMedia[]>([]);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const previewRevokeRef = useRef<string[]>([]);
  const definitionTextareaRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    if (!open) {
      return;
    }
    const el = definitionTextareaRef.current;
    if (!el) {
      return;
    }
    const minPx = 200;
    el.style.height = "auto";
    el.style.height = `${Math.max(minPx, el.scrollHeight)}px`;
  }, [form.definition, open]);

  const mediaIdKey = useMemo(
    () =>
      [...(form.media ?? [])]
        .map((m) => m.id)
        .sort()
        .join(","),
    [form.media]
  );

  const tagsState = useMemo(
    () => [...splitCsv(domainTagInput), ...splitCsv(researchTagInput)],
    [domainTagInput, researchTagInput]
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    setPendingMedia((prev) => {
      prev.forEach((p) => URL.revokeObjectURL(p.objectUrl));
      return [];
    });
    if (mode === "edit" && baseConcept) {
      setForm({
        title: baseConcept.title,
        definition: baseConcept.definition,
        myInterpretation: baseConcept.myInterpretation,
        domainTags: baseConcept.domainTags,
        researchTags: baseConcept.researchTags,
        relatedIds: baseConcept.relatedIds,
        media: baseConcept.media ?? [],
        source: baseConcept.source,
        notes: baseConcept.notes,
        status: baseConcept.status,
        favorite: baseConcept.favorite
      });
      setDomainTagInput(joinCsv(baseConcept.domainTags));
      setResearchTagInput(joinCsv(baseConcept.researchTags));
    } else {
      const empty = createEmptyConceptInput();
      setForm(empty);
      setDomainTagInput("");
      setResearchTagInput("");
    }
    setError(null);
  }, [open, mode, baseConcept]);

  useEffect(() => {
    previewRevokeRef.current.forEach((u) => URL.revokeObjectURL(u));
    previewRevokeRef.current = [];

    if (!open || mode !== "edit" || !baseConcept?.id) {
      setPreviewUrls({});
      return;
    }

    let cancelled = false;
    const load = async () => {
      const next: Record<string, string> = {};
      for (const ref of form.media ?? []) {
        const blob = await storage.getMediaBlob(ref.id);
        if (cancelled || !blob) {
          continue;
        }
        const url = URL.createObjectURL(blob);
        previewRevokeRef.current.push(url);
        next[ref.id] = url;
      }
      if (!cancelled) {
        setPreviewUrls(next);
      }
    };
    void load();
    return () => {
      cancelled = true;
      previewRevokeRef.current.forEach((u) => URL.revokeObjectURL(u));
      previewRevokeRef.current = [];
    };
  }, [open, mode, baseConcept?.id, mediaIdKey]);

  const syncFormMedia = async () => {
    if (!baseConcept?.id) {
      return;
    }
    const fresh = await storage.getConceptById(baseConcept.id);
    if (fresh) {
      setForm((prev) => ({ ...prev, media: fresh.media ?? [] }));
    }
  };

  const handleAddFiles = async (fileList: FileList | null) => {
    if (!fileList?.length) {
      return;
    }
    const files = [...fileList];
    for (const file of files) {
      try {
        if (mode === "edit" && baseConcept?.id) {
          await storage.addMedia({ conceptId: baseConcept.id, file });
          await syncFormMedia();
          await reloadConcepts?.();
        } else {
          const objectUrl = URL.createObjectURL(file);
          setPendingMedia((prev) => [...prev, { file, caption: "", objectUrl }]);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "メディアの追加に失敗しました。");
      }
    }
  };

  const removeSavedMedia = async (mediaId: string) => {
    try {
      await storage.deleteMedia(mediaId);
      await syncFormMedia();
      await reloadConcepts?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "削除に失敗しました。");
    }
  };

  const removePendingAt = (index: number) => {
    setPendingMedia((prev) => {
      const next = [...prev];
      const [removed] = next.splice(index, 1);
      if (removed) {
        URL.revokeObjectURL(removed.objectUrl);
      }
      return next;
    });
  };

  const updatePendingCaption = (index: number, caption: string) => {
    setPendingMedia((prev) => {
      const next = [...prev];
      if (next[index]) {
        next[index] = { ...next[index], caption };
      }
      return next;
    });
  };

  const updateSavedCaption = async (mediaId: string, caption: string) => {
    try {
      await storage.updateMediaCaption(mediaId, caption.trim() || undefined);
      await syncFormMedia();
      await reloadConcepts?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "キャプション更新に失敗しました。");
    }
  };

  const reorderMedia = async (index: number, delta: number) => {
    if (mode === "edit" && baseConcept?.id) {
      const list = [...(form.media ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
      const j = index + delta;
      if (j < 0 || j >= list.length) {
        return;
      }
      const swapped = [...list];
      [swapped[index], swapped[j]] = [swapped[j], swapped[index]];
      const reordered: ConceptMediaRef[] = swapped.map((r, i) => ({ ...r, sortOrder: i }));
      await storage.updateConcept(baseConcept.id, { media: reordered });
      await syncFormMedia();
      await reloadConcepts?.();
      return;
    }
    setPendingMedia((prev) => {
      const list = [...prev];
      const j = index + delta;
      if (j < 0 || j >= list.length) {
        return prev;
      }
      [list[index], list[j]] = [list[j], list[index]];
      return list;
    });
  };

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
      media: mode === "create" ? [] : form.media ?? [],
      source: {
        book: form.source.book.trim(),
        page: form.source.page.trim(),
        author: form.source.author?.trim() || null
      }
    };

    setSubmitting(true);
    setError(null);
    try {
      const saved = await onSubmit(payload);
      if (saved?.id && pendingMedia.length > 0) {
        for (const p of pendingMedia) {
          await storage.addMedia({
            conceptId: saved.id,
            file: p.file,
            caption: p.caption.trim() || undefined
          });
        }
        pendingMedia.forEach((p) => URL.revokeObjectURL(p.objectUrl));
        setPendingMedia([]);
        await reloadConcepts?.();
      }
      onClose();
    } catch {
      setError("保存に失敗しました。");
    } finally {
      setSubmitting(false);
    }
  };

  const savedMediaSorted = [...(form.media ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4">
      <form className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-[#0B2D49] p-5 shadow-xl border border-[#C89B5C]/45" onSubmit={handleSubmit}>
        <header className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#F4E8D0]">
            {mode === "create" ? "新しい概念" : "概念を編集"}
          </h2>
          <button className="rounded-md px-2 py-1 text-sm text-[#E0C58B] hover:bg-[#C89B5C]/18 transition-colors" onClick={onClose} type="button">
            閉じる
          </button>
        </header>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="md:col-span-2">
            <span className="mb-1 block text-sm text-[#F4E8D0]">タイトル *</span>
            <input
              className="w-full rounded-md border border-[#C89B5C]/45 bg-[#061A2D] px-3 py-2 text-sm text-[#F4E8D0] placeholder:text-[#B9C7D1]"
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            />
          </label>

          <label className="md:col-span-2">
            <span className="mb-1 block text-sm text-[#F4E8D0]">定義</span>
            <textarea
              ref={definitionTextareaRef}
              className="min-h-[200px] w-full resize-none overflow-hidden rounded-md border border-[#C89B5C]/45 bg-[#061A2D] px-3 py-2 text-sm text-[#F4E8D0] placeholder:text-[#B9C7D1]"
              value={form.definition}
              onChange={(e) => setForm((prev) => ({ ...prev, definition: e.target.value }))}
            />
          </label>

          <label className="md:col-span-2">
            <span className="mb-1 block text-sm text-[#F4E8D0]">自分の解釈</span>
            <textarea
              className="min-h-20 w-full rounded-md border border-[#C89B5C]/45 bg-[#061A2D] px-3 py-2 text-sm text-[#F4E8D0] placeholder:text-[#B9C7D1]"
              value={form.myInterpretation}
              onChange={(e) => setForm((prev) => ({ ...prev, myInterpretation: e.target.value }))}
            />
          </label>

          <label>
            <span className="mb-1 block text-sm text-[#F4E8D0]">分野タグ（カンマ区切り）</span>
            <input
              className="w-full rounded-md border border-[#C89B5C]/45 bg-[#061A2D] px-3 py-2 text-sm text-[#F4E8D0] placeholder:text-[#B9C7D1]"
              value={domainTagInput}
              onChange={(e) => setDomainTagInput(e.target.value)}
            />
          </label>

          <label>
            <span className="mb-1 block text-sm text-[#F4E8D0]">研究テーマタグ（カンマ区切り）</span>
            <input
              className="w-full rounded-md border border-[#C89B5C]/45 bg-[#061A2D] px-3 py-2 text-sm text-[#F4E8D0] placeholder:text-[#B9C7D1]"
              value={researchTagInput}
              onChange={(e) => setResearchTagInput(e.target.value)}
            />
          </label>

          <label>
            <span className="mb-1 block text-sm text-[#F4E8D0]">状態</span>
            <select
              className="w-full rounded-md border border-[#C89B5C]/45 bg-[#061A2D] px-3 py-2 text-sm text-[#F4E8D0]"
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

          <RelatedConceptPicker
            allConcepts={allConcepts}
            selectedIds={form.relatedIds}
            currentConceptId={baseConcept?.id}
            inputTitle={form.title}
            inputDefinition={form.definition}
            inputTags={tagsState}
            onChange={(nextIds) => setForm((prev) => ({ ...prev, relatedIds: nextIds }))}
          />

          <div className="md:col-span-2 rounded-lg border border-[#C89B5C]/30 bg-[#0A253C] p-3">
            <span className="mb-2 block text-sm font-medium text-[#F4E8D0]">画像・動画（png/jpg/jpeg/gif、mp4/webm・1ファイル最大20MB）</span>
            <p className="mb-2 text-xs text-[#B9C7D1]">
              新規作成では保存後にファイルがアップロードされます。別PCへは設定の「パッケージ（ZIP）」でエクスポートしてください。
            </p>
            <input
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/gif,video/mp4,video/webm,.png,.jpg,.jpeg,.gif,.mp4,.webm"
              multiple
              className="block w-full text-sm text-[#F4E8D0] file:mr-3 file:rounded-md file:border file:border-[#C89B5C]/45 file:bg-[#061A2D] file:px-3 file:py-1.5 file:text-[#E0C58B]"
              onChange={(e) => void handleAddFiles(e.target.files)}
            />

            {savedMediaSorted.length > 0 && (
              <ul className="mt-3 space-y-2">
                {savedMediaSorted.map((ref, index) => (
                  <li
                    key={ref.id}
                    className="flex flex-col gap-2 rounded-md border border-[#C89B5C]/30 bg-[#061A2D] p-2 sm:flex-row sm:items-start"
                  >
                    <div className="h-24 w-full shrink-0 overflow-hidden rounded bg-[#0A253C] sm:h-20 sm:w-28">
                      {ref.kind === "image" && previewUrls[ref.id] ? (
                        <img src={previewUrls[ref.id]} alt="" className="h-full w-full object-contain" />
                      ) : ref.kind === "video" && previewUrls[ref.id] ? (
                        <video src={previewUrls[ref.id]} className="h-full w-full object-contain" muted playsInline />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-[#B9C7D1]">読込中…</div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-[#F4E8D0]">{ref.fileName}</p>
                      <input
                        type="text"
                        className="mt-1 w-full rounded border border-[#C89B5C]/30 bg-[#061A2D] px-2 py-1 text-xs text-[#F4E8D0] placeholder:text-[#B9C7D1]"
                        placeholder="キャプション（任意）"
                        defaultValue={ref.caption ?? ""}
                        key={ref.id + (ref.caption ?? "")}
                        onBlur={(e) => {
                          if (e.target.value !== (ref.caption ?? "")) {
                            void updateSavedCaption(ref.id, e.target.value);
                          }
                        }}
                      />
                      <div className="mt-1 flex flex-wrap gap-1">
                        <button
                          type="button"
                          className="rounded border border-[#C89B5C]/45 px-2 py-0.5 text-xs text-[#E0C58B] hover:bg-[#C89B5C]/15 transition-colors"
                          onClick={() => void reorderMedia(index, -1)}
                        >
                          上へ
                        </button>
                        <button
                          type="button"
                          className="rounded border border-[#C89B5C]/45 px-2 py-0.5 text-xs text-[#E0C58B] hover:bg-[#C89B5C]/15 transition-colors"
                          onClick={() => void reorderMedia(index, 1)}
                        >
                          下へ
                        </button>
                        <button
                          type="button"
                          className="rounded border border-rose-300 bg-rose-50 px-2 py-0.5 text-xs text-rose-700 hover:bg-rose-100"
                          onClick={() => void removeSavedMedia(ref.id)}
                        >
                          削除
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {pendingMedia.length > 0 && (
              <ul className="mt-3 space-y-2 border-t border-[#C89B5C]/30 pt-2">
                <p className="text-xs text-[#B9C7D1]">保存待ち（新規作成）</p>
                {pendingMedia.map((p, index) => (
                  <li key={p.objectUrl} className="flex flex-col gap-2 rounded-md border border-[#C89B5C]/30 bg-[#061A2D] p-2 sm:flex-row">
                    <div className="h-24 w-full shrink-0 overflow-hidden rounded bg-[#0A253C] sm:h-20 sm:w-28">
                      {p.file.type.startsWith("video/") ? (
                        <video src={p.objectUrl} className="h-full w-full object-contain" muted playsInline />
                      ) : (
                        <img src={p.objectUrl} alt="" className="h-full w-full object-contain" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-[#F4E8D0]">{p.file.name}</p>
                      <input
                        type="text"
                        className="mt-1 w-full rounded border border-[#C89B5C]/30 bg-[#061A2D] px-2 py-1 text-xs text-[#F4E8D0] placeholder:text-[#B9C7D1]"
                        placeholder="キャプション（任意）"
                        value={p.caption}
                        onChange={(e) => updatePendingCaption(index, e.target.value)}
                      />
                      <div className="mt-1 flex gap-1">
                        <button
                          type="button"
                          className="rounded border border-[#C89B5C]/45 px-2 py-0.5 text-xs text-[#E0C58B] hover:bg-[#C89B5C]/15 transition-colors"
                          onClick={() => reorderMedia(index, -1)}
                        >
                          上へ
                        </button>
                        <button
                          type="button"
                          className="rounded border border-[#C89B5C]/45 px-2 py-0.5 text-xs text-[#E0C58B] hover:bg-[#C89B5C]/15 transition-colors"
                          onClick={() => reorderMedia(index, 1)}
                        >
                          下へ
                        </button>
                        <button
                          type="button"
                          className="rounded border border-rose-300 bg-rose-50 px-2 py-0.5 text-xs text-rose-700 hover:bg-rose-100"
                          onClick={() => removePendingAt(index)}
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

          <label className="md:col-span-2">
            <span className="mb-1 block text-sm text-[#F4E8D0]">メモ</span>
            <textarea
              className="min-h-24 w-full rounded-md border border-[#C89B5C]/45 bg-[#061A2D] px-3 py-2 text-sm text-[#F4E8D0] placeholder:text-[#B9C7D1]"
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
            />
          </label>

          <label>
            <span className="mb-1 block text-sm text-[#F4E8D0]">出典（書籍）</span>
            <input
              className="w-full rounded-md border border-[#C89B5C]/45 bg-[#061A2D] px-3 py-2 text-sm text-[#F4E8D0] placeholder:text-[#B9C7D1]"
              value={form.source.book}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, source: { ...prev.source, book: e.target.value } }))
              }
            />
          </label>
          <label>
            <span className="mb-1 block text-sm text-[#F4E8D0]">ページ</span>
            <input
              className="w-full rounded-md border border-[#C89B5C]/45 bg-[#061A2D] px-3 py-2 text-sm text-[#F4E8D0] placeholder:text-[#B9C7D1]"
              value={form.source.page}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, source: { ...prev.source, page: e.target.value } }))
              }
            />
          </label>
          <label className="md:col-span-2">
            <span className="mb-1 block text-sm text-[#F4E8D0]">著者</span>
            <input
              className="w-full rounded-md border border-[#C89B5C]/45 bg-[#061A2D] px-3 py-2 text-sm text-[#F4E8D0] placeholder:text-[#B9C7D1]"
              value={form.source.author ?? ""}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, source: { ...prev.source, author: e.target.value } }))
              }
            />
          </label>
        </div>

        <label className="mt-3 flex items-center gap-2 text-sm text-[#F4E8D0]">
          <input
            type="checkbox"
            checked={form.favorite}
            onChange={(e) => setForm((prev) => ({ ...prev, favorite: e.target.checked }))}
          />
          お気に入りにする
        </label>

        {error && <p className="mt-3 rounded-md bg-[#2D1B1B] border border-[#C89B5C]/30 px-3 py-2 text-sm text-[#F4E8D0]">{error}</p>}

        <footer className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-md border border-[#C89B5C]/45 px-3 py-2 text-sm text-[#E0C58B] hover:bg-[#C89B5C]/15 transition-colors"
            onClick={onClose}
          >
            キャンセル
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-[#C89B5C] px-3 py-2 text-sm text-[#061A2D] hover:bg-[#E0C58B] disabled:opacity-70 transition-colors"
          >
            {submitting ? "保存中..." : "保存"}
          </button>
        </footer>
      </form>
    </div>
  );
};
