import { shortDateTime } from "../date";
import { formatSecondsFromMs, isUsableReactionTimeMs } from "../quizStats";
import type { ConceptMasteryPoint } from "./types";

export type ConceptMasteryHistoryChartPoint = {
  attemptIndex: number;
  xLabel: string;
  answeredAt: string;
  masteryScore: number;
  previousMasteryScore: number;
  masteryDelta: number;
  correct: boolean;
  resultShape: "circle" | "cross";
  resultLabel: "正解" | "誤答";
  quizAttemptLogId: string;
  questionId: string;
  questionPromptSnapshot: string;
  timeMs: number;
  sessionId?: string;
};

export type ConceptMasteryHistoryTooltipView = {
  attemptLabel: string;
  answeredAtText: string;
  resultLabel: "正解" | "誤答";
  previousMasteryScore: number;
  masteryScore: number;
  masteryDeltaText: string;
  timeText: string | null;
  questionPrompt: string | null;
};

export type ConceptMasteryHistorySummaryView = {
  attemptCountText: string;
  latestMasteryText: string | null;
};

export const formatConceptMasteryAttemptLabel = (attemptIndex: number): string => `${attemptIndex}回目`;

export const formatConceptMasteryDelta = (delta: number): string =>
  delta > 0 ? `+${delta}` : String(delta);

export const getConceptMasteryHistoryXTickInterval = (pointCount: number): number => {
  if (pointCount <= 8) {
    return 0;
  }
  return Math.max(0, Math.ceil(pointCount / 8) - 1);
};

export const toConceptMasteryHistoryChartPoints = (
  history: ConceptMasteryPoint[]
): ConceptMasteryHistoryChartPoint[] =>
  history.map((point) => ({
    attemptIndex: point.attemptIndex,
    xLabel: formatConceptMasteryAttemptLabel(point.attemptIndex),
    answeredAt: point.answeredAt,
    masteryScore: point.masteryScore,
    previousMasteryScore: point.previousMasteryScore,
    masteryDelta: point.masteryDelta,
    correct: point.correct,
    resultShape: point.correct ? "circle" : "cross",
    resultLabel: point.correct ? "正解" : "誤答",
    quizAttemptLogId: point.quizAttemptLogId,
    questionId: point.questionId,
    questionPromptSnapshot: point.questionPromptSnapshot,
    timeMs: point.timeMs,
    sessionId: point.sessionId
  }));

export const toConceptMasteryHistoryTooltipView = (
  point: Pick<
    ConceptMasteryHistoryChartPoint,
    | "attemptIndex"
    | "answeredAt"
    | "resultLabel"
    | "previousMasteryScore"
    | "masteryScore"
    | "masteryDelta"
    | "timeMs"
    | "questionPromptSnapshot"
  >
): ConceptMasteryHistoryTooltipView => {
  const prompt = point.questionPromptSnapshot.trim();
  return {
    attemptLabel: formatConceptMasteryAttemptLabel(point.attemptIndex),
    answeredAtText: shortDateTime(point.answeredAt),
    resultLabel: point.resultLabel,
    previousMasteryScore: point.previousMasteryScore,
    masteryScore: point.masteryScore,
    masteryDeltaText: formatConceptMasteryDelta(point.masteryDelta),
    timeText: isUsableReactionTimeMs(point.timeMs) ? formatSecondsFromMs(point.timeMs) : null,
    questionPrompt: prompt === "" ? null : prompt
  };
};

export const toConceptMasteryHistorySummaryView = (
  history: ConceptMasteryPoint[]
): ConceptMasteryHistorySummaryView => {
  const last = history.length > 0 ? history[history.length - 1] : undefined;
  return {
    attemptCountText: `全${history.length}回答`,
    latestMasteryText: last ? `最新理解度${last.masteryScore}` : null
  };
};
