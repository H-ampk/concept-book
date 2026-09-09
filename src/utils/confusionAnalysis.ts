import type { QuizAttemptLog } from "../types/quiz";

/**
 * 対象となる正解 Concept の直近何回答を recent window とするか。
 * 日数ベースにすると学習頻度で意味が変わるため、回答件数で固定する。
 */
export const RECENT_CONFUSION_ATTEMPT_LIMIT = 10;

/**
 * 対象 Concept の回答数がこの値未満のとき、UI は混同率を強く評価せず「データ少」と表示する。
 * 集計からは 1 回の誤答も除外しない。1/1=100% を 12/20=60% より無条件に強く見せないための表示用閾値。
 */
export const CONFUSION_SPARSE_OPPORTUNITY_THRESHOLD = 5;

export type DirectedConfusionStat = {
  correctConceptId: string;
  selectedConceptId: string;
  confusionCount: number;
  /** correctConceptId が正解だった全回答数 */
  opportunityCount: number;
  /** confusionCount / opportunityCount */
  confusionRate: number;
  lastConfusedAt: string | null;
  recentConfusionCount: number;
  recentOpportunityCount: number;
  recentConfusionRate: number | null;
};

export type ConceptConfusionSummary = {
  conceptId: string;
  opportunityCount: number;
  totalConfusionCount: number;
  /** 正解 Concept の回答のうち、別 linked Concept を誤選択した割合 */
  confusionRate: number;
  targets: DirectedConfusionStat[];
};

export type ConfusionAnalysis = {
  directedStats: DirectedConfusionStat[];
  conceptSummaries: ConceptConfusionSummary[];
};

const usableConceptId = (id: string | undefined | null): string | null => {
  if (typeof id !== "string") {
    return null;
  }
  const trimmed = id.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const answeredAtTime = (iso: string): number => {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : Number.NEGATIVE_INFINITY;
};

const compareAnsweredAtDesc = (a: QuizAttemptLog, b: QuizAttemptLog): number =>
  answeredAtTime(b.answeredAt) - answeredAtTime(a.answeredAt);

/** 配列順ではなく日時を比較して、candidate の方が新しいとき true */
const isLaterAnsweredAt = (candidate: string, current: string | null): boolean => {
  if (current == null) {
    return true;
  }
  const candidateTime = Date.parse(candidate);
  const currentTime = Date.parse(current);
  if (Number.isFinite(candidateTime) && Number.isFinite(currentTime)) {
    return candidateTime > currentTime;
  }
  return candidate > current;
};

const isDirectedConfusion = (log: QuizAttemptLog, correctConceptId: string): boolean => {
  if (log.correct) {
    return false;
  }
  const selectedId = usableConceptId(log.selectedLinkedConceptId);
  if (!selectedId) {
    return false;
  }
  return selectedId !== correctConceptId;
};

/**
 * ランキングは混同回数を主軸にする。
 * 率だけの降順にすると、回答 1 回・混同 1 回の 100% が最上位を占有しやすい。
 */
export const compareDirectedConfusionRank = (
  a: DirectedConfusionStat,
  b: DirectedConfusionStat
): number => {
  if (b.confusionCount !== a.confusionCount) {
    return b.confusionCount - a.confusionCount;
  }
  if (b.confusionRate !== a.confusionRate) {
    return b.confusionRate - a.confusionRate;
  }
  if (b.opportunityCount !== a.opportunityCount) {
    return b.opportunityCount - a.opportunityCount;
  }
  const aLast = a.lastConfusedAt ?? "";
  const bLast = b.lastConfusedAt ?? "";
  if (aLast !== bLast) {
    return bLast.localeCompare(aLast);
  }
  const correctCmp = a.correctConceptId.localeCompare(b.correctConceptId);
  if (correctCmp !== 0) {
    return correctCmp;
  }
  return a.selectedConceptId.localeCompare(b.selectedConceptId);
};

export const isSparseConfusionSample = (opportunityCount: number): boolean =>
  opportunityCount < CONFUSION_SPARSE_OPPORTUNITY_THRESHOLD;

/**
 * QuizAttemptLog から方向付き混同を derived 算出する。
 * A → B は「正解 Concept は A だったが、ユーザーが B を選択した」。
 */
export const computeConfusionAnalysis = (logs: QuizAttemptLog[]): ConfusionAnalysis => {
  const byCorrect = new Map<string, QuizAttemptLog[]>();

  for (const log of logs) {
    const correctId = usableConceptId(log.correctLinkedConceptId);
    if (!correctId) {
      continue;
    }
    const group = byCorrect.get(correctId);
    if (group) {
      group.push(log);
    } else {
      byCorrect.set(correctId, [log]);
    }
  }

  const directedStats: DirectedConfusionStat[] = [];
  const conceptSummaries: ConceptConfusionSummary[] = [];

  for (const [correctConceptId, groupLogs] of byCorrect) {
    const opportunityCount = groupLogs.length;
    const recentLogs = [...groupLogs]
      .sort(compareAnsweredAtDesc)
      .slice(0, RECENT_CONFUSION_ATTEMPT_LIMIT);
    const recentOpportunityCount = recentLogs.length;

    type PairAgg = {
      confusionCount: number;
      lastConfusedAt: string | null;
      recentConfusionCount: number;
    };
    const pairs = new Map<string, PairAgg>();
    let totalConfusionCount = 0;

    for (const log of groupLogs) {
      if (!isDirectedConfusion(log, correctConceptId)) {
        continue;
      }
      const selectedId = usableConceptId(log.selectedLinkedConceptId);
      if (!selectedId) {
        continue;
      }
      totalConfusionCount += 1;
      let agg = pairs.get(selectedId);
      if (!agg) {
        agg = { confusionCount: 0, lastConfusedAt: null, recentConfusionCount: 0 };
        pairs.set(selectedId, agg);
      }
      agg.confusionCount += 1;
      if (isLaterAnsweredAt(log.answeredAt, agg.lastConfusedAt)) {
        agg.lastConfusedAt = log.answeredAt;
      }
    }

    for (const log of recentLogs) {
      if (!isDirectedConfusion(log, correctConceptId)) {
        continue;
      }
      const selectedId = usableConceptId(log.selectedLinkedConceptId);
      if (!selectedId) {
        continue;
      }
      const agg = pairs.get(selectedId);
      if (agg) {
        agg.recentConfusionCount += 1;
      }
    }

    const targets: DirectedConfusionStat[] = [...pairs.entries()].map(([selectedConceptId, agg]) => {
      const confusionRate = opportunityCount > 0 ? agg.confusionCount / opportunityCount : 0;
      const recentConfusionRate =
        recentOpportunityCount > 0 ? agg.recentConfusionCount / recentOpportunityCount : null;
      return {
        correctConceptId,
        selectedConceptId,
        confusionCount: agg.confusionCount,
        opportunityCount,
        confusionRate,
        lastConfusedAt: agg.lastConfusedAt,
        recentConfusionCount: agg.recentConfusionCount,
        recentOpportunityCount,
        recentConfusionRate
      };
    });

    targets.sort(compareDirectedConfusionRank);
    directedStats.push(...targets);

    conceptSummaries.push({
      conceptId: correctConceptId,
      opportunityCount,
      totalConfusionCount,
      confusionRate: opportunityCount > 0 ? totalConfusionCount / opportunityCount : 0,
      targets
    });
  }

  directedStats.sort(compareDirectedConfusionRank);
  conceptSummaries.sort((a, b) => {
    if (b.totalConfusionCount !== a.totalConfusionCount) {
      return b.totalConfusionCount - a.totalConfusionCount;
    }
    if (b.confusionRate !== a.confusionRate) {
      return b.confusionRate - a.confusionRate;
    }
    if (b.opportunityCount !== a.opportunityCount) {
      return b.opportunityCount - a.opportunityCount;
    }
    return a.conceptId.localeCompare(b.conceptId);
  });

  return { directedStats, conceptSummaries };
};

export const computeDirectedConfusionStats = (logs: QuizAttemptLog[]): DirectedConfusionStat[] =>
  computeConfusionAnalysis(logs).directedStats;

export const computeConceptConfusionSummaries = (logs: QuizAttemptLog[]): ConceptConfusionSummary[] =>
  computeConfusionAnalysis(logs).conceptSummaries;

/** Concept Graph など、count だけが必要な互換層向け */
export const toConfusionPairCounts = (
  stats: readonly DirectedConfusionStat[]
): Array<{ selectedConceptId: string; correctConceptId: string; count: number }> =>
  stats.map((stat) => ({
    selectedConceptId: stat.selectedConceptId,
    correctConceptId: stat.correctConceptId,
    count: stat.confusionCount
  }));
