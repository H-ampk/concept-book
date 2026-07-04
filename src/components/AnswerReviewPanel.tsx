import type { QuizTermDefinition } from "../utils/resolveQuizTermDefinition";
import { normalizeConceptTitle } from "../utils/normalizeConceptTitle";

type Props = {
  selected: QuizTermDefinition;
  correct: QuizTermDefinition;
};

const resolveDefinitionText = (item: QuizTermDefinition): string => {
  if (item.status === "no-concept") {
    return "概念カード未登録";
  }
  if (item.status === "no-definition") {
    return "定義未登録";
  }
  return item.definition;
};

const isMissing = (item: QuizTermDefinition): boolean =>
  item.status === "no-concept" || item.status === "no-definition";

const ReviewRow = ({
  label,
  labelClass,
  item
}: {
  label: string;
  labelClass: string;
  item: QuizTermDefinition;
}) => (
  <div className="rounded-lg border border-celestial-border/50 bg-celestial-deepBlue/25 p-3">
    <div className="flex flex-wrap items-center gap-2">
      <span className={`text-xs font-medium ${labelClass}`}>{label}</span>
      <span className="text-sm font-semibold text-celestial-textMain">
        {item.term || "—"}
      </span>
      {item.status === "context" ? (
        <span className="rounded-[8px] border border-celestial-border/60 bg-celestial-panel/60 px-1.5 py-0.5 text-[10px] text-celestial-softGold">
          この文脈での定義
        </span>
      ) : null}
    </div>
    <p
      className={`mt-1.5 text-sm leading-relaxed ${
        isMissing(item) ? "text-celestial-textSub/80 italic" : "text-celestial-textMain"
      }`}
    >
      {resolveDefinitionText(item)}
    </p>
  </div>
);

/** 不正解時に、選択語句と正解語句の定義をクイズ画面内で確認するための復習カード */
export const AnswerReviewPanel = ({ selected, correct }: Props) => {
  const sameTerm =
    normalizeConceptTitle(selected.term) === normalizeConceptTitle(correct.term) &&
    normalizeConceptTitle(correct.term).length > 0;

  return (
    <div className="space-y-2 rounded-xl border border-celestial-border/60 bg-celestial-panel/40 p-3">
      <p className="text-xs font-medium text-celestial-softGold">定義の確認</p>
      {sameTerm ? (
        <ReviewRow label="正解" labelClass="text-celestial-gold" item={correct} />
      ) : (
        <>
          <ReviewRow label="あなたの回答" labelClass="text-celestial-danger" item={selected} />
          <ReviewRow label="正解" labelClass="text-celestial-gold" item={correct} />
        </>
      )}
    </div>
  );
};
