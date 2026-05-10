import { LAB_MENU_ITEMS, type LabRoute } from "../constants/labRoutes";

type Props = {
  route: LabRoute;
  onBack: () => void;
};

export const LabPlaceholderPage = ({ route, onBack }: Props) => {
  const item = LAB_MENU_ITEMS.find((entry) => entry.route === route);
  if (!item) {
    return null;
  }

  return (
    <section
      className="mx-auto max-w-2xl space-y-8 rounded-3xl border border-celestial-border bg-celestial-panel/90 p-8 shadow-celestial backdrop-blur-md decorated-card md:p-10"
      aria-labelledby="lab-placeholder-title"
    >
      <span className="card-corner card-corner-top-left" aria-hidden="true" />
      <span className="card-corner card-corner-top-right" aria-hidden="true" />
      <span className="card-corner card-corner-bottom-left" aria-hidden="true" />
      <span className="card-corner card-corner-bottom-right" aria-hidden="true" />

      <div className="relative z-[1] space-y-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-celestial-gold/80">Lab · 観測室</p>
        <h1 id="lab-placeholder-title" className="text-2xl font-semibold tracking-wide text-celestial-textMain md:text-3xl">
          {item.label}
        </h1>
        <p className="text-sm leading-relaxed text-celestial-textSub md:text-base">{item.description}</p>

        <div className="rounded-xl border border-celestial-border/60 bg-nordic-navy/40 px-5 py-6 backdrop-blur-sm">
          <p className="text-center text-sm font-medium text-celestial-softGold md:text-base">
            準備中
          </p>
          <p className="mt-2 text-center text-xs text-celestial-textSub md:text-sm">Coming soon</p>
          <p className="mt-4 text-center text-xs leading-relaxed text-nordic-textMuted">
            禁術アーカイブの研究室として、順次機能を接続する予定です。
          </p>
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="button"
            onClick={onBack}
            className="header-nav-button rounded-md border border-celestial-gold/50 bg-transparent text-celestial-softGold hover:bg-celestial-gold/10"
          >
            戻る（概念へ）
          </button>
        </div>
        <p className="text-xs text-nordic-textMuted">
          画面上部の「概念」「文脈」「Lab」「設定」からもいつでも移動できます。
        </p>
      </div>
    </section>
  );
};
