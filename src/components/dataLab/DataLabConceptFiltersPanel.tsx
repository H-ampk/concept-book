import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { conceptStatusList, type Concept, type ConceptStatus } from "../../types/concept";
import type { DataLabFilterChip } from "../../utils/dataLab/describeDataLabConceptFilters";
import {
  DEFAULT_DATA_LAB_CONCEPT_FILTERS,
  type DataLabConceptFavoriteFilter,
  type DataLabConceptFilters
} from "../../utils/dataLab/filterDataLabConcepts";

type Props = {
  filters: DataLabConceptFilters;
  onChange: Dispatch<SetStateAction<DataLabConceptFilters>>;
  concepts: Concept[];
  chips: DataLabFilterChip[];
};

const inputClass =
  "w-full rounded-md border border-celestial-border/60 bg-nordic-navy/50 px-3 py-2 text-sm text-celestial-textMain focus:outline-none focus-visible:ring-2 focus-visible:ring-celestial-gold/55";

const STATUS_LABEL: Record<ConceptStatus, string> = {
  active: "稼働中",
  researching: "調査中",
  unclear: "未整理",
  draft: "下書き",
  archived: "保管"
};

const toggleValue = <T extends string>(values: T[], value: T): T[] =>
  values.includes(value) ? values.filter((item) => item !== value) : [...values, value];

type ChecklistProps = {
  id: string;
  label: string;
  items: { id: string; label: string }[];
  selected: string[];
  onToggle: (id: string) => void;
  emptyLabel: string;
};

const SearchableChecklist = ({ id, label, items, selected, onToggle, emptyLabel }: ChecklistProps) => {
  const [query, setQuery] = useState("");
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return items;
    }
    return items.filter((item) => item.label.toLowerCase().includes(q) || item.id.toLowerCase().includes(q));
  }, [items, query]);

  const summary = selected.length === 0 ? "すべて" : `${selected.length}件選択`;

  return (
    <div className="min-w-0">
      <p className="mb-1.5 text-xs font-medium text-celestial-textSub" id={`${id}-label`}>
        {label}
      </p>
      <details className="rounded-md border border-celestial-border/60 bg-nordic-navy/40">
        <summary
          className="cursor-pointer list-none px-3 py-2 text-sm text-celestial-textMain marker:content-none [&::-webkit-details-marker]:hidden"
          aria-labelledby={`${id}-label`}
        >
          {summary}
        </summary>
        <div className="space-y-2 border-t border-celestial-border/50 p-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="検索"
            aria-label={`${label}を検索`}
            className={inputClass}
          />
          <div className="max-h-40 overflow-y-auto" role="group" aria-labelledby={`${id}-label`}>
            {visible.length === 0 ? (
              <p className="px-1 py-2 text-xs text-celestial-textSub">{emptyLabel}</p>
            ) : (
              visible.map((item) => {
                const checked = selected.includes(item.id);
                return (
                  <label
                    key={item.id}
                    className="flex cursor-pointer items-start gap-2 rounded px-1 py-1 text-sm text-celestial-textMain hover:bg-celestial-gold/10"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggle(item.id)}
                      className="mt-0.5"
                    />
                    <span className="min-w-0 break-words">{item.label}</span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      </details>
    </div>
  );
};

export const DataLabConceptFiltersPanel = ({ filters, onChange, concepts, chips }: Props) => {
  const domainItems = useMemo(() => {
    const tags = new Set<string>();
    concepts.forEach((c) => {
      (c.domainTags ?? []).forEach((tag) => {
        const t = tag.trim();
        if (t) {
          tags.add(t);
        }
      });
    });
    return [...tags]
      .sort((a, b) => a.localeCompare(b, "ja"))
      .map((tag) => ({ id: tag, label: tag }));
  }, [concepts]);

  const researchItems = useMemo(() => {
    const tags = new Set<string>();
    concepts.forEach((c) => {
      (c.researchTags ?? []).forEach((tag) => {
        const t = tag.trim();
        if (t) {
          tags.add(t);
        }
      });
    });
    return [...tags]
      .sort((a, b) => a.localeCompare(b, "ja"))
      .map((tag) => ({ id: tag, label: tag }));
  }, [concepts]);

  const statusItems = useMemo(
    () => conceptStatusList.map((status) => ({ id: status, label: STATUS_LABEL[status] })),
    []
  );

  return (
    <section
      className="relative min-w-0 max-w-full rounded-3xl border border-celestial-border bg-celestial-panel/90 p-5 shadow-celestial backdrop-blur-md decorated-card sm:p-6"
      aria-labelledby="data-lab-concept-filters-title"
      data-testid="data-lab-concept-filters"
    >
      <div className="relative z-[1] space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h2 id="data-lab-concept-filters-title" className="text-sm font-semibold text-celestial-softGold">
              Concept Filters
            </h2>
            <p className="text-xs text-celestial-textSub">
              検索・分野・研究タグ・status・お気に入りで Concept データを絞り込みます。
            </p>
          </div>
          <button
            type="button"
            onClick={() => onChange(DEFAULT_DATA_LAB_CONCEPT_FILTERS)}
            className="header-nav-button shrink-0 rounded-md border border-celestial-border/60 bg-transparent px-3 py-2 text-sm text-celestial-textMain hover:border-celestial-gold/50 hover:text-celestial-softGold focus:outline-none focus-visible:ring-2 focus-visible:ring-celestial-gold/55"
          >
            条件をリセット
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="min-w-0 sm:col-span-2 xl:col-span-1">
            <label htmlFor="data-lab-concept-filter-query" className="mb-1.5 block text-xs font-medium text-celestial-textSub">
              検索
            </label>
            <input
              id="data-lab-concept-filter-query"
              type="search"
              value={filters.query}
              onChange={(e) => onChange((prev) => ({ ...prev, query: e.target.value }))}
              placeholder="タイトル / ID"
              className={inputClass}
            />
          </div>

          <SearchableChecklist
            id="data-lab-concept-filter-domain"
            label="分野"
            items={domainItems}
            selected={filters.domainTags}
            onToggle={(id) => onChange((prev) => ({ ...prev, domainTags: toggleValue(prev.domainTags, id) }))}
            emptyLabel="一致する分野がありません。"
          />
          <SearchableChecklist
            id="data-lab-concept-filter-research"
            label="研究タグ"
            items={researchItems}
            selected={filters.researchTags}
            onToggle={(id) =>
              onChange((prev) => ({ ...prev, researchTags: toggleValue(prev.researchTags, id) }))
            }
            emptyLabel="一致する研究タグがありません。"
          />
          <SearchableChecklist
            id="data-lab-concept-filter-status"
            label="status"
            items={statusItems}
            selected={filters.statuses}
            onToggle={(id) =>
              onChange((prev) => ({
                ...prev,
                statuses: toggleValue(prev.statuses, id as ConceptStatus)
              }))
            }
            emptyLabel="一致する status がありません。"
          />

          <div className="min-w-0">
            <label
              htmlFor="data-lab-concept-filter-favorite"
              className="mb-1.5 block text-xs font-medium text-celestial-textSub"
            >
              お気に入り
            </label>
            <select
              id="data-lab-concept-filter-favorite"
              value={filters.favorite}
              onChange={(e) =>
                onChange((prev) => ({
                  ...prev,
                  favorite: e.target.value as DataLabConceptFavoriteFilter
                }))
              }
              className={inputClass}
            >
              <option value="all">すべて</option>
              <option value="favorite">お気に入りのみ</option>
              <option value="notFavorite">お気に入り以外</option>
            </select>
          </div>
        </div>

        {chips.length > 0 ? (
          <div className="flex flex-wrap gap-2" data-testid="data-lab-concept-active-filters">
            {chips.map((chip) => (
              <span
                key={chip.id}
                className="rounded-full border border-celestial-gold/40 bg-celestial-gold/10 px-3 py-1 text-xs text-celestial-softGold"
              >
                {chip.label}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-celestial-textSub">適用中の条件はありません（全件）。</p>
        )}
      </div>
    </section>
  );
};
