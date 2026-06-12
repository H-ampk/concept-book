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

/** ログが集計対象とする概念 ID（新フィールド優先、旧ログは questionConceptId） */
export function resolveConceptIdFromLog(log: QuizAttemptLog): string | null {
  const conceptId = log.conceptId?.trim();
  if (conceptId) {
    return conceptId;
  }
  const questionConceptId = log.questionConceptId?.trim();
  if (questionConceptId) {
    return questionConceptId;
  }
  return null;
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
  const grouped = new Map<string, QuizAttemptLog[]>();

  for (const log of logs) {
    const conceptId = resolveConceptIdFromLog(log);
    if (!conceptId) {
      continue;
    }
    const bucket = grouped.get(conceptId) ?? [];
    bucket.push(log);
    grouped.set(conceptId, bucket);
  }

  const displayMap = new Map<string, string>();
  for (const [conceptId, conceptLogs] of grouped) {
    displayMap.set(conceptId, formatConceptQuizStats(getConceptQuizStats(conceptLogs, conceptId)));
  }
  return displayMap;
}
