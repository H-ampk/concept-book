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
};

export const ConceptList = ({
  concepts,
  selectedId,
  domainColorMap,
  onSelect,
  onEdit,
  onToggleFavorite
}: Props) => {
  if (concepts.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-nordic-border bg-nordic-surface p-4 text-sm text-nordic-textSecondary">
        条件に一致する概念がありません。
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {concepts.map((concept) => (
        <li
          key={concept.id}
          className={`rounded-xl border bg-nordic-surface p-3 shadow-quiet transition ${
            selectedId === concept.id ? "border-nordic-navy" : "border-nordic-border"
          }`}
        >
          <button className="w-full text-left" onClick={() => onSelect(concept.id)} type="button">
            <div className="mb-1 flex items-center justify-between gap-2">
              <h3 className="line-clamp-1 text-base font-semibold text-nordic-textPrimary">{concept.title}</h3>
              <StatusBadge status={concept.status} />
            </div>
            <p className="line-clamp-2 text-sm text-nordic-textSecondary">{concept.definition || "定義未入力"}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {concept.domainTags.slice(0, 2).map((tag) => (
                <span
                  key={`${concept.id}-domain-${tag}`}
                  className="rounded-md border px-2 py-0.5 text-xs"
                  style={colorToSoftTagStyle(getDomainTagColor(tag, domainColorMap))}
                >
                  D:{tag}
                </span>
              ))}
              {concept.researchTags.slice(0, 2).map((tag) => (
                <span
                  key={`${concept.id}-research-${tag}`}
                  className="rounded-md bg-nordic-sage px-2 py-0.5 text-xs text-nordic-surface"
                >
                  R:{tag}
                </span>
              ))}
            </div>
          </button>

          <div className="mt-3 flex gap-2">
            <button
              className="rounded-md border border-nordic-border px-2 py-1 text-xs text-nordic-textPrimary hover:bg-nordic-bg"
              onClick={() => onEdit(concept)}
              type="button"
            >
              編集
            </button>
            <button
              className="rounded-md border border-nordic-border px-2 py-1 text-xs text-nordic-textPrimary hover:bg-nordic-bg"
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
