import { formatConceptRef } from "../../utils/quizStats";
import type { GlobalReviewCandidate } from "../../utils/review";
import { formatReviewPriorityLabel, formatReviewReasonDetail } from "../../utils/review";

type Props = {
  candidates: GlobalReviewCandidate[];
  titleById: Map<string, string>;
  onOpenConcept?: (conceptId: string) => void;
};

const priorityClass = (priority: GlobalReviewCandidate["priority"]): string => {
  if (priority === "high") {
    return "border-amber-400/50 bg-amber-400/10 text-amber-200";
  }
  if (priority === "medium") {
    return "border-celestial-gold/50 bg-celestial-gold/10 text-celestial-softGold";
  }
  return "border-celestial-border/60 bg-nordic-navy/40 text-celestial-textSub";
};

const masteryLine = (candidate: GlobalReviewCandidate): string => {
  if (candidate.mastery.state === "insufficient-data") {
    return `回答 ${candidate.mastery.attemptCount}回`;
  }
  if (candidate.mastery.state === "unlearned") {
    return "未学習";
  }
  return `理解度 ${candidate.mastery.masteryScore}`;
};

export const GlobalReviewCandidatesSection = ({ candidates, titleById, onOpenConcept }: Props) => (
  <section aria-labelledby="quiz-analysis-review-heading" className="space-y-3">
    <h2 id="quiz-analysis-review-heading" className="text-sm font-semibold text-celestial-softGold">
      今日の復習候補
    </h2>
    <p className="text-xs leading-relaxed text-celestial-textSub">
      理解度・直近の誤答・混同・再確認が必要な概念を、理由つきで並べています。期間フィルタの影響は受けず、全期間の学習状態から算出します。
    </p>
    {candidates.length === 0 ? (
      <p className="rounded-xl border border-celestial-border/50 bg-nordic-navy/30 px-4 py-2.5 text-sm text-celestial-textSub">
        現在、復習候補はありません。
      </p>
    ) : (
      <div className="grid gap-3 sm:grid-cols-2">
        {candidates.map((candidate) => {
          const name = formatConceptRef(candidate.conceptId, titleById);
          const stale = candidate.reasons.find((reason) => reason.type === "stale");
          return (
            <article
              key={candidate.conceptId}
              className="rounded-xl border border-celestial-border/60 bg-nordic-navy/40 p-4 backdrop-blur-sm"
              data-testid={`review-candidate-${candidate.conceptId}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="text-sm font-medium text-celestial-softGold">{name}</h3>
                <span
                  className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-medium tracking-wide ${priorityClass(candidate.priority)}`}
                >
                  優先度 {formatReviewPriorityLabel(candidate.priority)}
                </span>
              </div>
              <p className="mt-1 text-sm tabular-nums text-celestial-textMain">{masteryLine(candidate)}</p>
              {stale && stale.type === "stale" ? (
                <p className="mt-0.5 text-xs text-celestial-textSub">最終学習 {stale.daysSinceLastAnswer}日前</p>
              ) : null}
              <p className="mt-2 text-xs font-medium text-celestial-textSub">理由</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm text-celestial-textMain">
                {candidate.reasons.map((reason, index) => (
                  <li key={`${reason.type}-${reason.type === "frequent-confusion" ? reason.otherConceptId : index}`}>
                    {formatReviewReasonDetail(reason, titleById)}
                  </li>
                ))}
              </ul>
              {candidate.hasQuizQuestion ? null : (
                <p className="mt-2 text-xs leading-relaxed text-amber-300/90">
                  復習が必要ですが、対応する問題がありません
                </p>
              )}
              {onOpenConcept ? (
                <button
                  type="button"
                  className="mt-3 text-sm text-celestial-softGold underline decoration-celestial-gold/50 underline-offset-2 hover:decoration-celestial-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-celestial-gold/55 rounded"
                  onClick={() => onOpenConcept(candidate.conceptId)}
                >
                  Concept 詳細を開く
                </button>
              ) : null}
            </article>
          );
        })}
      </div>
    )}
  </section>
);
