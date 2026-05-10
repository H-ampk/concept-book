import type { QuizAttemptLog } from "../types/quiz";

/**
 * 学習ログ・分析画面で表示する学習元ラベル。
 * deckTitleSnapshot を優先し、Deck 削除後も名前を残す。
 */
export const formatDeckSourceLabel = (log: QuizAttemptLog): string => {
  const t = log.deckTitleSnapshot?.trim();
  if (t) {
    return t;
  }
  if (log.deckId?.trim()) {
    return "クイズ集（タイトル未記録）";
  }
  return "自由学習";
};

/** 平均反応時間の母集団に含めるか（0 や非有限は除外） */
export const isUsableReactionTimeMs = (ms: number): boolean =>
  Number.isFinite(ms) && ms > 0;

/**
 * Concept 別バケット ID。
 * correctLinkedConceptId を優先し、なければ questionConceptId。どちらも無ければ null（未分類）。
 */
export const conceptBucketIdForLog = (log: QuizAttemptLog): string | null =>
  log.correctLinkedConceptId ?? log.questionConceptId ?? null;

export type OverallSummary = {
  totalAttempts: number;
  correctCount: number;
  incorrectCount: number;
  /** 0〜1。ログが無い場合は 0 */
  accuracy: number;
  /** 有効な timeMs が1件も無いとき null */
  avgReactionTimeMs: number | null;
  lastAnsweredAt: string | null;
};

export type QuestionStat = {
  questionId: string;
  promptSnapshot: string;
  attemptCount: number;
  correctCount: number;
  accuracy: number;
  avgReactionTimeMs: number | null;
  lastAnsweredAt: string;
};

export type ConceptStat = {
  bucketId: string | null;
  attemptCount: number;
  correctCount: number;
  accuracy: number;
  avgReactionTimeMs: number | null;
};

export type ConfusionPairStat = {
  selectedConceptId: string | null;
  correctConceptId: string | null;
  count: number;
};

/** 自由学習ログの集計バケットキー（deckId なし） */
export const QUIZ_DECK_BUCKET_FREE = "__free__";

export type DeckLearningStat = {
  /** `deckId` または `QUIZ_DECK_BUCKET_FREE` */
  bucketKey: string;
  /** 表示名（同一 deckId 内は最終回答に近いログのスナップショットを優先） */
  displayName: string;
  answerCount: number;
  correctCount: number;
  /** 0〜1 */
  accuracy: number;
  /** timeMs が使えないログは母集団から除外したときの平均。無ければ null */
  averageTimeMs: number | null;
  lastAnsweredAt: string;
};

const deckBucketKeyForLog = (log: QuizAttemptLog): string => {
  const id = log.deckId?.trim();
  return id ? id : QUIZ_DECK_BUCKET_FREE;
};

/**
 * Deck 別・自由学習別に回答を集計する。
 * - deckId があるログは deckId 単位でまとめる。同一 deckId でもログごとに snapshot が違う場合は、answeredAt が最も新しいログを表示名の代表とする。
 * - deckId がないログは自由学習（`QUIZ_DECK_BUCKET_FREE`）にまとめる。
 */
export const computeDeckStats = (logs: QuizAttemptLog[]): DeckLearningStat[] => {
  type Agg = {
    answerCount: number;
    correctCount: number;
    timeSum: number;
    timeN: number;
    lastAnsweredAt: string;
    /** 表示名用: answeredAt が最新のログ（deckTitleSnapshot を拾う） */
    latestLog: QuizAttemptLog | null;
  };

  const map = new Map<string, Agg>();

  for (const log of logs) {
    const key = deckBucketKeyForLog(log);
    let g = map.get(key);
    if (!g) {
      g = {
        answerCount: 0,
        correctCount: 0,
        timeSum: 0,
        timeN: 0,
        lastAnsweredAt: log.answeredAt,
        latestLog: log
      };
      map.set(key, g);
    }
    g.answerCount += 1;
    if (log.correct) {
      g.correctCount += 1;
    }
    if (isUsableReactionTimeMs(log.timeMs)) {
      g.timeSum += log.timeMs;
      g.timeN += 1;
    }
    if (log.answeredAt >= g.lastAnsweredAt) {
      g.lastAnsweredAt = log.answeredAt;
    }
    if (!g.latestLog || log.answeredAt >= g.latestLog.answeredAt) {
      g.latestLog = log;
    }
  }

  const rows: DeckLearningStat[] = [...map.entries()].map(([bucketKey, g]) => {
    const displayName =
      bucketKey === QUIZ_DECK_BUCKET_FREE
        ? "自由学習"
        : g.latestLog
          ? formatDeckSourceLabel(g.latestLog)
          : "クイズ集（タイトル未記録）";

    const answerCount = g.answerCount;
    return {
      bucketKey,
      displayName,
      answerCount,
      correctCount: g.correctCount,
      accuracy: answerCount > 0 ? g.correctCount / answerCount : 0,
      averageTimeMs: g.timeN > 0 ? g.timeSum / g.timeN : null,
      lastAnsweredAt: g.lastAnsweredAt
    };
  });

  rows.sort((a, b) => {
    if (b.answerCount !== a.answerCount) {
      return b.answerCount - a.answerCount;
    }
    if (a.accuracy !== b.accuracy) {
      return a.accuracy - b.accuracy;
    }
    return b.lastAnsweredAt.localeCompare(a.lastAnsweredAt);
  });

  return rows;
};

const maxIso = (a: string, b: string): string => (a >= b ? a : b);

export const computeOverallSummary = (logs: QuizAttemptLog[]): OverallSummary => {
  const n = logs.length;
  if (n === 0) {
    return {
      totalAttempts: 0,
      correctCount: 0,
      incorrectCount: 0,
      accuracy: 0,
      avgReactionTimeMs: null,
      lastAnsweredAt: null
    };
  }
  let correctCount = 0;
  let timeSum = 0;
  let timeN = 0;
  let lastAt: string | null = null;

  for (const log of logs) {
    if (log.correct) {
      correctCount += 1;
    }
    if (isUsableReactionTimeMs(log.timeMs)) {
      timeSum += log.timeMs;
      timeN += 1;
    }
    lastAt = lastAt == null ? log.answeredAt : maxIso(lastAt, log.answeredAt);
  }

  return {
    totalAttempts: n,
    correctCount,
    incorrectCount: n - correctCount,
    accuracy: correctCount / n,
    avgReactionTimeMs: timeN > 0 ? timeSum / timeN : null,
    lastAnsweredAt: lastAt
  };
};

/** 同一 questionId について、最新の answeredAt のスナップショットを採用 */
export const computeQuestionStats = (logs: QuizAttemptLog[]): QuestionStat[] => {
  const byQ = new Map<
    string,
    {
      attemptCount: number;
      correctCount: number;
      timeSum: number;
      timeN: number;
      lastAnsweredAt: string;
      latestPrompt: { at: string; text: string };
    }
  >();

  for (const log of logs) {
    let g = byQ.get(log.questionId);
    if (!g) {
      g = {
        attemptCount: 0,
        correctCount: 0,
        timeSum: 0,
        timeN: 0,
        lastAnsweredAt: log.answeredAt,
        latestPrompt: { at: log.answeredAt, text: log.questionPromptSnapshot }
      };
      byQ.set(log.questionId, g);
    }
    g.attemptCount += 1;
    if (log.correct) {
      g.correctCount += 1;
    }
    if (isUsableReactionTimeMs(log.timeMs)) {
      g.timeSum += log.timeMs;
      g.timeN += 1;
    }
    if (log.answeredAt >= g.lastAnsweredAt) {
      g.lastAnsweredAt = log.answeredAt;
    }
    if (log.answeredAt >= g.latestPrompt.at) {
      g.latestPrompt = { at: log.answeredAt, text: log.questionPromptSnapshot };
    }
  }

  const rows: QuestionStat[] = [...byQ.entries()].map(([questionId, g]) => ({
    questionId,
    promptSnapshot: g.latestPrompt.text,
    attemptCount: g.attemptCount,
    correctCount: g.correctCount,
    accuracy: g.attemptCount > 0 ? g.correctCount / g.attemptCount : 0,
    avgReactionTimeMs: g.timeN > 0 ? g.timeSum / g.timeN : null,
    lastAnsweredAt: g.lastAnsweredAt
  }));

  rows.sort((a, b) => {
    if (b.attemptCount !== a.attemptCount) {
      return b.attemptCount - a.attemptCount;
    }
    return a.accuracy - b.accuracy;
  });

  return rows;
};

export const computeConceptStats = (logs: QuizAttemptLog[]): ConceptStat[] => {
  const byC = new Map<
    string | null,
    { attemptCount: number; correctCount: number; timeSum: number; timeN: number }
  >();

  for (const log of logs) {
    const bid = conceptBucketIdForLog(log);
    let g = byC.get(bid);
    if (!g) {
      g = { attemptCount: 0, correctCount: 0, timeSum: 0, timeN: 0 };
      byC.set(bid, g);
    }
    g.attemptCount += 1;
    if (log.correct) {
      g.correctCount += 1;
    }
    if (isUsableReactionTimeMs(log.timeMs)) {
      g.timeSum += log.timeMs;
      g.timeN += 1;
    }
  }

  const rows: ConceptStat[] = [...byC.entries()].map(([bucketId, g]) => ({
    bucketId,
    attemptCount: g.attemptCount,
    correctCount: g.correctCount,
    accuracy: g.attemptCount > 0 ? g.correctCount / g.attemptCount : 0,
    avgReactionTimeMs: g.timeN > 0 ? g.timeSum / g.timeN : null
  }));

  rows.sort((a, b) => {
    if (b.attemptCount !== a.attemptCount) {
      return b.attemptCount - a.attemptCount;
    }
    return a.accuracy - b.accuracy;
  });

  return rows;
};

const pairKey = (a: string | null, b: string | null): string =>
  `${a ?? ""}\u0000${b ?? ""}`;

export const computeConfusionPairs = (logs: QuizAttemptLog[]): ConfusionPairStat[] => {
  const map = new Map<string, ConfusionPairStat>();

  for (const log of logs) {
    if (log.correct) {
      continue;
    }
    const selected = log.selectedLinkedConceptId ?? null;
    const correct = log.correctLinkedConceptId ?? null;
    const k = pairKey(selected, correct);
    const cur = map.get(k);
    if (cur) {
      cur.count += 1;
    } else {
      map.set(k, { selectedConceptId: selected, correctConceptId: correct, count: 1 });
    }
  }

  return [...map.values()].sort((a, b) => b.count - a.count);
};

export const recentLogsSorted = (logs: QuizAttemptLog[], limit: number): QuizAttemptLog[] =>
  [...logs].sort((a, b) => b.answeredAt.localeCompare(a.answeredAt)).slice(0, limit);

export const formatSecondsFromMs = (ms: number): string =>
  `${(ms / 1000).toFixed(2)}秒`;

/** Concept ID を UI 表示用ラベルに（未分類・削除済みを含む） */
export const formatConceptRef = (
  conceptId: string | null,
  titleById: Map<string, string>
): string => {
  if (conceptId == null || conceptId === "") {
    return "未分類";
  }
  if (!titleById.has(conceptId)) {
    return "削除済みConcept";
  }
  return titleById.get(conceptId) ?? "削除済みConcept";
};

/** 履歴テーブル用: 主にバケット概念＋誤答時は選択/正解のリンク概念を簡潔に */
export const formatRelatedConceptSummary = (
  log: QuizAttemptLog,
  titleById: Map<string, string>
): string => {
  const primary = formatConceptRef(conceptBucketIdForLog(log), titleById);
  if (log.correct) {
    return primary;
  }
  const sel = formatConceptRef(log.selectedLinkedConceptId ?? null, titleById);
  const cor = formatConceptRef(log.correctLinkedConceptId ?? null, titleById);
  if (sel === cor && sel === primary) {
    return primary;
  }
  return `${primary}（誤答: ${sel} → ${cor}）`;
};
