import React from "react";
import { StatusBadge } from "./StatusBadge";
import type { Concept } from "../types/concept";
import { colorToSoftTagStyle, getDomainTagColor } from "../utils/domainColors";

type Props = {
  concepts: Concept[];
  selectedId?: string;
  domainColorMap: Record<string, string>;
  onSelect: (id: string) => void;
  onEdit: (concept: Concept) => void;
  onToggleFavorite: (concept: Concept) => void;
  cardRefs: React.RefObject<Map<string, HTMLLIElement>>;
};

export const ConceptList = ({
  concepts,
  selectedId,
  domainColorMap,
  onSelect,
  onEdit,
  onToggleFavorite,
  cardRefs
}: Props) => {
  if (concepts.length === 0) {
    return (
      <div className="rounded-xl border border-celestial-border bg-celestial-deepBlue p-4 text-sm text-celestial-textSub shadow-celestial">
        条件に一致する概念がありません。
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {concepts.map((concept) => (
        <li
          key={concept.id}
          ref={(el) => {
            if (cardRefs.current) {
              if (el) {
                cardRefs.current.set(concept.id, el);
              } else {
                cardRefs.current.delete(concept.id);
              }
            }
          }}
          className={`concept-card group relative overflow-visible rounded-xl border border-celestial-border bg-nordic-card p-3 shadow-celestial transition-all duration-200 hover:-translate-y-0.5 hover:border-celestial-gold/45 hover:shadow-[0_16px_36px_rgba(0,0,0,0.35),0_0_18px_rgba(77,255,154,0.12)] ${
            selectedId === concept.id ? "concept-card-selected" : ""
          }`}
        >
          <span className="card-corner card-corner-top-left" aria-hidden="true" />
          <span className="card-corner card-corner-top-right" aria-hidden="true" />
          <span className="card-corner card-corner-bottom-left" aria-hidden="true" />
          <span className="card-corner card-corner-bottom-right" aria-hidden="true" />
          {/* Left decoration line */}
          <div className="absolute left-0 top-4 bottom-4 w-[2px] rounded-full bg-celestial-emerald/70"></div>
          {/* Corner decorations */}
          <div className="absolute top-3 right-3 h-6 w-6 border-t border-r border-celestial-gold/45"></div>
          <div className="absolute bottom-3 left-3 h-6 w-6 border-b border-l border-celestial-gold/30"></div>
          {/* Background radial gradient */}
          <div className="absolute inset-0 rounded-xl bg-radial-gradient opacity-20"></div>

          <button className="concept-card-main-button relative w-full text-left" onClick={() => onSelect(concept.id)} type="button">
            <div className="mb-1 flex items-center justify-between gap-2">
              <h3 className="line-clamp-1 text-lg font-semibold tracking-wide text-celestial-textMain">{concept.title}</h3>
              <StatusBadge status={concept.status} />
            </div>
            <p className="line-clamp-2 text-sm leading-relaxed text-celestial-textSub">{concept.definition || "定義未入力"}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {concept.domainTags.slice(0, 2).map((tag) => (
                <span
                  key={`${concept.id}-domain-${tag}`}
                  className="tag-chip rounded-md border border-celestial-gold/25 bg-celestial-gold/10 px-2 py-0.5 text-xs text-celestial-textMain"
                  style={colorToSoftTagStyle(getDomainTagColor(tag, domainColorMap))}
                >
                  D:{tag}
                </span>
              ))}
              {concept.researchTags.slice(0, 2).map((tag) => (
                <span
                  key={`${concept.id}-research-${tag}`}
                  className="tag-chip rounded-md border border-celestial-gold/25 bg-celestial-gold/10 px-2 py-0.5 text-xs text-celestial-textMain"
                >
                  R:{tag}
                </span>
              ))}
            </div>
          </button>

          <div className="relative mt-3 flex gap-2">
            <button
              className="filter-button rounded-md border border-celestial-gold/40 bg-transparent px-2 py-1 text-xs text-celestial-softGold hover:bg-celestial-gold/10 transition-colors"
              onClick={() => onEdit(concept)}
              type="button"
            >
              編集
            </button>
            <button
              className="filter-button rounded-md border border-celestial-gold/40 bg-transparent px-2 py-1 text-xs text-celestial-softGold hover:bg-celestial-gold/10 transition-colors"
              onClick={() => onToggleFavorite(concept)}
              type="button"
            >
              {concept.favorite ? "お気に入り解除" : "お気に入り"}
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
};
