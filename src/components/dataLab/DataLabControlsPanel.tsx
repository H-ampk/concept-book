const CONTROL_SLOTS = [
  { id: "axis", label: "集計軸", value: "未設定" },
  { id: "metric", label: "指標", value: "未設定" },
  { id: "display", label: "表示", value: "テーブル" }
] as const;

export const DataLabControlsPanel = () => {
  return (
    <section
      className="relative rounded-3xl border border-celestial-border bg-celestial-panel/90 p-5 shadow-celestial backdrop-blur-md decorated-card sm:p-6"
      aria-labelledby="data-lab-controls-title"
    >
      <span className="card-corner card-corner-top-left" aria-hidden="true" />
      <span className="card-corner card-corner-top-right" aria-hidden="true" />
      <span className="card-corner card-corner-bottom-left" aria-hidden="true" />
      <span className="card-corner card-corner-bottom-right" aria-hidden="true" />

      <div className="relative z-[1] space-y-4">
        <div className="space-y-1">
          <h2 id="data-lab-controls-title" className="text-sm font-semibold text-celestial-softGold">
            分析条件
          </h2>
          <p className="text-xs text-celestial-textSub">後続Issueで実装。集計・可視化の条件はまだ選べません。</p>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {CONTROL_SLOTS.map((slot) => (
            <div key={slot.id} className="min-w-0">
              <label htmlFor={`data-lab-control-${slot.id}`} className="mb-1.5 block text-xs font-medium text-celestial-textSub">
                {slot.label}
              </label>
              <button
                id={`data-lab-control-${slot.id}`}
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
