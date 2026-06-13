import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import type { Concept } from "../types/concept";
import { getStorage } from "../storage";
import { shortDateTime } from "../utils/date";
import { StatusBadge } from "./StatusBadge";
import { OrnamentLine } from "./common/OrnamentLine";

const storage = getStorage();

const decorUrl = (path: string): string =>
  `${import.meta.env.BASE_URL}${path.replace(/^\/+/, "")}`;

type Props = {
  concept?: Concept;
  conceptMap: Map<string, Concept>;
  domainColorMap: Record<string, string>;
  conceptQuizStatsText?: string;
  onSelectRelated: (id: string) => void;
  onEdit?: (concept: Concept) => void;
  onToggleFavorite?: (concept: Concept) => void;
  onRequestDelete: (concept: Concept) => void;
  deleting: boolean;
};

const ConceptMediaGallery = ({ concept }: { concept: Concept }) => {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const revokeRef = useRef<string[]>([]);
  const idKey = useMemo(
    () =>
      [...(concept.media ?? [])]
        .map((m) => m.id)
        .sort()
        .join(","),
    [concept.media]
  );

  useEffect(() => {
    revokeRef.current.forEach((u) => URL.revokeObjectURL(u));
    revokeRef.current = [];
    let cancelled = false;
    const load = async () => {
      const next: Record<string, string> = {};
      const sorted = [...(concept.media ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
      for (const ref of sorted) {
        const blob = await storage.getMediaBlob(ref.id);
        if (cancelled || !blob) {
          continue;
        }
        const u = URL.createObjectURL(blob);
        revokeRef.current.push(u);
        next[ref.id] = u;
      }
      if (!cancelled) {
        setUrls(next);
      }
    };
    void load();
    return () => {
      cancelled = true;
      revokeRef.current.forEach((u) => URL.revokeObjectURL(u));
      revokeRef.current = [];
    };
  }, [concept.id, idKey]);

  const sorted = [...(concept.media ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  if (sorted.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-nordic-textMuted">添付メディア</h3>
      <ul className="space-y-3">
        {sorted.map((ref) => (
            <li key={ref.id} className="detail-media-item">
            {ref.caption && <p className="mb-1 text-xs text-nordic-textSecondary">{ref.caption}</p>}
            <p className="mb-1 text-xs text-nordic-textMuted">{ref.fileName}</p>
            {ref.kind === "image" && urls[ref.id] ? (
              <img src={urls[ref.id]} alt={ref.caption ?? ref.fileName} className="max-h-64 w-full rounded object-contain" />
            ) : ref.kind === "video" && urls[ref.id] ? (
              <video src={urls[ref.id]} controls className="max-h-72 w-full rounded bg-black" playsInline />
            ) : (
              <p className="text-xs text-nordic-textMuted">読み込み中…</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export const ConceptDetail = forwardRef<HTMLDivElement, Props>(({
  concept,
  conceptMap,
  domainColorMap: _domainColorMap,
  conceptQuizStatsText,
  onSelectRelated,
  onEdit,
  onToggleFavorite,
  onRequestDelete,
  deleting
}, ref) => {
  if (!concept) {
    return (
      <section className="concept-detail-panel concept-detail-empty max-w-[min(100%,760px)] rounded-xl border border-nordic-border p-8">
        <img
          src={decorUrl("decorations/cup.png")}
          alt=""
          aria-hidden="true"
          className="study-empty-image"
          width={220}
          height={220}
        />
        <p className="max-w-sm text-sm leading-relaxed text-nordic-textSecondary">
          左の一覧から概念を選ぶと、定義・メモ・関連がこの紙面に現れます。
        </p>
      </section>
    );
  }

  const contextDefinitions = (concept.contextDefinitions ?? []).filter((item) => {
    const context = (item.context ?? "").trim();
    const definition = (item.definition ?? "").trim();
    return context !== "" || definition !== "";
  });

  return (
    <section
      ref={ref}
      className="concept-detail-panel max-w-[min(100%,760px)] space-y-5 rounded-xl border border-nordic-border p-6"
    >
      <OrnamentLine variant="panel" />
      <header className="hud-detail-heading flex flex-wrap items-center gap-2">
        <h2 className="text-xl font-semibold text-nordic-textPrimary">{concept.title}</h2>
        {concept.favorite && (
          <span className="text-xs text-nordic-textSecondary">お気に入り</span>
        )}
        <StatusBadge status={concept.status} />
      </header>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(concept)}
              className="detail-action-button"
            >
              編集
            </button>
          )}
          {onToggleFavorite && (
            <button
              type="button"
              onClick={() => onToggleFavorite(concept)}
              className="detail-action-button"
            >
              {concept.favorite ? "お気に入り解除" : "お気に入り"}
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => onRequestDelete(concept)}
          disabled={deleting}
          className="detail-delete-button"
        >
          {deleting ? "削除中..." : "削除"}
        </button>
      </div>

      {conceptQuizStatsText && (
        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-nordic-textMuted">学習状況</h3>
          <p className="text-sm text-nordic-textSecondary">{conceptQuizStatsText}</p>
        </div>
      )}

      <ConceptMediaGallery concept={concept} />

      <article className="mx-auto max-w-[min(100%,760px)] space-y-4 text-nordic-textPrimary">
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-nordic-textMuted">定義</h3>
          <p className="whitespace-pre-wrap break-words text-base leading-7">
            {concept.definition || <span className="concept-detail-muted">未入力</span>}
          </p>
        </div>
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-nordic-textMuted">自分の解釈</h3>
          <p className="whitespace-pre-wrap break-words text-base leading-7">
            {concept.myInterpretation || <span className="concept-detail-muted">未入力</span>}
          </p>
        </div>
        {contextDefinitions.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-nordic-textMuted">文脈別定義</h3>
            <div className="space-y-3">
              {contextDefinitions.map((ctxDef) => (
                <div key={ctxDef.id} className="detail-context-block">
                  <h4 className="mb-1 text-sm font-medium text-nordic-textPrimary">
                    {ctxDef.context.trim() || <span className="concept-detail-muted">文脈未指定</span>}
                  </h4>
                  <p className="whitespace-pre-wrap break-words text-sm leading-6 text-nordic-textSecondary">
                    {ctxDef.definition.trim() || <span className="concept-detail-muted">定義未入力</span>}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-nordic-textMuted">メモ</h3>
          <p className="whitespace-pre-wrap break-words text-base leading-7">
            {concept.notes || <span className="concept-detail-muted">未入力</span>}
          </p>
        </div>
      </article>

      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-nordic-textMuted">分野タグ</h3>
        <div className="flex flex-wrap gap-1">
          {concept.domainTags.length === 0 ? (
            <span className="text-sm text-nordic-textMuted">なし</span>
          ) : (
            concept.domainTags.map((tag) => (
              <span key={tag} className="detail-inline-tag">
                {tag}
              </span>
            ))
          )}
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-nordic-textMuted">
          研究テーマタグ
        </h3>
        <div className="flex flex-wrap gap-1">
          {concept.researchTags.length === 0 ? (
            <span className="text-sm text-nordic-textMuted">なし</span>
          ) : (
            concept.researchTags.map((tag) => (
              <span key={tag} className="detail-inline-tag">
                {tag}
              </span>
            ))
          )}
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-nordic-textMuted">関連概念</h3>
        {concept.relatedIds.length === 0 ? (
          <p className="text-sm text-nordic-textMuted">関連概念なし</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {concept.relatedIds.map((relatedId) => {
              const related = conceptMap.get(relatedId);
              if (!related) {
                return (
                  <li
                    key={relatedId}
                    className="text-xs text-amber-800"
                  >
                    不明なID: {relatedId}
                  </li>
                );
              }
              return (
                <li key={relatedId}>
                  <button
                    className="detail-related-link"
                    onClick={() => onSelectRelated(relatedId)}
                    type="button"
                  >
                    {related.title}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="detail-meta-block">
        <p>
          出典: {concept.source.book || <span className="concept-detail-muted">未入力</span>} / p.
          {concept.source.page || "-"} / {concept.source.author || <span className="concept-detail-muted">著者未入力</span>}
        </p>
        <p>作成: {shortDateTime(concept.createdAt)}</p>
        <p>更新: {shortDateTime(concept.updatedAt)}</p>
      </div>
    </section>
  );
});
