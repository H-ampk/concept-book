import React, { useEffect, useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useMatchMedia } from "../hooks/useMatchMedia";
import { StatusBadge } from "./StatusBadge";
import type { Concept } from "../types/concept";
import { colorToSoftTagStyle, getDomainTagColor } from "../utils/domainColors";

const LIST_GAP_PX = 12;
const MOBILE_ESTIMATE_PX = 140;
const OVERSCAN = 8;

export type ConceptListLayout = "full" | "grouped";

type Props = {
  concepts: Concept[];
  selectedId?: string;
  domainColorMap: Record<string, string>;
  onSelect: (id: string) => void;
  onEdit: (concept: Concept) => void;
  onToggleFavorite: (concept: Concept) => void;
  cardRefs: React.RefObject<Map<string, HTMLElement>>;
  /** スマホ仮想スクロール時の縦方向の取り方（全体一覧 vs グループ内） */
  listLayout?: ConceptListLayout;
};

const cardClassName = (selected: boolean) =>
  `concept-card group relative overflow-visible rounded-3xl p-3 transition-all duration-200 ${
    selected ? "concept-card-selected" : ""
  }`;

function ConceptListItem({
  concept,
  selectedId,
  domainColorMap,
  onSelect,
  onEdit,
  onToggleFavorite,
  outerRef,
  as = "li",
  style,
  virtualRowIndex
}: {
  concept: Concept;
  selectedId?: string;
  domainColorMap: Record<string, string>;
  onSelect: (id: string) => void;
  onEdit: (concept: Concept) => void;
  onToggleFavorite: (concept: Concept) => void;
  outerRef?: React.RefCallback<HTMLElement>;
  as?: "li" | "div";
  style?: React.CSSProperties;
  /** 仮想リスト行の measure 用（@tanstack/react-virtual） */
  virtualRowIndex?: number;
}) {
  const selected = selectedId === concept.id;
  const Wrapper = as;
  const titleClass = selected
    ? "line-clamp-1 text-lg font-semibold tracking-wide text-white"
    : "line-clamp-1 text-lg font-semibold tracking-wide text-nordic-textPrimary";
  const defClass = selected
    ? "line-clamp-2 text-sm leading-relaxed text-white/[0.82]"
    : "line-clamp-2 text-sm leading-relaxed text-nordic-textSecondary";
  const defMutedClass = selected ? "text-white/70" : "text-nordic-textMuted";

  return (
    <Wrapper
      ref={outerRef}
      style={style}
      data-selected={selected ? "true" : undefined}
      {...(virtualRowIndex !== undefined ? { "data-index": virtualRowIndex } : {})}
      {...(as === "div" ? { role: "listitem" as const } : {})}
      className={cardClassName(selected)}
    >
      <span className="card-corner card-corner-top-left" aria-hidden="true" />
      <span className="card-corner card-corner-top-right" aria-hidden="true" />
      <span className="card-corner card-corner-bottom-left" aria-hidden="true" />
      <span className="card-corner card-corner-bottom-right" aria-hidden="true" />
      <div
        className={
          selected
            ? "absolute left-0 top-4 bottom-4 w-[2px] rounded-full bg-white/45"
            : "absolute left-0 top-4 bottom-4 w-[2px] rounded-full bg-[rgba(91,115,133,0.18)]"
        }
      />
      <div
        className={
          selected
            ? "absolute top-3 right-3 h-6 w-6 border-t border-r border-white/35"
            : "absolute top-3 right-3 h-6 w-6 border-t border-r border-[rgba(128,109,86,0.14)]"
        }
      />
      <div
        className={
          selected
            ? "absolute bottom-3 left-3 h-6 w-6 border-b border-l border-white/22"
            : "absolute bottom-3 left-3 h-6 w-6 border-b border-l border-[rgba(128,109,86,0.12)]"
        }
      />

      <button className="concept-card-main-button relative w-full text-left" onClick={() => onSelect(concept.id)} type="button">
        <div className="mb-1 flex items-center justify-between gap-2">
          <h3 className={titleClass}>{concept.title}</h3>
          <StatusBadge status={concept.status} />
        </div>
        <p className={defClass}>
          {concept.definition ? (
            concept.definition
          ) : (
            <span className={defMutedClass}>定義未入力</span>
          )}
        </p>
        <div className="mt-2 flex flex-wrap gap-1">
          {concept.domainTags.slice(0, 2).map((tag) => (
            <span
              key={`${concept.id}-domain-${tag}`}
              className={
                selected
                  ? "tag-chip rounded-md border border-white/28 bg-white/12 px-2 py-0.5 text-xs text-white"
                  : "tag-chip rounded-md px-2 py-0.5 text-xs"
              }
              style={selected ? undefined : colorToSoftTagStyle(getDomainTagColor(tag, domainColorMap))}
            >
              D:{tag}
            </span>
          ))}
          {concept.researchTags.slice(0, 2).map((tag) => (
            <span
              key={`${concept.id}-research-${tag}`}
              className={
                selected
                  ? "tag-chip rounded-md border border-white/28 bg-white/12 px-2 py-0.5 text-xs text-white"
                  : "tag-chip rounded-md px-2 py-0.5 text-xs"
              }
            >
              R:{tag}
            </span>
          ))}
        </div>
      </button>

      <div className="relative mt-3 flex gap-2">
        <button
          className={
            selected
              ? "filter-button rounded-md border border-white/30 bg-transparent px-2 py-1 text-xs text-white/90 hover:bg-white/15 transition-colors"
              : "filter-button rounded-md border border-nordic-border bg-nordic-card/80 px-2 py-1 text-xs text-nordic-textPrimary hover:bg-nordic-cardHover transition-colors"
          }
          onClick={() => onEdit(concept)}
          type="button"
        >
          編集
        </button>
        <button
          className={
            selected
              ? "filter-button rounded-md border border-white/30 bg-transparent px-2 py-1 text-xs text-white/90 hover:bg-white/15 transition-colors"
              : "filter-button rounded-md border border-nordic-border bg-nordic-card/80 px-2 py-1 text-xs text-nordic-textPrimary hover:bg-nordic-cardHover transition-colors"
          }
          onClick={() => onToggleFavorite(concept)}
          type="button"
        >
          {concept.favorite ? "お気に入り解除" : "お気に入り"}
        </button>
      </div>
    </Wrapper>
  );
}

const MemoConceptListItem = React.memo(ConceptListItem);

export const ConceptList = ({
  concepts,
  selectedId,
  domainColorMap,
  onSelect,
  onEdit,
  onToggleFavorite,
  cardRefs,
  listLayout = "full"
}: Props) => {
  const isMobile = useMatchMedia("(max-width: 768px)");
  const parentRef = useRef<HTMLDivElement>(null);

  const idToIndex = useMemo(() => {
    const m = new Map<string, number>();
    concepts.forEach((c, i) => m.set(c.id, i));
    return m;
  }, [concepts]);

  const rowVirtualizer = useVirtualizer({
    count: concepts.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => MOBILE_ESTIMATE_PX,
    overscan: OVERSCAN,
    gap: LIST_GAP_PX,
    enabled: isMobile && concepts.length > 0
  });

  /* 選択 ID が変わったときだけ追従（concepts を依存に含めると検索デバウンスのたびにスクロールが動く） */
  useEffect(() => {
    if (!isMobile || concepts.length === 0 || !selectedId) {
      return;
    }
    const idx = idToIndex.get(selectedId);
    if (idx !== undefined && idx >= 0) {
      rowVirtualizer.scrollToIndex(idx, { align: "center" });
    }
  }, [selectedId, isMobile, rowVirtualizer, idToIndex]);

  if (concepts.length === 0) {
    return (
      <div className="rounded-xl border border-[rgba(110,140,155,0.26)] bg-[rgba(255,255,255,0.88)] p-4 text-sm text-nordic-textSecondary shadow-[0_10px_28px_rgba(70,95,110,0.08)]">
        条件に一致する概念がありません。
      </div>
    );
  }

  if (!isMobile) {
    return (
      <ul className="space-y-3">
        {concepts.map((concept) => (
          <MemoConceptListItem
            key={concept.id}
            as="li"
            concept={concept}
            selectedId={selectedId}
            domainColorMap={domainColorMap}
            onSelect={onSelect}
            onEdit={onEdit}
            onToggleFavorite={onToggleFavorite}
            outerRef={(el) => {
              if (cardRefs.current) {
                if (el) {
                  cardRefs.current.set(concept.id, el);
                } else {
                  cardRefs.current.delete(concept.id);
                }
              }
            }}
          />
        ))}
      </ul>
    );
  }

  const scrollClass =
    listLayout === "full"
      ? "concept-list-scroll concept-list-scroll--full scrollbar-none"
      : "concept-list-scroll concept-list-scroll--grouped scrollbar-none";

  return (
    <div ref={parentRef} className={scrollClass} role="list">
      <div
        className="relative w-full"
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const concept = concepts[virtualRow.index];
          return (
            <MemoConceptListItem
              key={concept.id}
              as="div"
              virtualRowIndex={virtualRow.index}
              concept={concept}
              selectedId={selectedId}
              domainColorMap={domainColorMap}
              onSelect={onSelect}
              onEdit={onEdit}
              onToggleFavorite={onToggleFavorite}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualRow.start}px)`
              }}
              outerRef={(el) => {
                rowVirtualizer.measureElement(el);
                if (cardRefs.current) {
                  if (el) {
                    cardRefs.current.set(concept.id, el);
                  } else {
                    cardRefs.current.delete(concept.id);
                  }
                }
              }}
            />
          );
        })}
      </div>
    </div>
  );
};
