import type { QuizConceptDefinitionStatus } from "../utils/resolveQuizConceptDefinition";

export type AnswerReviewItem = {
  /** 表示する文脈別定義（概念名はマスク済み） */
  displayText: string;
  /** この定義がどの概念の説明か（不明なら未指定） */
  conceptName?: string;
  /** 概念カードの通常定義（concept.definition） */
  conceptDefinition?: string;
  conceptDefinitionStatus?: QuizConceptDefinitionStatus;
};

type Props = {
  selected: AnswerReviewItem;
  correct: AnswerReviewItem;
};

const resolveConceptDefinitionText = (item: AnswerReviewItem): string => {
  if (item.conceptDefinitionStatus === "no-concept") {
    return "概念カード未登録";
  }
  if (item.conceptDefinitionStatus === "no-definition") {
    return "概念定義未登録";
  }
  return item.conceptDefinition?.trim() || "概念定義未登録";
};

const isMissingConceptDefinition = (item: AnswerReviewItem): boolean =>
  item.conceptDefinitionStatus === "no-concept" ||
  item.conceptDefinitionStatus === "no-definition" ||
  !item.conceptDefinition?.trim();

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
    <div className="mt-2 border-t border-celestial-border/30 pt-2">
      <p className="text-[11px] text-celestial-textSub/80">概念定義</p>
      <p
        className={`mt-0.5 text-sm leading-relaxed ${
          isMissingConceptDefinition(item)
            ? "text-celestial-textSub/80 italic"
            : "text-celestial-textSub"
        }`}
      >
        {resolveConceptDefinitionText(item)}
      </p>
    </div>
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
