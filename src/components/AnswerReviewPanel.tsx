import type { QuizConceptDefinitionStatus } from "../utils/resolveQuizConceptDefinition";
import type { QuizContextDefinitionStatus } from "../utils/resolveQuizContextDefinition";

export type AnswerReviewItem = {
  /** 選択した概念名 */
  conceptName?: string;
  /** 文脈別定義（回答後はマスクなしの本文） */
  contextDefinitionText: string;
  contextDefinitionStatus?: QuizContextDefinitionStatus;
  /** 概念カードの通常定義 */
  conceptDefinition?: string;
  conceptDefinitionStatus?: QuizConceptDefinitionStatus;
};

type Props = {
  selected?: AnswerReviewItem;
  correct: AnswerReviewItem;
};

const resolveContextDefinitionText = (item: AnswerReviewItem): string => {
  if (item.contextDefinitionStatus === "no-concept") {
    return "概念カード未登録";
  }
  if (item.contextDefinitionStatus === "no-context-definition") {
    return "文脈別定義未登録";
  }
  return item.contextDefinitionText.trim() || "文脈別定義未登録";
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

const isMissingContextDefinition = (item: AnswerReviewItem): boolean =>
  item.contextDefinitionStatus === "no-concept" ||
  item.contextDefinitionStatus === "no-context-definition" ||
  !item.contextDefinitionText.trim();

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
    {item.conceptName ? (
      <p className="mt-1 text-sm font-semibold text-celestial-textMain">{item.conceptName}</p>
    ) : null}
    <div className="mt-1.5">
      <p className="text-[11px] text-celestial-textSub/80">文脈での説明</p>
      <p
        className={`mt-0.5 text-sm leading-relaxed ${
          isMissingContextDefinition(item)
            ? "text-celestial-textSub/80 italic"
            : "text-celestial-textMain"
        }`}
      >
        {resolveContextDefinitionText(item)}
      </p>
    </div>
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

/** 回答後に、概念名・文脈別定義・通常定義をクイズ画面内で確認する復習カード */
export const AnswerReviewPanel = ({ selected, correct }: Props) => (
  <div className="space-y-2 rounded-xl border border-celestial-border/60 bg-celestial-panel/40 p-3">
    <p className="text-xs font-medium text-celestial-softGold">定義の確認</p>
    {selected ? (
      <ReviewRow label="あなたの回答" labelClass="text-celestial-danger" item={selected} />
    ) : null}
    <ReviewRow label="正解" labelClass="text-celestial-gold" item={correct} />
  </div>
);
