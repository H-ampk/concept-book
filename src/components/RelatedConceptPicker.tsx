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
    if (!import.meta.env.DEV) {
      return;
    }
    console.log("picker input", { inputTitle, inputDefinition, inputTags });
    console.log("allNodes.length", allNodes.length);
    console.log("selectedIds.length", selectedIds.length);
    console.log("ignoredSuggestionIds.length", ignoredSuggestionIds.length);
    console.log("candidate titles", allNodes.map((node) => node.title));
    console.log("picker suggestions", suggestions);
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
      {import.meta.env.DEV && (
        <p className="mb-2 rounded-md border-2 border-fuchsia-500 bg-fuchsia-100 px-2 py-1 text-sm font-bold text-fuchsia-900">
          TEST_RELATED_PICKER_VISIBLE
        </p>
      )}
      <span className="mb-1 block text-sm text-[#F4E8D0]">現在の関連概念</span>
      <div className="mb-2 max-h-24 overflow-y-auto rounded-md border border-[#C89B5C]/30 bg-[#0B2D49] p-2">
        <div className="flex flex-wrap gap-2">
        {selectedConcepts.length === 0 ? (
          <span className="text-xs text-[#B9C7D1]">未設定</span>
        ) : (
          selectedConcepts.map((concept) => (
            <span
              key={concept.id}
              className="inline-flex items-center gap-2 rounded-full border border-[#C89B5C]/30 bg-[#102F45] px-2.5 py-1 text-xs text-[#F4E8D0]"
            >
              <span>
                {concept.title}
                {!concept.exists && <span className="ml-1 text-[#B9C7D1]">({concept.id})</span>}
              </span>
              <button
                type="button"
                className="rounded px-1 text-[#E0C58B] hover:bg-[#C89B5C]/15"
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

      <div
        className={`mb-2 rounded-md p-3 ${
          import.meta.env.DEV
            ? "border-2 border-fuchsia-500 bg-fuchsia-50"
            : "border border-[#C89B5C]/30 bg-[#0B2D49]"
        }`}
      >
        <p
          className={
            import.meta.env.DEV
              ? "text-base font-bold text-fuchsia-800"
              : "text-sm font-medium text-[#F4E8D0]"
          }
        >
          関連概念候補 ({suggestedCandidates.length}件)
        </p>
        {import.meta.env.DEV && (
          <>
            <p className="mt-1 text-xs text-[#B9C7D1]">
              関連候補デバッグ: {suggestions.length}件（表示中: {suggestedCandidates.length}件）
            </p>
            <p className="mt-0.5 text-xs text-[#B9C7D1]">
              inputTitle: {inputTitle || "(空)"} / inputDefinition: {inputDefinition ? "入力あり" : "(空)"}
            </p>
            <p className="mt-0.5 text-xs text-[#B9C7D1]">
              allNodes: {allNodes.length} / selected: {selectedIds.length} / ignored: {ignoredSuggestionIds.length}
            </p>
          </>
        )}
        {suggestedCandidates.length === 0 ? (
          <p className="mt-1 text-xs text-[#B9C7D1]">候補が見つかりません</p>
        ) : (
          <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto pr-1">
            {suggestedCandidates.map((candidate) => (
              <li
                key={candidate.id}
                className="rounded-lg border border-[#C89B5C]/30 bg-[#102F45] px-2.5 py-2 hover:bg-[#133954] transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-[#F4E8D0]">{candidate.title}</p>
                    <p className="mt-0.5 text-xs text-[#B9C7D1]">
                      {candidate.reasons.slice(0, 2).join(" / ")}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      className="rounded border border-[#C89B5C]/50 px-2 py-1 text-xs text-[#E0C58B] bg-transparent hover:bg-[#C89B5C]/15 transition-colors"
                      onClick={() => addRelated(candidate.id)}
                    >
                      追加
                    </button>
                    <button
                      type="button"
                      className="rounded border border-[#C89B5C]/50 px-2 py-1 text-xs text-[#E0C58B] bg-transparent hover:bg-[#C89B5C]/15 transition-colors"
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

      <div className="mb-2 border-t border-[#C89B5C]/30" />

      <span className="mb-1 block text-sm text-[#F4E8D0]">関連概念（タイトル検索）</span>
      <div className="relative">
        <input
          className="w-full rounded-md border border-[#C89B5C]/40 bg-[#061A2D] px-3 py-2 text-sm text-[#F4E8D0] placeholder:text-[#B9C7D1]"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          placeholder="関連付けたい概念タイトルを入力"
        />

        {open && (
          <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-[#C89B5C]/30 bg-[#0B2D49] shadow-md">
            {searchCandidates.length === 0 ? (
              <p className="px-3 py-2 text-xs text-[#B9C7D1]">該当なし</p>
            ) : (
              <ul className="py-1">
                {searchCandidates.map((candidate) => (
                  <li key={candidate.id}>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm text-[#F4E8D0] hover:bg-[#102F45] transition-colors"
                      onClick={() => addRelated(candidate.id)}
                    >
                      <span className="font-medium text-[#F4E8D0]">{candidate.title}</span>
                      {(candidate.domainTags.length > 0 || candidate.researchTags.length > 0) && (
                        <span className="ml-2 text-xs text-[#B9C7D1]">
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
