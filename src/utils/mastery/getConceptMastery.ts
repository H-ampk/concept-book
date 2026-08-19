import type { QuizAttemptLog } from "../../types/quiz";
import { isUsableReactionTimeMs } from "../quizStats";
import { resolveConceptIdFromLog } from "../quiz/resolveConceptIdFromLog";
import { calculateBktMastery } from "./bkt";
import { DEFAULT_BKT_PARAMETERS, RECENT_RESULTS_LIMIT } from "./constants";
import type {
  BktParameters,
  ConceptMastery,
  MasteryConfidence,
  MasteryFreshness,
  MasteryState
} from "./types";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type GetConceptMasteryOptions = {
  now?: Date;
  parameters?: BktParameters;
};

const confidenceFromAttemptCount = (attemptCount: number): MasteryConfidence => {
  if (attemptCount <= 0) {
    return "none";
  }
  if (attemptCount <= 2) {
    return "low";
  }
  if (attemptCount <= 5) {
    return "medium";
  }
  return "high";
};

const freshnessFromLastAnsweredAt = (
  lastAnsweredAt: string | null,
  now: Date
): MasteryFreshness => {
  if (!lastAnsweredAt) {
    return "never";
  }
  const last = new Date(lastAnsweredAt);
  if (Number.isNaN(last.getTime())) {
    return "never";
  }
  const days = Math.floor((now.getTime() - last.getTime()) / MS_PER_DAY);
  if (days <= 7) {
    return "fresh";
  }
  if (days <= 30) {
    return "aging";
  }
  return "stale";
};

const stateFromMastery = (
  attemptCount: number,
  confidence: MasteryConfidence,
  masteryScore: number
): MasteryState => {
  if (attemptCount === 0) {
    return "unlearned";
  }
  if (confidence === "low") {
    return "insufficient-data";
  }
  if (masteryScore < 50) {
    return "learning";
  }
  if (masteryScore < 80) {
    return "developing";
  }
  return "mastered";
};

const emptyMastery = (
  conceptId: string,
  parameters: BktParameters,
  now: Date
): ConceptMastery => {
  const masteryProbability = calculateBktMastery([], parameters);
  return {
    conceptId,
    masteryProbability,
    masteryScore: Math.round(masteryProbability * 100),
    state: "unlearned",
    attemptCount: 0,
    correctCount: 0,
    incorrectCount: 0,
    accuracy: null,
    confidence: "none",
    lastAnsweredAt: null,
    freshness: freshnessFromLastAnsweredAt(null, now),
    recentResults: [],
    avgReactionTimeMs: null
  };
};

const buildMasteryFromLogs = (
  conceptId: string,
  conceptLogs: QuizAttemptLog[],
  options?: GetConceptMasteryOptions
): ConceptMastery => {
  const now = options?.now ?? new Date();
  const parameters = options?.parameters ?? DEFAULT_BKT_PARAMETERS;

  if (conceptLogs.length === 0) {
    return emptyMastery(conceptId, parameters, now);
  }

  const ordered = [...conceptLogs].sort((a, b) => a.answeredAt.localeCompare(b.answeredAt));
  const attemptCount = ordered.length;
  const correctCount = ordered.filter((log) => log.correct).length;
  const incorrectCount = attemptCount - correctCount;
  const lastAnsweredAt = ordered[ordered.length - 1].answeredAt;
  const masteryProbability = calculateBktMastery(ordered, parameters);
  const masteryScore = Math.round(masteryProbability * 100);
  const confidence = confidenceFromAttemptCount(attemptCount);
  const recentResults = ordered.slice(-RECENT_RESULTS_LIMIT).map((log) => log.correct);

  let timeSum = 0;
  let timeN = 0;
  for (const log of ordered) {
    if (isUsableReactionTimeMs(log.timeMs)) {
      timeSum += log.timeMs;
      timeN += 1;
    }
  }

  return {
    conceptId,
    masteryProbability,
    masteryScore,
    state: stateFromMastery(attemptCount, confidence, masteryScore),
    attemptCount,
    correctCount,
    incorrectCount,
    accuracy: attemptCount > 0 ? correctCount / attemptCount : null,
    confidence,
    lastAnsweredAt,
    freshness: freshnessFromLastAnsweredAt(lastAnsweredAt, now),
    recentResults,
    avgReactionTimeMs: timeN > 0 ? timeSum / timeN : null
  };
};

/** 指定 Concept の mastery を QuizAttemptLog から導出する。入力配列は破壊しない。 */
export const getConceptMastery = (
  logs: QuizAttemptLog[],
  conceptId: string,
  options?: GetConceptMasteryOptions
): ConceptMastery => {
  const conceptLogs = logs.filter((log) => resolveConceptIdFromLog(log) === conceptId);
  return buildMasteryFromLogs(conceptId, conceptLogs, options);
};

/** ログに現れる Concept ごとの mastery を一括生成する。 */
export const buildConceptMasteryMap = (
  logs: QuizAttemptLog[],
  options?: GetConceptMasteryOptions
): Map<string, ConceptMastery> => {
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

  const map = new Map<string, ConceptMastery>();
  for (const [conceptId, conceptLogs] of grouped) {
    map.set(conceptId, buildMasteryFromLogs(conceptId, conceptLogs, options));
  }
  return map;
};
