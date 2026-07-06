import type { QuizDataSummary } from "../utils/quiz/quizDataCleanup";

type Props = {
  summary: QuizDataSummary | null;
  loading?: boolean;
  onDeleteOrphans: () => void;
  onDeleteAll: () => void;
};

const CountRow = ({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) => (
  <p>
    {label}:{" "}
    <span className={highlight ? "font-semibold text-amber-200" : undefined}>{value}</span>
  </p>
);

/** クイズ集の有無に関わらず常時表示するクイズデータ管理パネル */
export const QuizDataPanel = ({ summary, loading = false, onDeleteOrphans, onDeleteAll }: Props) => {
  const orphanCount = summary?.orphanQuestionCount ?? 0;
  const countLabel = (value: number | undefined) =>
    loading ? "読み込み中…" : String(value ?? 0);

  return (
    <div
      className="rounded-xl border border-celestial-border/60 bg-celestial-deepBlue/20 p-4"
      aria-labelledby="quiz-data-panel-title"
    >
      <p id="quiz-data-panel-title" className="text-xs font-medium text-celestial-softGold">
        クイズデータ
      </p>
      <div className="mt-2 grid gap-1 text-sm text-celestial-textSub sm:grid-cols-2">
        <CountRow label="クイズ集" value={countLabel(summary?.deckCount)} />
        <CountRow label="問題" value={countLabel(summary?.questionCount)} />
        <CountRow label="出題プール対象" value={countLabel(summary?.referencedQuestionCount)} />
        <CountRow
          label="孤児問題"
          value={countLabel(summary?.orphanQuestionCount)}
          highlight={!loading && orphanCount > 0}
        />
        <p className="sm:col-span-2">回答履歴: {countLabel(summary?.attemptLogCount)}</p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onDeleteOrphans}
          disabled={loading || orphanCount === 0}
          className="rounded-lg border border-celestial-gold/40 px-3 py-1.5 text-xs text-celestial-softGold hover:bg-celestial-gold/10 disabled:cursor-not-allowed disabled:opacity-45"
        >
          孤児問題を削除
        </button>
        <button
          type="button"
          onClick={onDeleteAll}
          disabled={loading}
          className="rounded-lg border border-celestial-danger/50 px-3 py-1.5 text-xs text-celestial-danger hover:bg-celestial-danger/10 disabled:cursor-not-allowed disabled:opacity-45"
        >
          クイズデータを完全削除
        </button>
      </div>
    </div>
  );
};
