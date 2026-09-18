import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  conceptStatusList,
  createEmptyConceptInput,
  type Concept,
  type ConceptInput
} from "../types/concept";
import { createConceptInputFromTitle } from "../utils/bulkRelatedConcepts";
import { getConceptByTitleExact } from "../utils/conceptLookupMaps";
import {
  addContextDefinitionsFromFieldTags,
  hasAddableContextDefinitionsFromFieldTags,
} from "../utils/addContextDefinitionsFromFieldTags";
import { normalizeConceptTitle } from "../utils/normalizeConceptTitle";
import type { ConceptMediaDraftItem, ConceptMediaRef } from "../types/media";
import { getStorage } from "../storage";
import {
  MAX_MEDIA_FILES_PER_CONCEPT,
  validateMediaFile
} from "../utils/mediaConstraints";
import { revokeNewMediaObjectUrls } from "../utils/conceptMediaDraft";
import { RelatedConceptPicker } from "./RelatedConceptPicker";
import { PrerequisiteConceptPicker } from "./PrerequisiteConceptPicker";
import {
  buildConceptPrerequisiteIndex,
  collectReachableDependentIds
} from "../utils/conceptPrerequisites";

const storage = getStorage();

type Props = {
  open: boolean;
  mode: "create" | "edit";
  baseConcept?: Concept;
  allConcepts: Concept[];
  /** 正規化タイトル参照（先頭出現のみ）。一括追加で使用 */
  conceptTitleIndex: Map<string, Concept>;
  onClose: () => void;
  onSubmit: (
    payload: ConceptInput,
    options?: { statusExplicitlySet?: boolean },
    mediaDraft?: ConceptMediaDraftItem[]
  ) => Promise<Concept | undefined>;
  /** 関連概念の一括作成後に一覧を再読込 */
  reloadConcepts?: () => Promise<void>;
  mutationDisabled?: boolean;
};

const joinCsv = (items: string[]): string => items.join(", ");
const splitCsv = (value: string): string[] =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const toExistingDraftItems = (media: ConceptMediaRef[] | undefined): ConceptMediaDraftItem[] =>
  [...(media ?? [])]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((ref) => ({
      type: "existing" as const,
      mediaId: ref.id,
      kind: ref.kind,
      fileName: ref.fileName,
      caption: ref.caption
    }));

export const ConceptFormModal = ({
  open,
  mode,
  baseConcept,
  allConcepts,
  conceptTitleIndex,
  onClose,
  onSubmit,
  reloadConcepts,
  mutationDisabled = false
}: Props) => {
  const [form, setForm] = useState<ConceptInput>(createEmptyConceptInput());
  const [domainTagInput, setDomainTagInput] = useState("");
  const [researchTagInput, setResearchTagInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contextDefFeedback, setContextDefFeedback] = useState<string | null>(null);
  const [statusTouched, setStatusTouched] = useState(false);
  const [mediaDraft, setMediaDraft] = useState<ConceptMediaDraftItem[]>([]);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const previewRevokeRef = useRef<string[]>([]);
  const mediaDraftRef = useRef<ConceptMediaDraftItem[]>([]);
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
      mediaDraft
        .filter((item): item is Extract<ConceptMediaDraftItem, { type: "existing" }> => item.type === "existing")
        .map((item) => item.mediaId)
        .join(","),
    [mediaDraft]
  );

  const tagsState = useMemo(
    () => [...splitCsv(domainTagInput), ...splitCsv(researchTagInput)],
    [domainTagInput, researchTagInput]
  );

  const canAddContextDefsFromFieldTags = useMemo(
    () => hasAddableContextDefinitionsFromFieldTags(domainTagInput, form.contextDefinitions ?? []),
    [domainTagInput, form.contextDefinitions]
  );

  const forbiddenPrerequisiteIds = useMemo(() => {
    const selfId = baseConcept?.id;
    if (!selfId) {
      return new Set<string>();
    }
    const prospective = allConcepts.map((concept) =>
      concept.id === selfId ? { ...concept, prerequisiteIds: form.prerequisiteIds } : concept
    );
    const index = buildConceptPrerequisiteIndex(prospective);
    return collectReachableDependentIds(index, selfId);
  }, [allConcepts, baseConcept?.id, form.prerequisiteIds]);

  useEffect(() => {
    mediaDraftRef.current = mediaDraft;
  }, [mediaDraft]);

  useEffect(() => {
    if (!open) {
      return;
    }
    revokeNewMediaObjectUrls(mediaDraftRef.current);
    setMediaDraft(mode === "edit" && baseConcept ? toExistingDraftItems(baseConcept.media) : []);
    setStatusTouched(false);
    if (mode === "edit" && baseConcept) {
      setForm({
        title: baseConcept.title,
        definition: baseConcept.definition,
        myInterpretation: baseConcept.myInterpretation,
        domainTags: baseConcept.domainTags,
        researchTags: baseConcept.researchTags,
        relatedIds: baseConcept.relatedIds,
        prerequisiteIds: baseConcept.prerequisiteIds,
        media: baseConcept.media ?? [],
        source: baseConcept.source,
        notes: baseConcept.notes,
        status: baseConcept.status,
        favorite: baseConcept.favorite,
        contextDefinitions: baseConcept.contextDefinitions ?? [],
        sourceContextCardId: baseConcept.sourceContextCardId,
        autoGenerated: baseConcept.autoGenerated,
        sourceContextCardTermKey: baseConcept.sourceContextCardTermKey
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
    setContextDefFeedback(null);
  }, [open, mode, baseConcept]);

  useEffect(() => {
    return () => {
      revokeNewMediaObjectUrls(mediaDraftRef.current);
      previewRevokeRef.current.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

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
      const existingIds = mediaIdKey ? mediaIdKey.split(",").filter(Boolean) : [];
      for (const mediaId of existingIds) {
        const blob = await storage.getMediaBlob(mediaId);
        if (cancelled || !blob) {
          continue;
        }
        const url = URL.createObjectURL(blob);
        previewRevokeRef.current.push(url);
        next[mediaId] = url;
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

  const requestClose = () => {
    if (submitting) {
      return;
    }
    revokeNewMediaObjectUrls(mediaDraft);
    setMediaDraft([]);
    onClose();
  };

  const handleAddFiles = (fileList: FileList | null) => {
    if (submitting || !fileList?.length) {
      return;
    }
    const files = [...fileList];
    const additions: ConceptMediaDraftItem[] = [];
    let nextCount = mediaDraft.length;
    for (const file of files) {
      if (nextCount >= MAX_MEDIA_FILES_PER_CONCEPT) {
        setError(`1概念あたり最大 ${MAX_MEDIA_FILES_PER_CONCEPT} 件までです。`);
        break;
      }
      const validated = validateMediaFile(file);
      if (!validated.ok) {
        setError(validated.message);
        continue;
      }
      additions.push({
        type: "new",
        clientId: crypto.randomUUID(),
        file,
        kind: validated.kind,
        fileName: file.name,
        caption: "",
        objectUrl: URL.createObjectURL(file)
      });
      nextCount += 1;
    }
    if (additions.length > 0) {
      setMediaDraft((prev) => [...prev, ...additions]);
    }
  };

  const removeDraftAt = (index: number) => {
    if (submitting) {
      return;
    }
    setMediaDraft((prev) => {
      const next = [...prev];
      const [removed] = next.splice(index, 1);
      if (removed?.type === "new") {
        URL.revokeObjectURL(removed.objectUrl);
      }
      return next;
    });
  };

  const updateDraftCaption = (index: number, caption: string) => {
    if (submitting) {
      return;
    }
    setMediaDraft((prev) => {
      const next = [...prev];
      const item = next[index];
      if (!item) {
        return prev;
      }
      next[index] = { ...item, caption };
      return next;
    });
  };

  const reorderDraft = (index: number, delta: number) => {
    if (submitting) {
      return;
    }
    setMediaDraft((prev) => {
      const j = index + delta;
      if (j < 0 || j >= prev.length) {
        return prev;
      }
      const next = [...prev];
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  };

  const handleAddBulkRelatedConcepts = async (titles: string[]): Promise<{ message: string }> => {
    if (mutationDisabled) {
      return {
        message: "概念データを再読み込みしてから関連概念を追加してください。"
      };
    }
    if (titles.length === 0) {
      return { message: "追加する項目がありませんでした。" };
    }

    const selfTitle = form.title;
    const currentId = baseConcept?.id;

    let linked = 0;
    let createdConceptCount = 0;
    let skippedDuplicate = 0;
    let skippedSelf = 0;

    const newLinkIds: string[] = [];
    const provisionalSeen = new Set(form.relatedIds);

    const titleLookup = new Map(conceptTitleIndex);

    for (const title of titles) {
      if (normalizeConceptTitle(title) === normalizeConceptTitle(selfTitle)) {
        skippedSelf += 1;
        continue;
      }

      const match = getConceptByTitleExact(titleLookup, title);
      if (match && currentId && match.id === currentId) {
        skippedSelf += 1;
        continue;
      }

      let targetId: string | undefined;
      if (match) {
        targetId = match.id;
      } else {
        const created = await storage.createConcept(createConceptInputFromTitle(title));
        createdConceptCount += 1;
        targetId = created.id;
        titleLookup.set(normalizeConceptTitle(created.title), created);
      }

      if (!targetId) {
        continue;
      }
      if (provisionalSeen.has(targetId)) {
        skippedDuplicate += 1;
        continue;
      }

      newLinkIds.push(targetId);
      provisionalSeen.add(targetId);
      linked += 1;
    }

    setForm((prev) => {
      const merged = [...prev.relatedIds];
      const seen = new Set(merged);
      for (const id of newLinkIds) {
        if (seen.has(id)) {
          continue;
        }
        merged.push(id);
        seen.add(id);
      }
      return { ...prev, relatedIds: merged };
    });
    await reloadConcepts?.();

    const sentences: string[] = [];
    if (linked > 0) {
      sentences.push(`${linked}件の関連概念を追加しました`);
    }
    if (createdConceptCount > 0) {
      sentences.push(`新規概念を${createdConceptCount}件作成しました`);
    }
    if (skippedDuplicate > 0) {
      sentences.push(`${skippedDuplicate}件は既に関連付け済みのためスキップしました`);
    }
    if (skippedSelf > 0) {
      sentences.push(`${skippedSelf}件は自身の概念のためスキップしました`);
    }
    if (sentences.length === 0) {
      return { message: "追加する項目がありませんでした。" };
    }
    return { message: sentences.join(" ") };
  };

  const handleAddContextDefinitionsFromFieldTags = () => {
    try {
      const result = addContextDefinitionsFromFieldTags(
        domainTagInput,
        form.contextDefinitions ?? []
      );

      if (result.kind === "added") {
        setForm((prev) => ({
          ...prev,
          contextDefinitions: [
            ...(prev.contextDefinitions ?? []),
            ...result.newDefinitions,
          ],
        }));
      }

      setContextDefFeedback(result.message);
    } catch {
      setContextDefFeedback("文脈別定義の追加に失敗しました。");
    }
  };

  if (!open) {
    return null;
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting || mutationDisabled) {
      return;
    }
    if (!form.title.trim()) {
      setError("タイトルは必須です。");
      return;
    }

    const cleanContextDefinitions = (form.contextDefinitions ?? [])
      .map(item => ({
        id: item.id,
        context: (item.context ?? "").trim(),
        definition: (item.definition ?? "").trim(),
      }))
      .filter(item => item.context !== "" || item.definition !== "");

    const payload: ConceptInput = {
      ...form,
      title: form.title.trim(),
      domainTags: splitCsv(domainTagInput),
      researchTags: splitCsv(researchTagInput),
      media: [],
      contextDefinitions: cleanContextDefinitions,
      source: {
        book: form.source.book.trim(),
        page: form.source.page.trim(),
        author: form.source.author?.trim() || null
      }
    };

    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(payload, { statusExplicitlySet: statusTouched }, mediaDraft);
      revokeNewMediaObjectUrls(mediaDraft);
      setMediaDraft([]);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました。");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-nordic-overlay px-4">
      <form className="max-h-[90vh] w-full max-w-2xl overflow-y-auto scrollbar-none rounded-2xl bg-celestial-panel p-5 shadow-xl border border-celestial-border" onSubmit={handleSubmit}>
        <header className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-celestial-textMain">
            {mode === "create" ? "新しい概念" : "概念を編集"}
          </h2>
          <button className="rounded-md px-2 py-1 text-sm text-celestial-softGold hover:bg-celestial-gold/10 transition-colors disabled:cursor-not-allowed disabled:opacity-50" onClick={requestClose} type="button" disabled={submitting}>
            閉じる
          </button>
        </header>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="md:col-span-2">
            <span className="mb-1 block text-sm text-celestial-textMain">タイトル *</span>
            <input
              className="w-full rounded-md border border-celestial-border bg-celestial-deepBlue px-3 py-2 text-sm text-celestial-textMain placeholder:text-celestial-textSub"
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            />
          </label>

          <label className="md:col-span-2">
            <span className="mb-1 block text-sm text-celestial-textMain">定義</span>
            <textarea
              ref={definitionTextareaRef}
              className="min-h-[200px] w-full resize-none overflow-hidden rounded-md border border-celestial-border bg-celestial-deepBlue px-3 py-2 text-sm text-celestial-textMain placeholder:text-celestial-textSub"
              value={form.definition}
              onChange={(e) => setForm((prev) => ({ ...prev, definition: e.target.value }))}
            />
          </label>

          <label className="md:col-span-2">
            <span className="mb-1 block text-sm text-celestial-textMain">自分の解釈</span>
            <textarea
              className="min-h-20 w-full rounded-md border border-celestial-border bg-celestial-deepBlue px-3 py-2 text-sm text-celestial-textMain placeholder:text-celestial-textSub"
              value={form.myInterpretation}
              onChange={(e) => setForm((prev) => ({ ...prev, myInterpretation: e.target.value }))}
            />
          </label>

          <div className="md:col-span-2">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-celestial-textMain">文脈別定義</span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-md border border-celestial-gold/40 px-2 py-1 text-xs text-celestial-softGold hover:bg-celestial-gold/10 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!canAddContextDefsFromFieldTags}
                  onClick={handleAddContextDefinitionsFromFieldTags}
                >
                  分野タグから文脈別定義を追加
                </button>
                <button
                  type="button"
                  className="action-button rounded-md px-2 py-1 text-xs"
                  onClick={() => setForm((prev) => ({
                    ...prev,
                    contextDefinitions: [
                      ...(prev.contextDefinitions ?? []),
                      {
                        id: crypto.randomUUID(),
                        context: "",
                        definition: "",
                      },
                    ],
                  }))}
                >
                  ＋ 文脈別定義を追加
                </button>
              </div>
            </div>
            {contextDefFeedback && (
              <p className="mb-2 text-xs text-celestial-softGold">{contextDefFeedback}</p>
            )}
            {(form.contextDefinitions ?? []).length > 0 && (
              <div className="space-y-3">
                {(form.contextDefinitions ?? []).map((ctxDef, index) => (
                  <div key={ctxDef.id} className="rounded-lg border border-celestial-gold/25 bg-celestial-deepBlue p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-medium text-celestial-textMain">文脈 {index + 1}</span>
                      <button
                        type="button"
                        className="rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs text-red-300 hover:bg-red-500/20 transition-colors"
                        onClick={() => setForm((prev) => ({
                          ...prev,
                          contextDefinitions: (prev.contextDefinitions ?? []).filter(item => item.id !== ctxDef.id),
                        }))}
                      >
                        削除
                      </button>
                    </div>
                    <label className="mb-2 block">
                      <span className="mb-1 block text-xs text-celestial-textMain">文脈名</span>
                      <input
                        className="w-full rounded-md border border-celestial-border bg-celestial-deepBlue px-3 py-2 text-sm text-celestial-textMain placeholder:text-celestial-textSub"
                        placeholder="例: 情報理論、心理学、哲学、確率論"
                        value={ctxDef.context}
                        onChange={(e) => setForm((prev) => ({
                          ...prev,
                          contextDefinitions: (prev.contextDefinitions ?? []).map(item =>
                            item.id === ctxDef.id ? { ...item, context: e.target.value } : item
                          ),
                        }))}
                      />
                    </label>
                    <label>
                      <span className="mb-1 block text-xs text-celestial-textMain">この文脈での定義</span>
                      <textarea
                        className="min-h-16 w-full rounded-md border border-celestial-border bg-celestial-deepBlue px-3 py-2 text-sm text-celestial-textMain placeholder:text-celestial-textSub"
                        placeholder="この分野・文脈ではどういう意味で使うかを書く"
                        value={ctxDef.definition}
                        onChange={(e) => setForm((prev) => ({
                          ...prev,
                          contextDefinitions: (prev.contextDefinitions ?? []).map(item =>
                            item.id === ctxDef.id ? { ...item, definition: e.target.value } : item
                          ),
                        }))}
                      />
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>

          <label>
            <span className="mb-1 block text-sm text-celestial-textMain">分野タグ（カンマ区切り）</span>
            <input
              className="w-full rounded-md border border-celestial-border bg-celestial-deepBlue px-3 py-2 text-sm text-celestial-textMain placeholder:text-celestial-textSub"
              value={domainTagInput}
              onChange={(e) => setDomainTagInput(e.target.value)}
            />
          </label>

          <label>
            <span className="mb-1 block text-sm text-celestial-textMain">研究テーマタグ（カンマ区切り）</span>
            <input
              className="w-full rounded-md border border-celestial-border bg-celestial-deepBlue px-3 py-2 text-sm text-celestial-textMain placeholder:text-celestial-textSub"
              value={researchTagInput}
              onChange={(e) => setResearchTagInput(e.target.value)}
            />
          </label>

          <label>
            <span className="mb-1 block text-sm text-celestial-textMain">状態</span>
            <select
              className="w-full rounded-md border border-celestial-border bg-celestial-deepBlue px-3 py-2 text-sm text-celestial-textMain"
              value={form.status}
              onChange={(e) => {
                setStatusTouched(true);
                setForm((prev) => ({ ...prev, status: e.target.value as Concept["status"] }));
              }}
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
            inputMyInterpretation={form.myInterpretation}
            inputTags={tagsState}
            onChange={(nextIds) => setForm((prev) => ({ ...prev, relatedIds: nextIds }))}
            onBulkAddTitles={mutationDisabled ? undefined : handleAddBulkRelatedConcepts}
          />

          <PrerequisiteConceptPicker
            allConcepts={allConcepts}
            selectedIds={form.prerequisiteIds}
            currentConceptId={baseConcept?.id}
            forbiddenIds={forbiddenPrerequisiteIds}
            onChange={(nextIds) => setForm((prev) => ({ ...prev, prerequisiteIds: nextIds }))}
          />

          <div className="md:col-span-2 rounded-lg border border-celestial-gold/25 bg-celestial-deepBlue p-3">
            <span className="mb-2 block text-sm font-medium text-celestial-textMain">画像・動画（png/jpg/jpeg/gif、mp4/webm・1ファイル最大20MB）</span>
            <p className="mb-2 text-xs text-celestial-textSub">
              保存するまでメディアの追加・削除・並び替えは下書きです。キャンセルすると破棄されます。別PCへは設定の「パッケージ（ZIP）」でエクスポートしてください。
            </p>
            <input
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/gif,video/mp4,video/webm,.png,.jpg,.jpeg,.gif,.mp4,.webm"
              multiple
              disabled={submitting}
              className="block w-full text-sm text-celestial-textMain file:mr-3 file:rounded-md file:border file:border-celestial-border file:bg-celestial-deepBlue file:px-3 file:py-1.5 file:text-celestial-softGold"
              onChange={(e) => {
                handleAddFiles(e.target.files);
                e.currentTarget.value = "";
              }}
            />

            {mediaDraft.length > 0 && (
              <ul className="mt-3 space-y-2">
                {mediaDraft.map((item, index) => {
                  const previewSrc =
                    item.type === "new" ? item.objectUrl : previewUrls[item.mediaId];
                  const kind = item.type === "new" ? item.kind : item.kind;
                  const key = item.type === "new" ? item.clientId : item.mediaId;
                  return (
                    <li
                      key={key}
                      className="flex flex-col gap-2 rounded-md border border-celestial-gold/25 bg-celestial-deepBlue p-2 sm:flex-row sm:items-start"
                    >
                      <div className="h-24 w-full shrink-0 overflow-hidden rounded bg-celestial-deepBlue sm:h-20 sm:w-28">
                        {kind === "image" && previewSrc ? (
                          <img src={previewSrc} alt="" className="h-full w-full object-contain" />
                        ) : kind === "video" && previewSrc ? (
                          <video src={previewSrc} className="h-full w-full object-contain" muted playsInline />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs text-celestial-textSub">
                            {item.type === "existing" ? "読込中…" : "プレビュー"}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-celestial-textMain">{item.fileName}</p>
                        <input
                          type="text"
                          className="mt-1 w-full rounded border border-celestial-gold/25 bg-celestial-deepBlue px-2 py-1 text-xs text-celestial-textMain placeholder:text-celestial-textSub"
                          placeholder="キャプション（任意）"
                          value={item.caption ?? ""}
                          disabled={submitting}
                          onChange={(e) => updateDraftCaption(index, e.target.value)}
                        />
                        <div className="mt-1 flex flex-wrap gap-1">
                          <button
                            type="button"
                            disabled={submitting}
                            className="rounded border border-celestial-border px-2 py-0.5 text-xs text-celestial-softGold hover:bg-celestial-gold/12 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                            onClick={() => reorderDraft(index, -1)}
                          >
                            上へ
                          </button>
                          <button
                            type="button"
                            disabled={submitting}
                            className="rounded border border-celestial-border px-2 py-0.5 text-xs text-celestial-softGold hover:bg-celestial-gold/12 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                            onClick={() => reorderDraft(index, 1)}
                          >
                            下へ
                          </button>
                          <button
                            type="button"
                            disabled={submitting}
                            className="rounded border border-rose-300 bg-rose-50 px-2 py-0.5 text-xs text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                            onClick={() => removeDraftAt(index)}
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

          <label className="md:col-span-2">
            <span className="mb-1 block text-sm text-celestial-textMain">メモ</span>
            <textarea
              className="min-h-24 w-full rounded-md border border-celestial-border bg-celestial-deepBlue px-3 py-2 text-sm text-celestial-textMain placeholder:text-celestial-textSub"
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
            />
          </label>

          <label>
            <span className="mb-1 block text-sm text-celestial-textMain">出典（書籍）</span>
            <input
              className="w-full rounded-md border border-celestial-border bg-celestial-deepBlue px-3 py-2 text-sm text-celestial-textMain placeholder:text-celestial-textSub"
              value={form.source.book}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, source: { ...prev.source, book: e.target.value } }))
              }
            />
          </label>
          <label>
            <span className="mb-1 block text-sm text-celestial-textMain">ページ</span>
            <input
              className="w-full rounded-md border border-celestial-border bg-celestial-deepBlue px-3 py-2 text-sm text-celestial-textMain placeholder:text-celestial-textSub"
              value={form.source.page}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, source: { ...prev.source, page: e.target.value } }))
              }
            />
          </label>
          <label className="md:col-span-2">
            <span className="mb-1 block text-sm text-celestial-textMain">著者</span>
            <input
              className="w-full rounded-md border border-celestial-border bg-celestial-deepBlue px-3 py-2 text-sm text-celestial-textMain placeholder:text-celestial-textSub"
              value={form.source.author ?? ""}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, source: { ...prev.source, author: e.target.value } }))
              }
            />
          </label>
        </div>

        <label className="mt-3 flex items-center gap-2 text-sm text-celestial-textMain">
          <input
            type="checkbox"
            checked={form.favorite}
            onChange={(e) => setForm((prev) => ({ ...prev, favorite: e.target.checked }))}
          />
          お気に入りにする
        </label>

        {mutationDisabled && (
          <p
            role="alert"
            className="mt-3 rounded-md border border-amber-500/40 bg-amber-950/40 px-3 py-2 text-sm text-amber-100"
          >
            表示中の概念データが最新ではないため、再読み込みに成功するまで保存できません。
          </p>
        )}

        {error && <p className="mt-3 rounded-md border border-red-500/40 bg-red-950/50 px-3 py-2 text-sm text-red-100">{error}</p>}

        <footer className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-md border border-celestial-border px-3 py-2 text-sm text-celestial-softGold hover:bg-celestial-gold/12 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            onClick={requestClose}
            disabled={submitting}
          >
            キャンセル
          </button>
          <button
            type="submit"
            disabled={submitting || mutationDisabled}
            className="action-button rounded-md px-3 py-2 text-sm disabled:opacity-70"
          >
            {submitting ? "保存中..." : "保存"}
          </button>
        </footer>
      </form>
    </div>
  );
};
