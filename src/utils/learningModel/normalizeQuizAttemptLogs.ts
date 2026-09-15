import type { QuizAttemptLog } from "../../types/quiz";
import { resolveConceptIdFromLog } from "../quiz/resolveConceptIdFromLog";

export type TimeNormalizedQuizAttemptLog = {
  log: QuizAttemptLog;
  timeMs: number;
};

export type NormalizedLearningModelEvent = {
  log: QuizAttemptLog;
  conceptId: string;
  timeMs: number;
};

/**
 * answeredAt を実時刻ミリ秒へ変換する。
 * finite な timestamp として解釈できない値は null（learning-model input 対象外）。
 */
export const parseAnsweredAtMs = (answeredAt: string): number | null => {
  const timeMs = new Date(answeredAt).getTime();
  if (!Number.isFinite(timeMs)) {
    return null;
  }
  return timeMs;
};

export const compareTimeNormalizedQuizAttemptLogs = (
  a: TimeNormalizedQuizAttemptLog,
  b: TimeNormalizedQuizAttemptLog
): number => {
  if (a.timeMs !== b.timeMs) {
    return a.timeMs - b.timeMs;
  }
  return a.log.id.localeCompare(b.log.id);
};

/**
 * timestamp のみを正規化する。Concept は解決しない。
 * Invalid Date を除外し、timeMs ASC → log.id ASC で並べる。
 * 入力配列・元 log object は破壊しない。元配列順は tie-break に使わない。
 */
export const normalizeQuizAttemptLogSequence = (
  logs: readonly QuizAttemptLog[]
): TimeNormalizedQuizAttemptLog[] => {
  const normalized: TimeNormalizedQuizAttemptLog[] = [];
  for (const log of logs) {
    const timeMs = parseAnsweredAtMs(log.answeredAt);
    if (timeMs === null) {
      continue;
    }
    normalized.push({ log, timeMs });
  }
  normalized.sort(compareTimeNormalizedQuizAttemptLogs);
  return normalized;
};

/**
 * Concept 単位の学習モデル向け event。
 * timestamp 正規化に加え、resolveConceptIdFromLog() できないログを除外する。
 */
export const normalizeLearningModelEvents = (
  logs: readonly QuizAttemptLog[]
): NormalizedLearningModelEvent[] => {
  const events: NormalizedLearningModelEvent[] = [];
  for (const item of normalizeQuizAttemptLogSequence(logs)) {
    const conceptId = resolveConceptIdFromLog(item.log);
    if (!conceptId) {
      continue;
    }
    events.push({ log: item.log, conceptId, timeMs: item.timeMs });
  }
  return events;
};

export const logsFromNormalizedSequence = (
  items: readonly TimeNormalizedQuizAttemptLog[]
): QuizAttemptLog[] => items.map((item) => item.log);

export const groupNormalizedEventsByConceptId = (
  events: readonly NormalizedLearningModelEvent[]
): Map<string, NormalizedLearningModelEvent[]> => {
  const grouped = new Map<string, NormalizedLearningModelEvent[]>();
  for (const event of events) {
    const bucket = grouped.get(event.conceptId);
    if (bucket) {
      bucket.push(event);
    } else {
      grouped.set(event.conceptId, [event]);
    }
  }
  return grouped;
};

/**
 * 同一 timeMs の event を同時刻 group にする。
 * 入力は timeMs → id 順であること。
 */
export const groupNormalizedEventsByTimeMs = <T extends { timeMs: number }>(
  events: readonly T[]
): T[][] => {
  const groups: T[][] = [];
  for (const item of events) {
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup[0].timeMs === item.timeMs) {
      lastGroup.push(item);
    } else {
      groups.push([item]);
    }
  }
  return groups;
};
