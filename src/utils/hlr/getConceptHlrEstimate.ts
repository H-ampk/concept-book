import type { QuizAttemptLog } from "../../types/quiz";
import {
  groupNormalizedEventsByConceptId,
  normalizeLearningModelEvents,
  type NormalizedLearningModelEvent
} from "../learningModel/normalizeQuizAttemptLogs";
import { DEFAULT_HLR_PARAMETERS, MIN_DISTINCT_STUDY_DAYS_FOR_ESTIMATE } from "./constants";
import { calculateHlrHalfLifeDays, calculateHlrRetentionProbability } from "./hlr";
import type { HlrHistorySummary, HlrParameters, MemoryRetentionEstimate } from "./types";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type GetConceptHlrEstimateOptions = {
  now?: Date;
  parameters?: HlrParameters;
};

/**
 * timeMs の UTC 暦日キー。
 * 同日判定は UTC date（YYYY-MM-DD）で行い、ローカルタイムゾーンには依存しない。
 */
const utcDateKeyFromTimeMs = (timeMs: number): string => new Date(timeMs).toISOString().slice(0, 10);

const utcCalendarDaysBetween = (earlierDateKey: string, laterDateKey: string): number => {
  const start = Date.parse(`${earlierDateKey}T00:00:00.000Z`);
  const end = Date.parse(`${laterDateKey}T00:00:00.000Z`);
  return (end - start) / MS_PER_DAY;
};

const elapsedDaysFromTimeMs = (lastTimeMs: number | null, now: Date): number | null => {
  if (lastTimeMs === null || Number.isNaN(now.getTime())) {
    return null;
  }
  return Math.max(0, (now.getTime() - lastTimeMs) / MS_PER_DAY);
};

/**
 * 共通 eligible events から HLR 用履歴を集計する。
 * success / failure / study day / lastAnsweredAt は同じ event set を使う。
 */
type HlrHistoryWithTime = HlrHistorySummary & { lastTimeMs: number | null };

const summarizeHlrHistory = (events: NormalizedLearningModelEvent[]): HlrHistoryWithTime => {
  let successCount = 0;
  let failureCount = 0;
  for (const event of events) {
    if (event.log.correct) {
      successCount += 1;
    } else {
      failureCount += 1;
    }
  }

  const distinctDays: string[] = [];
  let lastAnsweredAt: string | null = null;
  let lastTimeMs: number | null = null;

  for (const event of events) {
    lastAnsweredAt = event.log.answeredAt;
    lastTimeMs = event.timeMs;
    const key = utcDateKeyFromTimeMs(event.timeMs);
    if (distinctDays.length === 0 || distinctDays[distinctDays.length - 1] !== key) {
      distinctDays.push(key);
    }
  }

  let meanSpacingDays: number | null = null;
  if (distinctDays.length >= 2) {
    let spacingSum = 0;
    for (let i = 1; i < distinctDays.length; i += 1) {
      spacingSum += utcCalendarDaysBetween(distinctDays[i - 1], distinctDays[i]);
    }
    meanSpacingDays = spacingSum / (distinctDays.length - 1);
  }

  return {
    attemptCount: events.length,
    successCount,
    failureCount,
    distinctStudyDayCount: distinctDays.length,
    meanSpacingDays,
    lastAnsweredAt,
    lastTimeMs
  };
};

const buildEstimateFromEvents = (
  conceptId: string,
  events: NormalizedLearningModelEvent[],
  options?: GetConceptHlrEstimateOptions
): MemoryRetentionEstimate => {
  const now = options?.now ?? new Date();
  const parameters = options?.parameters ?? DEFAULT_HLR_PARAMETERS;
  const history = summarizeHlrHistory(events);
  const elapsedDays = elapsedDaysFromTimeMs(history.lastTimeMs, now);

  const base = {
    conceptId,
    attemptCount: history.attemptCount,
    successCount: history.successCount,
    failureCount: history.failureCount,
    distinctStudyDayCount: history.distinctStudyDayCount,
    meanSpacingDays: history.meanSpacingDays,
    lastAnsweredAt: history.lastAnsweredAt,
    elapsedDays
  };

  if (history.distinctStudyDayCount < MIN_DISTINCT_STUDY_DAYS_FOR_ESTIMATE) {
    return {
      ...base,
      status: "insufficient-data",
      halfLifeDays: null,
      retentionProbability: null
    };
  }

  const halfLifeDays = calculateHlrHalfLifeDays(history.successCount, history.failureCount, parameters);
  const retentionProbability =
    elapsedDays === null ? null : calculateHlrRetentionProbability(elapsedDays, halfLifeDays);

  return {
    ...base,
    status: "estimated",
    halfLifeDays,
    retentionProbability
  };
};

/**
 * 指定 Concept の記憶保持推定を QuizAttemptLog から導出する。
 * 共通 eligible events で帰属する。入力配列は破壊しない。
 * derived data であり IndexedDB には保存しない。
 */
export const getConceptHlrEstimate = (
  logs: QuizAttemptLog[],
  conceptId: string,
  options?: GetConceptHlrEstimateOptions
): MemoryRetentionEstimate => {
  const events = normalizeLearningModelEvents(logs).filter((event) => event.conceptId === conceptId);
  return buildEstimateFromEvents(conceptId, events, options);
};

/**
 * ログに現れる Concept ごとの記憶保持推定を一括生成する。
 * 存在しない Concept は生成しない。入力配列は破壊しない。
 */
export const buildConceptHlrEstimateMap = (
  logs: QuizAttemptLog[],
  options?: GetConceptHlrEstimateOptions
): Map<string, MemoryRetentionEstimate> => {
  const grouped = groupNormalizedEventsByConceptId(normalizeLearningModelEvents(logs));

  const map = new Map<string, MemoryRetentionEstimate>();
  for (const [conceptId, events] of grouped) {
    map.set(conceptId, buildEstimateFromEvents(conceptId, events, options));
  }
  return map;
};
