import { useEffect, useId, useMemo, useState, type KeyboardEvent } from "react";
import type { Concept } from "../types/concept";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { normalizeForSearch } from "../utils/search";

export const QUIZ_CONCEPT_SEARCH_MAX = 30;
const SEARCH_DEBOUNCE_MS = 180;
const MAX_DOMAIN_TAGS_IN_LABEL = 3;

type Props = {
  concepts: Concept[];
  value: string;
  onChange: (conceptId: string) => void;
  disabled?: boolean;
};

type ConceptSearchEntry = {
  concept: Concept;
  normalizedSearchText: string;
};

const normalizeDomainTagsForLabel = (tags: string[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tag of tags) {
    const trimmed = tag.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
};

const conceptTitle = (concept: Concept): string =>
  concept.title?.trim() ? concept.title.trim() : "無題のConcept";

const conceptDomainTagLine = (concept: Concept): string => {
  const tags = normalizeDomainTagsForLabel(concept.domainTags ?? []);
  if (tags.length === 0) {
    return "";
  }
  const head = tags.slice(0, MAX_DOMAIN_TAGS_IN_LABEL);
  const hidden = tags.length - head.length;
  return head.join(" / ") + (hidden > 0 ? ` +${hidden}` : "");
};

const buildNormalizedSearchText = (concept: Concept): string =>
  normalizeForSearch([concept.title ?? "", ...(concept.domainTags ?? [])].join(" "));

export const QuizConceptPicker = ({ concepts, value, onChange, disabled = false }: Props) => {
  const inputId = useId();
  const listboxId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);

  const searchIndex = useMemo<ConceptSearchEntry[]>(
    () =>
      concepts.map((concept) => ({
        concept,
        normalizedSearchText: buildNormalizedSearchText(concept)
      })),
    [concepts]
  );

  const selectedConcept = useMemo(() => {
    const id = value.trim();
    if (!id) {
      return undefined;
    }
    return concepts.find((concept) => concept.id === id);
  }, [concepts, value]);

  const needle = useMemo(() => normalizeForSearch(debouncedQuery), [debouncedQuery]);

  const results = useMemo(() => {
    if (!needle) {
      return [] as Concept[];
    }
    const matched: Concept[] = [];
    for (const entry of searchIndex) {
      if (!entry.normalizedSearchText.includes(needle)) {
        continue;
      }
      matched.push(entry.concept);
      if (matched.length >= QUIZ_CONCEPT_SEARCH_MAX) {
        break;
      }
    }
    return matched;
  }, [needle, searchIndex]);

  useEffect(() => {
    setActiveIndex(0);
  }, [needle, results.length]);

  useEffect(() => {
    if (!open || results.length === 0) {
      return;
    }
    const option = document.getElementById(`${listboxId}-option-${activeIndex}`);
    if (typeof option?.scrollIntoView === "function") {
      option.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex, listboxId, open, results.length]);

  const selectConcept = (conceptId: string) => {
    onChange(conceptId);
    setQuery("");
    setOpen(false);
  };

  const clearSelection = () => {
    onChange("");
    setQuery("");
    setOpen(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing || event.key === "Process") {
      return;
    }

    switch (event.key) {
      case "ArrowDown": {
        event.preventDefault();
        if (!open) {
          setOpen(true);
          return;
        }
        if (results.length === 0) {
          return;
        }
        setActiveIndex((index) => Math.min(index + 1, results.length - 1));
        break;
      }
      case "ArrowUp": {
        event.preventDefault();
        if (!open) {
          setOpen(true);
          return;
        }
        if (results.length === 0) {
          return;
        }
        setActiveIndex((index) => Math.max(index - 1, 0));
        break;
      }
      case "Enter": {
        if (!open) {
          return;
        }
        event.preventDefault();
        const active = results[activeIndex];
        if (active) {
          selectConcept(active.id);
        }
        break;
      }
      case "Escape": {
        if (!open) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        break;
      }
      default:
        break;
    }
  };

  const selectedTitle = selectedConcept
    ? conceptTitle(selectedConcept)
    : value.trim()
      ? "不明なConcept"
      : "";
  const selectedTagLine = selectedConcept ? conceptDomainTagLine(selectedConcept) : "";
  const activeOptionId =
    open && results[activeIndex] ? `${listboxId}-option-${activeIndex}` : undefined;
  const showListbox = open && !disabled;

  return (
    <div
      className="block space-y-2"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
        }
      }}
    >
      <div className="space-y-1.5">
        <label htmlFor={inputId} className="block text-sm text-celestial-textMain">
          問い全体の関連 Concept（任意）
        </label>
        {value.trim() ? (
          <div className="flex items-start justify-between gap-2 rounded-lg border border-celestial-gold/30 bg-celestial-deepBlue/50 px-3 py-2">
            <div className="min-w-0">
              <p className="text-[11px] text-celestial-textSub">選択中</p>
              <p className="truncate text-sm font-medium text-celestial-textMain">{selectedTitle}</p>
              {selectedTagLine ? (
                <p className="truncate text-xs text-celestial-textSub">{selectedTagLine}</p>
              ) : null}
            </div>
            <button
              type="button"
              className="shrink-0 rounded-md border border-celestial-border px-2 py-1 text-xs text-celestial-softGold hover:bg-celestial-gold/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-celestial-gold/55"
              onClick={clearSelection}
              disabled={disabled}
            >
              クリア
            </button>
          </div>
        ) : (
          <p className="text-xs text-celestial-textSub">未選択（なし）</p>
        )}
      </div>

      <div className="relative">
        <input
          id={inputId}
          type="text"
          role="combobox"
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          placeholder="Concept名・分野タグで検索..."
          value={query}
          aria-expanded={showListbox}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={activeOptionId}
          aria-label="Conceptを検索（タイトル・分野タグで絞り込み）"
          className="w-full rounded-md border border-celestial-border bg-celestial-deepBlue px-3 py-2 text-sm text-celestial-textMain placeholder:text-celestial-textSub focus:outline-none focus-visible:ring-2 focus-visible:ring-celestial-gold/45 disabled:cursor-not-allowed disabled:opacity-50"
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if (!disabled) {
              setOpen(true);
            }
          }}
          onKeyDown={handleKeyDown}
        />

        {showListbox ? (
          <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-celestial-border bg-celestial-panel shadow-xl">
            {!needle ? (
              <p className="px-3 py-2.5 text-sm text-celestial-textSub">
                名前または分野タグを入力してください
              </p>
            ) : null}
            {needle && results.length === 0 ? (
              <p className="px-3 py-2.5 text-sm text-celestial-textSub" role="status">
                該当する Concept がありません
              </p>
            ) : null}
            <ul
              id={listboxId}
              role="listbox"
              hidden={!needle || results.length === 0}
              className="max-h-56 overflow-y-auto py-1"
            >
              {results.map((concept, index) => {
                const title = conceptTitle(concept);
                const tagLine = conceptDomainTagLine(concept);
                const active = index === activeIndex;
                return (
                  <li key={concept.id} className="px-1">
                    <button
                      type="button"
                      id={`${listboxId}-option-${index}`}
                      role="option"
                      tabIndex={-1}
                      aria-selected={active}
                      className={`flex w-full flex-col items-start gap-0.5 rounded-md px-3 py-2.5 text-left transition-colors focus:outline-none ${
                        active
                          ? "bg-celestial-gold/15 text-celestial-textMain"
                          : "text-celestial-textMain hover:bg-celestial-deepBlue/80"
                      }`}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => selectConcept(concept.id)}
                    >
                      <span className="w-full truncate text-sm font-medium">{title}</span>
                      {tagLine ? (
                        <span className="w-full truncate text-xs text-celestial-textSub">{tagLine}</span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
            {needle && results.length === QUIZ_CONCEPT_SEARCH_MAX ? (
              <p className="border-t border-celestial-border/80 px-3 py-1.5 text-[11px] text-celestial-textSub">
                上位{QUIZ_CONCEPT_SEARCH_MAX}件まで表示しています
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
};
