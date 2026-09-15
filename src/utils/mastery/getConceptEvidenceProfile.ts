import type {
  ConceptMasteryPoint,
  MasteryEvidenceKind,
  MasteryObservationOutcome
} from "./types";

/**
 * #164 では形式別の新しい理解度スコアを作らず、
 * ConceptMasteryPoint の evidence metadata から
 * 件数・最新結果・説明的な状態を導出する。
 *
 * recognition-ahead は真の認知能力差ではなく、
 * 各形式の直近観測の差である。derived data であり IndexedDB には保存しない。
 */
export type ConceptEvidenceKindSummary = {
  kind: MasteryEvidenceKind;
  attemptCount: number;
  correctCount: number;
  partialCount: number;
  incorrectCount: number;
  latestOutcome: MasteryObservationOutcome | null;
  latestAnsweredAt: string | null;
};

export type RecognitionRecallGapState =
  | "no-evidence"
  | "recognition-only"
  | "recall-only"
  | "both-confirmed"
  | "recognition-ahead"
  | "recall-ahead"
  | "both-weak";

export type ConceptEvidenceProfile = {
  recognition: ConceptEvidenceKindSummary;
  recall: ConceptEvidenceKindSummary;
  state: RecognitionRecallGapState;
};

const emptySummary = (kind: MasteryEvidenceKind): ConceptEvidenceKindSummary => ({
  kind,
  attemptCount: 0,
  correctCount: 0,
  partialCount: 0,
  incorrectCount: 0,
  latestOutcome: null,
  latestAnsweredAt: null
});

const outcomeRank = (outcome: MasteryObservationOutcome): number => {
  if (outcome === "correct") {
    return 2;
  }
  if (outcome === "partial") {
    return 1;
  }
  return 0;
};

const isLaterPoint = (candidate: ConceptMasteryPoint, current: ConceptMasteryPoint | null): boolean => {
  if (!current) {
    return true;
  }
  const timeCmp = candidate.answeredAt.localeCompare(current.answeredAt);
  if (timeCmp !== 0) {
    return timeCmp > 0;
  }
  if (candidate.attemptIndex !== current.attemptIndex) {
    return candidate.attemptIndex > current.attemptIndex;
  }
  return candidate.quizAttemptLogId.localeCompare(current.quizAttemptLogId) > 0;
};

const resolveGapState = (
  recognition: ConceptEvidenceKindSummary,
  recall: ConceptEvidenceKindSummary
): RecognitionRecallGapState => {
  const hasRecognition = recognition.attemptCount > 0;
  const hasRecall = recall.attemptCount > 0;
  if (!hasRecognition && !hasRecall) {
    return "no-evidence";
  }
  if (hasRecognition && !hasRecall) {
    return "recognition-only";
  }
  if (!hasRecognition && hasRecall) {
    return "recall-only";
  }

  const recognitionRank = outcomeRank(recognition.latestOutcome ?? "incorrect");
  const recallRank = outcomeRank(recall.latestOutcome ?? "incorrect");
  if (recognitionRank > recallRank) {
    return "recognition-ahead";
  }
  if (recallRank > recognitionRank) {
    return "recall-ahead";
  }
  if (recognitionRank === 2) {
    return "both-confirmed";
  }
  return "both-weak";
};

export const getConceptEvidenceProfile = (history: ConceptMasteryPoint[]): ConceptEvidenceProfile => {
  const recognition = emptySummary("recognition");
  const recall = emptySummary("recall");
  let latestRecognition: ConceptMasteryPoint | null = null;
  let latestRecall: ConceptMasteryPoint | null = null;

  for (const point of history) {
    const summary = point.evidenceKind === "recall" ? recall : recognition;
    summary.attemptCount += 1;
    if (point.observationOutcome === "correct") {
      summary.correctCount += 1;
    } else if (point.observationOutcome === "partial") {
      summary.partialCount += 1;
    } else {
      summary.incorrectCount += 1;
    }

    if (point.evidenceKind === "recall") {
      if (isLaterPoint(point, latestRecall)) {
        latestRecall = point;
      }
    } else if (isLaterPoint(point, latestRecognition)) {
      latestRecognition = point;
    }
  }

  if (latestRecognition) {
    recognition.latestOutcome = latestRecognition.observationOutcome;
    recognition.latestAnsweredAt = latestRecognition.answeredAt;
  }
  if (latestRecall) {
    recall.latestOutcome = latestRecall.observationOutcome;
    recall.latestAnsweredAt = latestRecall.answeredAt;
  }

  return {
    recognition,
    recall,
    state: resolveGapState(recognition, recall)
  };
};

export const EVIDENCE_KIND_LABELS: Record<MasteryEvidenceKind, string> = {
  recognition: "再認（四択）",
  recall: "再生（入力式）"
};

export const OBSERVATION_OUTCOME_LABELS: Record<MasteryObservationOutcome, string> = {
  correct: "正解",
  partial: "部分的に正解",
  incorrect: "誤答"
};

export const RECOGNITION_RECALL_GAP_STATE_LABELS: Record<RecognitionRecallGapState, string> = {
  "no-evidence": "再認・再生ともまだ確認されていません",
  "recognition-only": "再認は確認済み / 再生は未確認",
  "recall-only": "再生は確認済み / 再認は未確認",
  "both-confirmed": "直近では再認・再生とも確認できています",
  "recognition-ahead": "直近では「見れば分かる」傾向があります",
  "recall-ahead": "直近では再生の証拠が再認より強い状態です",
  "both-weak": "直近では再認・再生とも要確認です"
};

export const RECOGNITION_AHEAD_DETAIL =
  "四択では正解していますが、入力式では再生が十分に確認できていません。";
