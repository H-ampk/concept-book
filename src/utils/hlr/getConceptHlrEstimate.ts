import type { QuizAttemptLog } from "../../types/quiz";
import { resolveConceptIdFromLog } from "../quiz/resolveConceptIdFromLog";
import { DEFAULT_HLR_PARAMETERS, MIN_DISTINCT_STUDY_DAYS_FOR_ESTIMATE } from "./constants";
import { calculateHlrHalfLifeDays, calculateHlrRetentionProbability } from "./hlr";
import type { HlrHistorySummary, HlrParameters, MemoryRetentionEstimate } from "./types";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type GetConceptHlrEstimateOptions = {
  now?: Date;
  parameters?: HlrParameters;
};

/**
 * answeredAt（ISO timestamp）の UTC 暦日キー。
 * 同日判定は UTC date（YYYY-MM-DD）で行い、ローカルタイムゾーンには依存しない。
 */
const utcDateKey = (iso: string): string | null => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString().slice(0, 10);
};

const utcCalendarDaysBetween = (earlierDateKey: string, laterDateKey: string): number => {
  const start = Date.parse(`${earlierDateKey}T00:00:00.000Z`);
  const end = Date.parse(`${laterDateKey}T00:00:00.000Z`);
  return (end - start) / MS_PER_DAY;
};

const elapsedDaysFrom = (lastAnsweredAt: string | null, now: Date): number | null => {
  if (!lastAnsweredAt) {
    return null;
  }
  const last = new Date(lastAnsweredAt);
  if (Number.isNaN(last.getTime()) || Number.isNaN(now.getTime())) {
    return null;
  }
  return Math.max(0, (now.getTime() - last.getTime()) / MS_PER_DAY);
};

/**
 * Concept に帰属するログから HLR 用履歴を集計する。
 * 入力配列は破壊しない。回答日時順が必要な処理ではコピーを sort する。
 */
const summarizeHlrHistory = (conceptLogs: QuizAttemptLog[]): HlrHistorySummary => {
  let successCount = 0;
  let failureCount = 0;
  for (const log of conceptLogs) {
    if (log.correct) {
      successCount += 1;
    } else {
      failureCount += 1;
    }
  }

  const ordered = [...conceptLogs].sort((a, b) => a.answeredAt.localeCompare(b.answeredAt));
  const distinctDays: string[] = [];
  let lastAnsweredAt: string | null = null;

  for (const log of ordered) {
    const date = new Date(log.answeredAt);
    if (Number.isNaN(date.getTime())) {
      continue;
    }
    lastAnsweredAt = log.answeredAt;
    const key = utcDateKey(log.answeredAt);
    if (key && (distinctDays.length === 0 || distinctDays[distinctDays.length - 1] !== key)) {
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
    attemptCount: conceptLogs.length,
    successCount,
    failureCount,
    distinctStudyDayCount: distinctDays.length,
    meanSpacingDays,
    lastAnsweredAt
  };
};

const buildEstimateFromLogs = (
  conceptId: string,
  conceptLogs: QuizAttemptLog[],
  options?: GetConceptHlrEstimateOptions
): MemoryRetentionEstimate => {
  const now = options?.now ?? new Date();
  const parameters = options?.parameters ?? DEFAULT_HLR_PARAMETERS;
  const history = summarizeHlrHistory(conceptLogs);
  const elapsedDays = elapsedDaysFrom(history.lastAnsweredAt, now);

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
 * resolveConceptIdFromLog() で帰属する。入力配列は破壊しない。
 * derived data であり IndexedDB には保存しない。
 */
export const getConceptHlrEstimate = (
  logs: QuizAttemptLog[],
  conceptId: string,
  options?: GetConceptHlrEstimateOptions
): MemoryRetentionEstimate => {
  const conceptLogs = logs.filter((log) => resolveConceptIdFromLog(log) === conceptId);
  return buildEstimateFromLogs(conceptId, conceptLogs, options);
};

/**
 * ログに現れる Concept ごとの記憶保持推定を一括生成する。
 * 存在しない Concept は生成しない。入力配列は破壊しない。
 */
export const buildConceptHlrEstimateMap = (
  logs: QuizAttemptLog[],
  options?: GetConceptHlrEstimateOptions
): Map<string, MemoryRetentionEstimate> => {
  const grouped = new Map<string, QuizAttemptLog[]>();
  for (const log of logs) {
    const conceptId = resolveConceptIdFromLog(log);
    if (!conceptId) {
      continue;
    }
    const bucket = grouped.get(conceptId);
    if (bucket) {
      bucket.push(log);
    } else {
      grouped.set(conceptId, [log]);
    }
  }

  const map = new Map<string, MemoryRetentionEstimate>();
  for (const [conceptId, conceptLogs] of grouped) {
    map.set(conceptId, buildEstimateFromLogs(conceptId, conceptLogs, options));
  }
  return map;
};
