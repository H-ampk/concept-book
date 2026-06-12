import type { QuizAttemptLog } from "../../types/quiz";
import { formatConceptQuizStats } from "./formatConceptQuizStats";

export type ConceptQuizStats = {
  conceptId: string;
  totalAttempts: number;
  correctAttempts: number;
  wrongAttempts: number;
  accuracy: number | null;
  lastAnsweredAt: string | null;
};

/** ログが集計対象とする概念 ID（出題概念の questionConceptId を優先） */
export function resolveConceptIdFromLog(log: QuizAttemptLog): string | null {
  const questionConceptId = log.questionConceptId?.trim();
  if (questionConceptId) {
    return questionConceptId;
  }
  const conceptId = log.conceptId?.trim();
  if (conceptId) {
    return conceptId;
  }
  return null;
}

export function buildConceptQuizStatsMap(logs: QuizAttemptLog[]): Map<string, ConceptQuizStats> {
  const map = new Map<string, ConceptQuizStats>();

  for (const log of logs) {
    const conceptId = resolveConceptIdFromLog(log);
    if (!conceptId) {
      continue;
    }

    const current =
      map.get(conceptId) ??
      ({
        conceptId,
        totalAttempts: 0,
        correctAttempts: 0,
        wrongAttempts: 0,
        accuracy: null,
        lastAnsweredAt: null
      } satisfies ConceptQuizStats);

    current.totalAttempts += 1;
    if (log.correct) {
      current.correctAttempts += 1;
    } else {
      current.wrongAttempts += 1;
    }
    if (!current.lastAnsweredAt || log.answeredAt > current.lastAnsweredAt) {
      current.lastAnsweredAt = log.answeredAt;
    }

    map.set(conceptId, current);
  }

  for (const stats of map.values()) {
    stats.accuracy = Math.round((stats.correctAttempts / stats.totalAttempts) * 100);
  }

  return map;
}

export function logMatchesConcept(log: QuizAttemptLog, conceptId: string): boolean {
  return resolveConceptIdFromLog(log) === conceptId;
}

export function getConceptQuizStats(
  logs: QuizAttemptLog[],
  conceptId: string
): ConceptQuizStats {
  const conceptLogs = logs.filter((log) => logMatchesConcept(log, conceptId));
  const totalAttempts = conceptLogs.length;

  if (totalAttempts === 0) {
    return {
      conceptId,
      totalAttempts: 0,
      correctAttempts: 0,
      wrongAttempts: 0,
      accuracy: null,
      lastAnsweredAt: null
    };
  }

  const correctAttempts = conceptLogs.filter((log) => log.correct).length;
  const wrongAttempts = totalAttempts - correctAttempts;
  const accuracy = Math.round((correctAttempts / totalAttempts) * 100);
  const lastAnsweredAt = conceptLogs.reduce(
    (latest, log) => (log.answeredAt >= latest ? log.answeredAt : latest),
    conceptLogs[0].answeredAt
  );

  return {
    conceptId,
    totalAttempts,
    correctAttempts,
    wrongAttempts,
    accuracy,
    lastAnsweredAt
  };
}

/** 学習済み概念のみ表示文字列を返す（未学習概念は Map に含めない） */
export function buildConceptQuizStatsDisplayMap(logs: QuizAttemptLog[]): Map<string, string> {
  const statsMap = buildConceptQuizStatsMap(logs);
  const displayMap = new Map<string, string>();

  for (const [conceptId, stats] of statsMap) {
    displayMap.set(conceptId, formatConceptQuizStats(stats));
  }

  return displayMap;
}
