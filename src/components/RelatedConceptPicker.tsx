import { useEffect, useMemo, useState } from "react";
import type { Concept } from "../types/concept";
import { suggestRelatedConcepts } from "../features/concepts/suggestRelatedConcepts";
import { includesNormalized } from "../utils/search";

type Props = {
  allConcepts: Concept[];
  selectedIds: string[];
  currentConceptId?: string;
  inputTitle: string;
  inputDefinition: string;
  inputTags: string[];
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
  inputTitle,
  inputDefinition,
  inputTags,
  onChange
}: Props) => {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const ignoredSuggestionIds = dismissedIds;

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

  const searchCandidates = useMemo(() => {
    const selectedSet = new Set(selectedIds);
    return allConcepts
      .filter((concept) => concept.id !== currentConceptId)
      .filter((concept) => !selectedSet.has(concept.id))
      .filter((concept) => candidateMatches(concept, query))
      .slice(0, 8);
  }, [allConcepts, currentConceptId, query, selectedIds]);

  const allNodes = useMemo(
    () =>
      allConcepts.map((concept) => ({
        id: concept.id,
        title: concept.title,
        definition: concept.definition,
        tags: [...concept.domainTags, ...concept.researchTags],
        links: concept.relatedIds
      })),
    [allConcepts]
  );

  const suggestions = useMemo(
    () =>
      suggestRelatedConcepts(
        {
          id: currentConceptId ?? "__new__",
          title: inputTitle,
          definition: inputDefinition,
          tags: inputTags,
          links: selectedIds
        },
        allNodes
      ),
    [allNodes, currentConceptId, inputDefinition, inputTags, inputTitle, selectedIds]
  );

  const suggestedCandidates = useMemo(() => {
    const dismissedSet = new Set(ignoredSuggestionIds);
    return suggestions.filter((candidate) => !dismissedSet.has(candidate.id));
  }, [ignoredSuggestionIds, suggestions]);

  useEffect(() => {
    // Removed debug logging
  }, [allNodes, ignoredSuggestionIds.length, inputDefinition, inputTags, inputTitle, selectedIds.length, suggestions]);

  const addRelated = (conceptId: string) => {
    if (selectedIds.includes(conceptId)) {
      return;
    }
    onChange([...selectedIds, conceptId]);
    setDismissedIds((prev) => prev.filter((id) => id !== conceptId));
    setQuery("");
    setOpen(true);
  };

  const removeRelated = (conceptId: string) => {
    onChange(selectedIds.filter((id) => id !== conceptId));
  };

  const dismissSuggestion = (conceptId: string) => {
    if (dismissedIds.includes(conceptId)) {
      return;
    }
    setDismissedIds((prev) => [...prev, conceptId]);
  };

  return (
    <div className="md:col-span-2">
      <span className="mb-1 block text-sm text-celestial-softGold">現在の関連概念</span>
      <div className="mb-2 max-h-24 overflow-y-auto scrollbar-none rounded-2xl border border-celestial-gold/30 bg-celestial-deepBlue p-2">
        <div className="flex flex-wrap gap-2">
        {selectedConcepts.length === 0 ? (
          <span className="text-xs text-celestial-textSub">未設定</span>
        ) : (
          selectedConcepts.map((concept) => (
            <span
              key={concept.id}
              className="inline-flex items-center gap-2 rounded-full border border-celestial-gold/30 bg-celestial-panel px-2.5 py-1 text-xs text-celestial-softGold"
            >
              <span>
                {concept.title}
                {!concept.exists && <span className="ml-1 text-celestial-textSub">({concept.id})</span>}
              </span>
              <button
                type="button"
                className="rounded px-1 text-celestial-softGold hover:bg-celestial-gold/15"
                onClick={() => removeRelated(concept.id)}
                aria-label={`${concept.title} を関連概念から外す`}
              >
                ×
              </button>
            </span>
          ))
        )}
        </div>
      </div>

      <div className="mb-2 rounded-2xl border border-celestial-gold/30 bg-celestial-deepBlue p-3">
        <p className="text-sm font-medium text-celestial-softGold">
          関連概念候補 ({suggestedCandidates.length}件)
        </p>
        {suggestedCandidates.length === 0 ? (
          <p className="mt-1 text-xs text-celestial-textSub">候補が見つかりません</p>
        ) : (
          <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto scrollbar-none pr-1">
            {suggestedCandidates.map((candidate) => (
              <li
                key={candidate.id}
                className="rounded-2xl border border-celestial-gold/30 bg-celestial-panel px-2.5 py-2 hover:bg-celestial-gold/10 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-celestial-softGold">{candidate.title}</p>
                    <p className="mt-0.5 text-xs text-celestial-textSub">
                      {candidate.reasons.slice(0, 2).join(" / ")}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      className="rounded border border-celestial-gold/50 px-2 py-1 text-xs text-celestial-softGold bg-transparent hover:bg-celestial-gold/15 transition-colors"
                      onClick={() => addRelated(candidate.id)}
                    >
                      追加
                    </button>
                    <button
                      type="button"
                      className="rounded border border-celestial-gold/50 px-2 py-1 text-xs text-celestial-softGold bg-transparent hover:bg-celestial-gold/15 transition-colors"
                      onClick={() => dismissSuggestion(candidate.id)}
                    >
                      無視
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mb-2 border-t border-celestial-gold/30" />

      <span className="mb-1 block text-sm text-celestial-softGold">関連概念（タイトル検索）</span>
      <div className="relative">
        <input
          className="w-full rounded-2xl border border-celestial-gold/30 bg-celestial-deepBlue px-3 py-2 text-sm text-celestial-textMain placeholder:text-celestial-textSub"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          placeholder="関連付けたい概念タイトルを入力"
        />

        {open && (
          <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto scrollbar-none rounded-2xl border border-celestial-gold/30 bg-celestial-deepBlue shadow-celestial">
            {searchCandidates.length === 0 ? (
              <p className="px-3 py-2 text-xs text-celestial-textSub">該当なし</p>
            ) : (
              <ul className="py-1">
                {searchCandidates.map((candidate) => (
                  <li key={candidate.id}>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm text-celestial-textMain hover:bg-celestial-panel transition-colors"
                      onClick={() => addRelated(candidate.id)}
                    >
                      <span className="font-medium text-celestial-softGold">{candidate.title}</span>
                      {(candidate.domainTags.length > 0 || candidate.researchTags.length > 0) && (
                        <span className="ml-2 text-xs text-celestial-textSub">
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
