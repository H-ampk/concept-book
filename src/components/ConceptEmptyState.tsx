type Props = {
  variant: "none" | "filtered";
  onCreateConcept?: () => void;
  onOpenGuide?: () => void;
  createDisabled?: boolean;
};

export const ConceptEmptyState = ({
  variant,
  onCreateConcept,
  onOpenGuide,
  createDisabled = false
}: Props) => {
  if (variant === "filtered") {
    return (
      <p className="concept-index-empty" data-testid="concept-empty-filtered">
        条件に一致する Concept がありません。
        <br />
        検索条件やフィルタを変更してください。
      </p>
    );
  }

  return (
    <section
      className="concept-index-empty space-y-3 rounded-lg border border-[rgba(110,140,155,0.22)] bg-white/70 p-4"
      data-testid="concept-empty-none"
    >
      <h2 className="text-base font-semibold text-celestial-textMain">最初の Concept を登録してみましょう</h2>
      <p className="text-sm leading-relaxed">
        ConceptBook では、勉強している用語を Concept として登録するところから始めます。
      </p>
      <p className="text-sm leading-relaxed">
        たとえば「勾配降下法」「TCP」「認知的不協和」のような、いま学んでいる言葉を1つ登録してみてください。
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="action-button px-4 py-2 text-sm"
          onClick={onCreateConcept}
          disabled={createDisabled}
        >
          Concept を追加する
        </button>
        <button type="button" className="index-text-button" onClick={onOpenGuide}>
          使い方を見る
        </button>
      </div>
    </section>
  );
};
