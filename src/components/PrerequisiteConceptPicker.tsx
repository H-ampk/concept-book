import { useCallback, useMemo, useState } from "react";
import type { Concept } from "../types/concept";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { includesNormalized } from "../utils/search";

const TITLE_SEARCH_MAX = 20;

type Props = {
  allConcepts: Concept[];
  selectedIds: string[];
  currentConceptId?: string;
  /** 選択すると cycle になる Concept ID（自身を含む） */
  forbiddenIds?: ReadonlySet<string>;
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

export const PrerequisiteConceptPicker = ({
  allConcepts,
  selectedIds,
  currentConceptId,
  forbiddenIds,
  onChange
}: Props) => {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const debouncedSearchQuery = useDebouncedValue(query, 200);

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

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const searchCandidates = useMemo(() => {
    const q = debouncedSearchQuery.trim();
    if (!q) {
      return [];
    }
    return allConcepts
      .filter((concept) => concept.id !== currentConceptId)
      .filter((concept) => !selectedIdSet.has(concept.id))
      .filter((concept) => candidateMatches(concept, debouncedSearchQuery))
      .slice(0, TITLE_SEARCH_MAX);
  }, [allConcepts, currentConceptId, debouncedSearchQuery, selectedIdSet]);

  const addPrerequisite = useCallback(
    (conceptId: string) => {
      if (selectedIdSet.has(conceptId) || conceptId === currentConceptId) {
        return;
      }
      if (forbiddenIds?.has(conceptId)) {
        return;
      }
      onChange([...selectedIds, conceptId]);
      setQuery("");
      setOpen(true);
    },
    [currentConceptId, forbiddenIds, onChange, selectedIdSet, selectedIds]
  );

  const removePrerequisite = useCallback(
    (conceptId: string) => {
      onChange(selectedIds.filter((id) => id !== conceptId));
    },
    [onChange, selectedIds]
  );

  return (
    <div className="md:col-span-2">
      <span className="mb-1 block text-sm font-medium text-celestial-textMain">前提概念</span>
      <p className="mb-2 text-xs text-celestial-textSub">この概念を理解する前に必要な概念</p>
      <span className="mb-1 block text-sm text-celestial-softGold">現在の前提概念</span>
      <div className="mb-2 max-h-24 overflow-y-auto scrollbar-none rounded-2xl border border-celestial-gold/30 bg-celestial-deepBlue p-2">
        <div className="flex flex-wrap gap-2">
          {selectedConcepts.length === 0 ? (
            <span className="text-xs text-celestial-textSub">未設定</span>
          ) : (
            selectedConcepts.map((concept) => (
              <span
                key={concept.id}
                className="inline-flex items-center gap-2 rounded-[10px] border border-celestial-gold/30 bg-celestial-panel px-2.5 py-1 text-xs text-celestial-softGold"
              >
                <span>
                  {concept.title}
                  {!concept.exists && <span className="ml-1 text-celestial-textSub">({concept.id})</span>}
                </span>
                <button
                  type="button"
                  className="rounded px-1 text-celestial-softGold hover:bg-celestial-gold/15"
                  onClick={() => removePrerequisite(concept.id)}
                  aria-label={`${concept.title} を前提概念から外す`}
                >
                  ×
                </button>
              </span>
            ))
          )}
        </div>
      </div>

      <span className="mb-1 block text-sm text-celestial-softGold">前提概念（タイトル検索）</span>
      <div className="relative">
        <input
          className="w-full rounded-2xl border border-celestial-gold/30 bg-celestial-deepBlue px-3 py-2 text-sm text-celestial-textMain placeholder:text-celestial-textSub"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          placeholder="前提となる概念タイトルを入力"
        />

        {open && (
          <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto scrollbar-none rounded-2xl border border-celestial-gold/30 bg-celestial-deepBlue shadow-celestial">
            {searchCandidates.length === 0 ? (
              <p className="px-3 py-2 text-xs text-celestial-textSub">該当なし</p>
            ) : (
              <ul className="py-1">
                {searchCandidates.map((candidate) => {
                  const forbidden = Boolean(forbiddenIds?.has(candidate.id));
                  return (
                    <li key={candidate.id}>
                      <button
                        type="button"
                        disabled={forbidden}
                        className="w-full px-3 py-2 text-left text-sm text-celestial-textMain hover:bg-celestial-panel transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => addPrerequisite(candidate.id)}
                      >
                        <span className="font-medium text-celestial-softGold">{candidate.title}</span>
                        {forbidden ? (
                          <span className="ml-2 text-xs text-celestial-textSub">
                            循環するため選択できません
                          </span>
                        ) : (
                          (candidate.domainTags.length > 0 || candidate.researchTags.length > 0) && (
                            <span className="ml-2 text-xs text-celestial-textSub">
                              {candidate.domainTags.slice(0, 1).map((tag) => `D:${tag}`).join(" ")}
                              {candidate.researchTags.slice(0, 1).map((tag) => ` R:${tag}`).join(" ")}
                            </span>
                          )
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
