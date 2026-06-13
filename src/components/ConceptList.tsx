import React, { useEffect, useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useMatchMedia } from "../hooks/useMatchMedia";
import { StatusBadge } from "./StatusBadge";
import type { Concept } from "../types/concept";
import { colorToSoftTagStyle, getDomainTagColor } from "../utils/domainColors";

const LIST_GAP_PX = 0;
const MOBILE_ESTIMATE_PX = 68;
const OVERSCAN = 8;

export type ConceptListLayout = "full" | "grouped";

type Props = {
  concepts: Concept[];
  selectedId?: string;
  domainColorMap: Record<string, string>;
  conceptQuizStatsText?: Map<string, string>;
  onSelect: (id: string) => void;
  cardRefs: React.RefObject<Map<string, HTMLElement>>;
  /** スマホ仮想スクロール時の縦方向の取り方（全体一覧 vs グループ内） */
  listLayout?: ConceptListLayout;
};

const itemClassName = (selected: boolean) =>
  `concept-index-item${selected ? " concept-index-item-selected" : ""}`;

function ConceptListItem({
  concept,
  selectedId,
  domainColorMap,
  conceptQuizStatsText,
  onSelect,
  outerRef,
  as = "li",
  style,
  virtualRowIndex
}: {
  concept: Concept;
  selectedId?: string;
  domainColorMap: Record<string, string>;
  conceptQuizStatsText?: Map<string, string>;
  onSelect: (id: string) => void;
  outerRef?: React.RefCallback<HTMLElement>;
  as?: "li" | "div";
  style?: React.CSSProperties;
  /** 仮想リスト行の measure 用（@tanstack/react-virtual） */
  virtualRowIndex?: number;
}) {
  const selected = selectedId === concept.id;
  const Wrapper = as;
  const learningStatusText = conceptQuizStatsText?.get(concept.id) ?? "未学習";
  const domainTags = concept.domainTags.slice(0, 2);
  const researchTags = concept.researchTags.slice(0, 2);
  const hasMeta = domainTags.length > 0 || researchTags.length > 0 || learningStatusText !== "未学習";

  return (
    <Wrapper
      ref={outerRef}
      style={style}
      data-selected={selected ? "true" : undefined}
      {...(virtualRowIndex !== undefined ? { "data-index": virtualRowIndex } : {})}
      {...(as === "div" ? { role: "listitem" as const } : {})}
      className={itemClassName(selected)}
    >
      <button
        className="concept-index-item-button"
        onClick={() => onSelect(concept.id)}
        type="button"
      >
        <div className="concept-index-item-title-row">
          <h3 className="concept-index-item-title">{concept.title}</h3>
          <StatusBadge status={concept.status} />
        </div>
        {hasMeta && (
          <div className="concept-index-item-meta">
            {domainTags.map((tag) => (
              <span
                key={`${concept.id}-domain-${tag}`}
                className="concept-index-tag"
                style={colorToSoftTagStyle(getDomainTagColor(tag, domainColorMap))}
              >
                {tag}
              </span>
            ))}
            {researchTags.map((tag) => (
              <span key={`${concept.id}-research-${tag}`} className="concept-index-tag concept-index-tag--muted">
                {tag}
              </span>
            ))}
            <span className="concept-index-learning" aria-label="クイズ学習状況">
              {learningStatusText}
            </span>
          </div>
        )}
      </button>
    </Wrapper>
  );
}

const MemoConceptListItem = React.memo(ConceptListItem);

export const ConceptList = ({
  concepts,
  selectedId,
  domainColorMap,
  conceptQuizStatsText,
  onSelect,
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
      <p className="concept-index-empty">条件に一致する概念がありません。</p>
    );
  }

  if (!isMobile) {
    return (
      <ul className="concept-index-list" role="list">
        {concepts.map((concept) => (
          <MemoConceptListItem
            key={concept.id}
            as="li"
            concept={concept}
            selectedId={selectedId}
            domainColorMap={domainColorMap}
            conceptQuizStatsText={conceptQuizStatsText}
            onSelect={onSelect}
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
              conceptQuizStatsText={conceptQuizStatsText}
              onSelect={onSelect}
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
