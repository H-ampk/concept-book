import type { Concept } from "../../types/concept";
import type { SelectedContextReviewResult } from "../../utils/review";
import {
  formatWeakPrerequisiteReason,
  formatWeakPrerequisiteState
} from "../../utils/review";

type Props = {
  targetTitle: string;
  hasDirectPrerequisites: boolean;
  result: SelectedContextReviewResult;
  conceptMap: Map<string, Concept>;
  onSelectRelated: (id: string) => void;
};

export const SelectedContextReviewCandidatesSection = ({
  targetTitle,
  hasDirectPrerequisites,
  result,
  conceptMap,
  onSelectRelated
}: Props) => {
  if (result.status !== "ok" || result.targetAlreadyMastered) {
    return null;
  }
  if (result.candidates.length === 0 && !hasDirectPrerequisites) {
    return null;
  }

  return (
    <div className="space-y-3" data-testid="selected-context-review">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-nordic-textMuted">
        「{targetTitle}」を学ぶための前提復習
      </h3>
      <p className="text-xs leading-relaxed text-nordic-textMuted">
        この概念を学ぶためにまだ十分ではない前提です。学習順序（何から順に学ぶか）とは別に、前提を補強すべき理由を示します。
      </p>
      {result.candidates.length === 0 ? (
        <p className="text-sm text-nordic-textSecondary">前提は十分に満たされています</p>
      ) : (
        <ol className="space-y-3">
          {result.candidates.map((candidate, index) => {
            const itemConcept = conceptMap.get(candidate.conceptId);
            return (
              <li
                key={candidate.conceptId}
                className="space-y-1"
                data-testid={`selected-context-review-candidate-${candidate.conceptId}`}
              >
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-sm text-nordic-textMuted">{index + 1}.</span>
                  {itemConcept ? (
                    <button
                      type="button"
                      className="detail-related-link"
                      onClick={() => onSelectRelated(candidate.conceptId)}
                    >
                      {itemConcept.title}
                    </button>
                  ) : (
                    <span className="text-xs text-amber-800">不明なID: {candidate.conceptId}</span>
                  )}
                </div>
                <p className="text-sm text-nordic-textSecondary">
                  {formatWeakPrerequisiteReason(candidate.reason)}
                </p>
                <p className="text-xs text-nordic-textMuted">
                  状態: {formatWeakPrerequisiteState(candidate.reason)}
                </p>
                {candidate.hasQuizQuestion ? null : (
                  <p className="text-xs leading-relaxed text-amber-800">
                    復習が必要ですが、対応する問題がありません
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
};
