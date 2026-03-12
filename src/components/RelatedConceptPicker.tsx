import { useMemo, useState } from "react";
import type { Concept } from "../types/concept";
import { includesNormalized } from "../utils/search";

type Props = {
  allConcepts: Concept[];
  selectedIds: string[];
  currentConceptId?: string;
  onChange: (nextIds: string[]) => void;
};

const candidateMatches = (concept: Concept, query: string): boolean => {
  const searchable = [
    concept.title,
    concept.domainTags.join(" "),
    concept.researchTags.join(" ")
  ].join(" ");
  return includesNormalized(searchable, query);
};

export const RelatedConceptPicker = ({
  allConcepts,
  selectedIds,
  currentConceptId,
  onChange
}: Props) => {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const conceptMap = useMemo(
    () => new Map(allConcepts.map((concept) => [concept.id, concept])),
    [allConcepts]
  );

  const selectedConcepts = useMemo(
    () =>
      selectedIds.map((id) => ({
        id,
        title: conceptMap.get(id)?.title ?? "不明な概念",
        exists: conceptMap.has(id)
      })),
    [selectedIds, conceptMap]
  );

  const candidates = useMemo(() => {
    const selectedSet = new Set(selectedIds);
    return allConcepts
      .filter((concept) => concept.id !== currentConceptId)
      .filter((concept) => !selectedSet.has(concept.id))
      .filter((concept) => candidateMatches(concept, query))
      .slice(0, 8);
  }, [allConcepts, currentConceptId, query, selectedIds]);

  const addRelated = (conceptId: string) => {
    if (selectedIds.includes(conceptId)) {
      return;
    }
    onChange([...selectedIds, conceptId]);
    setQuery("");
    setOpen(true);
  };

  const removeRelated = (conceptId: string) => {
    onChange(selectedIds.filter((id) => id !== conceptId));
  };

  return (
    <div className="md:col-span-2">
      <span className="mb-1 block text-sm text-slate-700">関連概念（タイトル検索）</span>

      <div className="mb-2 flex flex-wrap gap-2">
        {selectedConcepts.length === 0 ? (
          <span className="text-xs text-slate-500">未設定</span>
        ) : (
          selectedConcepts.map((concept) => (
            <span
              key={concept.id}
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs text-slate-700"
            >
              <span>
                {concept.title}
                {!concept.exists && <span className="ml-1 text-slate-500">({concept.id})</span>}
              </span>
              <button
                type="button"
                className="rounded px-1 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
                onClick={() => removeRelated(concept.id)}
                aria-label={`${concept.title} を関連概念から外す`}
              >
                ×
              </button>
            </span>
          ))
        )}
      </div>

      <div className="relative">
        <input
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          placeholder="関連付けたい概念タイトルを入力"
        />

        {open && (
          <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-md">
            {candidates.length === 0 ? (
              <p className="px-3 py-2 text-xs text-slate-500">該当なし</p>
            ) : (
              <ul className="py-1">
                {candidates.map((candidate) => (
                  <li key={candidate.id}>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                      onClick={() => addRelated(candidate.id)}
                    >
                      <span className="font-medium text-slate-800">{candidate.title}</span>
                      {(candidate.domainTags.length > 0 || candidate.researchTags.length > 0) && (
                        <span className="ml-2 text-xs text-slate-500">
                          {candidate.domainTags.slice(0, 1).map((tag) => `D:${tag}`).join(" ")}
                          {candidate.researchTags.slice(0, 1).map((tag) => ` R:${tag}`).join(" ")}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
