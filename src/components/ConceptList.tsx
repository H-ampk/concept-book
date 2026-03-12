import { StatusBadge } from "./StatusBadge";
import type { Concept } from "../types/concept";

type Props = {
  concepts: Concept[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onEdit: (concept: Concept) => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (concept: Concept) => void;
};

export const ConceptList = ({
  concepts,
  selectedId,
  onSelect,
  onEdit,
  onDelete,
  onToggleFavorite
}: Props) => {
  if (concepts.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
        条件に一致する概念がありません。
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {concepts.map((concept) => (
        <li
          key={concept.id}
          className={`rounded-xl border bg-white p-3 shadow-quiet transition ${
            selectedId === concept.id ? "border-slate-400" : "border-slate-200"
          }`}
        >
          <button className="w-full text-left" onClick={() => onSelect(concept.id)} type="button">
            <div className="mb-1 flex items-center justify-between gap-2">
              <h3 className="line-clamp-1 text-base font-semibold text-slate-800">{concept.title}</h3>
              <StatusBadge status={concept.status} />
            </div>
            <p className="line-clamp-2 text-sm text-slate-600">{concept.definition || "定義未入力"}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {concept.domainTags.slice(0, 2).map((tag) => (
                <span
                  key={`${concept.id}-domain-${tag}`}
                  className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                >
                  D:{tag}
                </span>
              ))}
              {concept.researchTags.slice(0, 2).map((tag) => (
                <span
                  key={`${concept.id}-research-${tag}`}
                  className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700"
                >
                  R:{tag}
                </span>
              ))}
            </div>
          </button>

          <div className="mt-3 flex gap-2">
            <button
              className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
              onClick={() => onEdit(concept)}
              type="button"
            >
              編集
            </button>
            <button
              className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
              onClick={() => onToggleFavorite(concept)}
              type="button"
            >
              {concept.favorite ? "お気に入り解除" : "お気に入り"}
            </button>
            <button
              className="rounded-md border border-rose-200 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50"
              onClick={() => onDelete(concept.id)}
              type="button"
            >
              削除
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
};
