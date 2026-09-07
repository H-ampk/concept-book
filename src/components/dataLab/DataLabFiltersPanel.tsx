const FILTER_SLOTS = [
  { id: "period", label: "期間", value: "未設定" },
  { id: "concept", label: "Concept", value: "未設定" },
  { id: "domain", label: "分野", value: "未設定" },
  { id: "deck", label: "Deck", value: "未設定" },
  { id: "correctness", label: "正誤", value: "すべて" }
] as const;

export const DataLabFiltersPanel = () => {
  return (
    <section
      className="relative rounded-3xl border border-celestial-border bg-celestial-panel/90 p-5 shadow-celestial backdrop-blur-md decorated-card sm:p-6"
      aria-labelledby="data-lab-filters-title"
    >
      <span className="card-corner card-corner-top-left" aria-hidden="true" />
      <span className="card-corner card-corner-top-right" aria-hidden="true" />
      <span className="card-corner card-corner-bottom-left" aria-hidden="true" />
      <span className="card-corner card-corner-bottom-right" aria-hidden="true" />

      <div className="relative z-[1] space-y-4">
        <div className="space-y-1">
          <h2 id="data-lab-filters-title" className="text-sm font-semibold text-celestial-softGold">
            Filters
          </h2>
          <p className="text-xs text-celestial-textSub">後続Issueで実装。いまは条件を変更できません。</p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {FILTER_SLOTS.map((slot) => (
            <div key={slot.id} className="min-w-0">
              <label htmlFor={`data-lab-filter-${slot.id}`} className="mb-1.5 block text-xs font-medium text-celestial-textSub">
                {slot.label}
              </label>
              <button
                id={`data-lab-filter-${slot.id}`}
                type="button"
                disabled
                className="w-full cursor-not-allowed rounded-md border border-celestial-border/60 bg-nordic-navy/40 px-3 py-2 text-left text-sm text-celestial-textSub opacity-70"
              >
                {slot.value}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
