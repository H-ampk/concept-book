import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import type { Concept } from "../../types/concept";
import type { QuizDeck } from "../../types/quiz";
import type { DataLabFilterChip } from "../../utils/dataLab/describeDataLabFilters";
import { DEFAULT_DATA_LAB_FILTERS, type DataLabCorrectness, type DataLabFilters } from "../../utils/dataLab/filterDataLabLogs";

type Props = {
  filters: DataLabFilters;
  onChange: Dispatch<SetStateAction<DataLabFilters>>;
  concepts: Concept[];
  decks: QuizDeck[];
  chips: DataLabFilterChip[];
};

const inputClass =
  "w-full rounded-md border border-celestial-border/60 bg-nordic-navy/50 px-3 py-2 text-sm text-celestial-textMain focus:outline-none focus-visible:ring-2 focus-visible:ring-celestial-gold/55";

const toggleValue = (values: string[], value: string): string[] =>
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

export const DataLabFiltersPanel = ({ filters, onChange, concepts, decks, chips }: Props) => {
  const conceptItems = useMemo(
    () =>
      [...concepts]
        .sort((a, b) => (a.title || "").localeCompare(b.title || "", "ja"))
        .map((c) => ({ id: c.id, label: c.title.trim() || c.id })),
    [concepts]
  );

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

  const deckItems = useMemo(
    () =>
      [...decks]
        .sort((a, b) => (a.title || "").localeCompare(b.title || "", "ja"))
        .map((d) => ({ id: d.id, label: d.title.trim() || d.id })),
    [decks]
  );

  return (
    <section
      className="relative min-w-0 max-w-full rounded-3xl border border-celestial-border bg-celestial-panel/90 p-5 shadow-celestial backdrop-blur-md decorated-card sm:p-6"
      aria-labelledby="data-lab-filters-title"
    >
      <span className="card-corner card-corner-top-left" aria-hidden="true" />
      <span className="card-corner card-corner-top-right" aria-hidden="true" />
      <span className="card-corner card-corner-bottom-left" aria-hidden="true" />
      <span className="card-corner card-corner-bottom-right" aria-hidden="true" />

      <div className="relative z-[1] space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h2 id="data-lab-filters-title" className="text-sm font-semibold text-celestial-softGold">
              Filters
            </h2>
            <p className="text-xs text-celestial-textSub">期間・Concept・分野・Deck・正誤で学習ログを絞り込みます。</p>
          </div>
          <button
            type="button"
            onClick={() => onChange(DEFAULT_DATA_LAB_FILTERS)}
            className="header-nav-button shrink-0 rounded-md border border-celestial-border/60 bg-transparent px-3 py-2 text-sm text-celestial-textMain hover:border-celestial-gold/50 hover:text-celestial-softGold focus:outline-none focus-visible:ring-2 focus-visible:ring-celestial-gold/55"
          >
            条件をリセット
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <div className="min-w-0 sm:col-span-2">
            <p className="mb-1.5 text-xs font-medium text-celestial-textSub">期間</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="min-w-0 flex-1 text-xs text-celestial-textSub">
                開始日
                <input
                  id="data-lab-filter-date-from"
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => onChange((prev) => ({ ...prev, dateFrom: e.target.value }))}
                  className={`${inputClass} mt-1`}
                />
              </label>
              <label className="min-w-0 flex-1 text-xs text-celestial-textSub">
                終了日
                <input
                  id="data-lab-filter-date-to"
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => onChange((prev) => ({ ...prev, dateTo: e.target.value }))}
                  className={`${inputClass} mt-1`}
                />
              </label>
            </div>
          </div>

          <SearchableChecklist
            id="data-lab-filter-concept"
            label="Concept"
            items={conceptItems}
            selected={filters.conceptIds}
            onToggle={(id) => onChange((prev) => ({ ...prev, conceptIds: toggleValue(prev.conceptIds, id) }))}
            emptyLabel="一致する Concept がありません。"
          />
          <SearchableChecklist
            id="data-lab-filter-domain"
            label="分野"
            items={domainItems}
            selected={filters.domainTags}
            onToggle={(id) => onChange((prev) => ({ ...prev, domainTags: toggleValue(prev.domainTags, id) }))}
            emptyLabel="一致する分野がありません。"
          />
          <SearchableChecklist
            id="data-lab-filter-deck"
            label="Deck"
            items={deckItems}
            selected={filters.deckIds}
            onToggle={(id) => onChange((prev) => ({ ...prev, deckIds: toggleValue(prev.deckIds, id) }))}
            emptyLabel="一致する Deck がありません。"
          />

          <div className="min-w-0">
            <label htmlFor="data-lab-filter-correctness" className="mb-1.5 block text-xs font-medium text-celestial-textSub">
              回答結果
            </label>
            <select
              id="data-lab-filter-correctness"
              value={filters.correctness}
              onChange={(e) =>
                onChange((prev) => ({ ...prev, correctness: e.target.value as DataLabCorrectness }))
              }
              className={inputClass}
            >
              <option value="all">すべて</option>
              <option value="correct">正答のみ</option>
              <option value="incorrect">誤答のみ</option>
            </select>
          </div>
        </div>

        {chips.length > 0 ? (
          <div className="flex flex-wrap gap-2" data-testid="data-lab-active-filters">
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
