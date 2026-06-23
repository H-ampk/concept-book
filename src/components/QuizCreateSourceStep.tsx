import type { QuizCreateSourceType } from "../types/quiz";

type Props = {
  onSelect: (sourceType: QuizCreateSourceType) => void;
};

const SOURCE_OPTIONS: Array<{
  type: QuizCreateSourceType;
  title: string;
  description: string;
}> = [
  {
    type: "contextualConceptCard",
    title: "文脈別カードから作成",
    description: "概念ごとの文脈別定義を使って、穴埋めクイズを作成します。"
  },
  {
    type: "contextCard",
    title: "文脈カードから作成",
    description:
      "授業ノート・資料まとめなどの文脈カード全体から、重要語句をもとにクイズを作成します。"
  }
];

export const QuizCreateSourceStep = ({ onSelect }: Props) => {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-celestial-textMain">クイズを作成</h2>
        <p className="mt-1 text-sm text-celestial-textSub">どこからクイズを作りますか？</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {SOURCE_OPTIONS.map((option) => (
          <button
            key={option.type}
            type="button"
            onClick={() => onSelect(option.type)}
            className="group rounded-2xl border border-celestial-border bg-celestial-deepBlue/30 p-4 text-left transition hover:border-celestial-gold/50 hover:bg-celestial-gold/10 active:scale-[0.99] active:border-celestial-gold/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-celestial-gold/55"
          >
            <span className="block text-base font-semibold text-celestial-softGold group-hover:text-celestial-gold">
              {option.title}
            </span>
            <span className="mt-2 block text-sm leading-relaxed text-celestial-textSub">
              {option.description}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
