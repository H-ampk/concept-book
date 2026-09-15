import {
  EVIDENCE_KIND_LABELS,
  getConceptEvidenceProfile,
  OBSERVATION_OUTCOME_LABELS,
  RECOGNITION_AHEAD_DETAIL,
  RECOGNITION_RECALL_GAP_STATE_LABELS,
  type ConceptEvidenceKindSummary
} from "../../utils/mastery/getConceptEvidenceProfile";
import type { ConceptMasteryPoint } from "../../utils/mastery/types";

type Props = {
  history: ConceptMasteryPoint[];
};

const formatKindCounts = (summary: ConceptEvidenceKindSummary): string => {
  if (summary.kind === "recognition") {
    return `${summary.attemptCount}回　正解${summary.correctCount} / 誤答${summary.incorrectCount}`;
  }
  return `${summary.attemptCount}回　正解${summary.correctCount} / 部分${summary.partialCount} / 誤答${summary.incorrectCount}`;
};

const EvidenceKindBlock = ({ summary }: { summary: ConceptEvidenceKindSummary }) => {
  const label = EVIDENCE_KIND_LABELS[summary.kind];
  const unobserved = summary.attemptCount === 0;

  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-nordic-textMuted">{label}</dt>
      {unobserved ? (
        <>
          <dd className="mt-1 text-sm text-nordic-textSecondary">未確認</dd>
          <dd className="text-sm tabular-nums text-nordic-textSecondary">0回</dd>
        </>
      ) : (
        <>
          <dd className="mt-1 text-sm text-nordic-textPrimary">
            直近: {summary.latestOutcome ? OBSERVATION_OUTCOME_LABELS[summary.latestOutcome] : "未確認"}
          </dd>
          <dd className="text-sm tabular-nums text-nordic-textSecondary">{formatKindCounts(summary)}</dd>
        </>
      )}
    </div>
  );
};

/**
 * #164: 形式別の新しい理解度スコアは作らない。
 * ConceptMasteryPoint の evidence metadata から件数・最新結果・説明的な状態だけを表示する。
 */
export const ConceptEvidenceProfile = ({ history }: Props) => {
  const profile = getConceptEvidenceProfile(history);
  const stateLabel = RECOGNITION_RECALL_GAP_STATE_LABELS[profile.state];

  return (
    <section>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-nordic-textMuted">
        再認・再生の確認
      </h3>
      <p className="text-xs text-nordic-textSecondary">確認状態</p>
      <p className="mt-1 text-sm font-medium text-nordic-textPrimary">{stateLabel}</p>
      {profile.state === "recognition-ahead" && (
        <p className="mt-1 text-sm leading-relaxed text-nordic-textSecondary">{RECOGNITION_AHEAD_DETAIL}</p>
      )}
      <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <EvidenceKindBlock summary={profile.recognition} />
        <EvidenceKindBlock summary={profile.recall} />
      </dl>
      <p className="mt-3 text-xs leading-relaxed text-nordic-textMuted">
        直近の四択・入力式の回答結果を比較した表示です。理解度そのものとは別の診断情報です。
      </p>
    </section>
  );
};
