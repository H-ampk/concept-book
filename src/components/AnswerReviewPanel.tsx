export type AnswerReviewItem = {
  /** 表示する文脈別定義（概念名はマスク済み） */
  displayText: string;
  /** この定義がどの概念の説明か（不明なら未指定） */
  conceptName?: string;
};

type Props = {
  selected: AnswerReviewItem;
  correct: AnswerReviewItem;
};

const ReviewRow = ({
  label,
  labelClass,
  item
}: {
  label: string;
  labelClass: string;
  item: AnswerReviewItem;
}) => (
  <div className="rounded-lg border border-celestial-border/50 bg-celestial-deepBlue/25 p-3">
    <p className={`text-xs font-medium ${labelClass}`}>{label}</p>
    <p className="mt-1 text-sm leading-relaxed text-celestial-textMain">
      {item.displayText || "—"}
    </p>
    {item.conceptName ? (
      <p className="mt-1 text-[11px] text-celestial-textSub">
        これは「{item.conceptName}」の説明です。
      </p>
    ) : null}
  </div>
);

/** 不正解時に、選んだ定義と正解の定義がそれぞれどの概念の説明かを確認する復習カード */
export const AnswerReviewPanel = ({ selected, correct }: Props) => (
  <div className="space-y-2 rounded-xl border border-celestial-border/60 bg-celestial-panel/40 p-3">
    <p className="text-xs font-medium text-celestial-softGold">定義の確認</p>
    <ReviewRow label="あなたの回答" labelClass="text-celestial-danger" item={selected} />
    <ReviewRow label="正解" labelClass="text-celestial-gold" item={correct} />
  </div>
);
