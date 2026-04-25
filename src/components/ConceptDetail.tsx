import { useEffect, useMemo, useRef, useState } from "react";
import type { Concept } from "../types/concept";
import { getStorage } from "../storage";
import { shortDateTime } from "../utils/date";
import { colorToSoftTagStyle, getDomainTagColor } from "../utils/domainColors";
import { StatusBadge } from "./StatusBadge";

const storage = getStorage();

type Props = {
  concept?: Concept;
  conceptMap: Map<string, Concept>;
  domainColorMap: Record<string, string>;
  onSelectRelated: (id: string) => void;
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
      <h3 className="text-xs font-semibold uppercase tracking-wide text-nordic-textSecondary">添付メディア</h3>
      <ul className="space-y-3">
        {sorted.map((ref) => (
            <li key={ref.id} className="rounded-lg border border-nordic-border bg-nordic-surface p-2">
            {ref.caption && <p className="mb-1 text-xs text-nordic-textSecondary">{ref.caption}</p>}
            <p className="mb-1 text-xs text-nordic-textSecondary">{ref.fileName}</p>
            {ref.kind === "image" && urls[ref.id] ? (
              <img src={urls[ref.id]} alt={ref.caption ?? ref.fileName} className="max-h-64 w-full rounded object-contain" />
            ) : ref.kind === "video" && urls[ref.id] ? (
              <video src={urls[ref.id]} controls className="max-h-72 w-full rounded bg-black" playsInline />
            ) : (
              <p className="text-xs text-nordic-textSecondary">読み込み中…</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export const ConceptDetail = ({
  concept,
  conceptMap,
  domainColorMap,
  onSelectRelated,
  onRequestDelete,
  deleting
}: Props) => {
  if (!concept) {
    return (
      <section className="rounded-2xl border border-nordic-card-border bg-nordic-card p-6 shadow-quiet">
        <p className="text-sm text-nordic-textOnDark">左側の概念を選択すると詳細が表示されます。</p>
      </section>
    );
  }

  return (
    <section className="max-w-[min(100%,760px)] space-y-4 rounded-2xl border border-nordic-card-border bg-nordic-card p-6 shadow-quiet">
      <header className="flex flex-wrap items-center gap-2">
        <h2 className="text-xl font-semibold text-nordic-textOnDark">{concept.title}</h2>
        {concept.favorite && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
            お気に入り
          </span>
        )}
        <StatusBadge status={concept.status} />
      </header>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => onRequestDelete(concept)}
          disabled={deleting}
          className="rounded-md border border-rose-300 bg-rose-50 px-3 py-1.5 text-sm text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {deleting ? "削除中..." : "削除"}
        </button>
      </div>

      <ConceptMediaGallery concept={concept} />

      <article className="mx-auto max-w-[min(100%,760px)] space-y-4 text-nordic-textOnDark">
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-nordic-textSecondary">定義</h3>
          <p className="whitespace-pre-wrap break-words text-base leading-7">{concept.definition || "未入力"}</p>
        </div>
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-nordic-textSecondary">自分の解釈</h3>
          <p className="whitespace-pre-wrap break-words text-base leading-7">{concept.myInterpretation || "未入力"}</p>
        </div>
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-nordic-textSecondary">メモ</h3>
          <p className="whitespace-pre-wrap break-words text-base leading-7">{concept.notes || "未入力"}</p>
        </div>
      </article>

      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-nordic-textMuted">分野タグ</h3>
        <div className="flex flex-wrap gap-1">
          {concept.domainTags.length === 0 ? (
            <span className="text-sm text-nordic-textSecondary">なし</span>
          ) : (
            concept.domainTags.map((tag) => (
              <span
                key={tag}
                className="rounded-md border px-2 py-0.5 text-xs"
                style={colorToSoftTagStyle(getDomainTagColor(tag, domainColorMap))}
              >
                #{tag}
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
            <span className="text-sm text-nordic-textSecondary">なし</span>
          ) : (
            concept.researchTags.map((tag) => (
              <span
                key={tag}
                className="rounded-md bg-nordic-sage px-2 py-0.5 text-xs text-nordic-surface"
              >
                #{tag}
              </span>
            ))
          )}
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-nordic-textMuted">関連概念</h3>
        {concept.relatedIds.length === 0 ? (
          <p className="text-sm text-nordic-textSecondary">関連概念なし</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {concept.relatedIds.map((relatedId) => {
              const related = conceptMap.get(relatedId);
              if (!related) {
                return (
                  <li
                    key={relatedId}
                    className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800"
                  >
                    不明なID: {relatedId}
                  </li>
                );
              }
              return (
                <li key={relatedId}>
                  <button
                    className="rounded-md border border-nordic-card-border bg-nordic-cardAction px-2 py-1 text-xs text-nordic-textOnDark hover:bg-nordic-cardActionHover"
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

      <div className="rounded-lg bg-nordic-section p-3 text-xs text-nordic-textOnDark">
        <p>
          出典: {concept.source.book || "未入力"} / p.{concept.source.page || "-"} /{" "}
          {concept.source.author || "著者未入力"}
        </p>
        <p>作成: {shortDateTime(concept.createdAt)}</p>
        <p>更新: {shortDateTime(concept.updatedAt)}</p>
      </div>
    </section>
  );
};
