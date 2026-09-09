import type { Concept } from "../../types/concept";
import type { QuizAttemptLog, QuizDeck } from "../../types/quiz";
import { isUsableReactionTimeMs, QUIZ_DECK_BUCKET_FREE } from "../quizStats";
import { isoWeekKeyAndRange, lastLocalDayOfMonth, localYm, localYmd } from "./dataLabTimePeriod";
import { getDataLabLogConceptId } from "./filterDataLabLogs";

export type DataLabGroupBy = "concept" | "domain" | "deck" | "day" | "week" | "month";

/** Concept ID が解決できないログの安定キー */
export const DATA_LAB_CONCEPT_NONE_KEY = "__data-lab-concept-none__";

/**
 * 分野なしバケットの安定キー。
 * 分野タグがない Concept に加え、削除済み・解決不能で domainTags を復元できないログもここに計上する
 *（「分野不明」は使わず「分野なし」に統一する）。
 */
export const DATA_LAB_DOMAIN_NONE_KEY = "__data-lab-domain-none__";

export type DataLabAggregateRow = {
  groupBy: DataLabGroupBy;
  key: string;
  label: string;
  attemptCount: number;
  correctCount: number;
  incorrectCount: number;
  accuracy: number | null;
  /** Concept 集計のみ。全学習履歴の現在理解度（0〜1）。欠損は null（0 ではない）。 */
  masteryProbability: number | null;
  averageResponseTimeMs: number | null;
  firstAttemptAt: string | null;
  lastAttemptAt: string | null;
  conceptId?: string | null;
  domainTag?: string | null;
  deckId?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
};

type BucketAcc = {
  attemptCount: number;
  correctCount: number;
  timeSum: number;
  timeN: number;
  firstAttemptAt: string | null;
  lastAttemptAt: string | null;
  firstMs: number | null;
  lastMs: number | null;
  conceptId?: string | null;
  domainTag?: string | null;
  deckId?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  label: string;
};

const parseAnsweredAt = (value: string): Date | null => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
};

const emptyBucket = (label: string, extra: Partial<BucketAcc> = {}): BucketAcc => ({
  attemptCount: 0,
  correctCount: 0,
  timeSum: 0,
  timeN: 0,
  firstAttemptAt: null,
  lastAttemptAt: null,
  firstMs: null,
  lastMs: null,
  label,
  ...extra
});

const addLogToBucket = (bucket: BucketAcc, log: QuizAttemptLog, answeredAt: Date | null): void => {
  bucket.attemptCount += 1;
  if (log.correct === true) {
    bucket.correctCount += 1;
  }
  if (isUsableReactionTimeMs(log.timeMs)) {
    bucket.timeSum += log.timeMs;
    bucket.timeN += 1;
  }
  if (!answeredAt) {
    return;
  }
  const ms = answeredAt.getTime();
  if (bucket.firstMs == null || ms < bucket.firstMs) {
    bucket.firstMs = ms;
    bucket.firstAttemptAt = log.answeredAt;
  }
  if (bucket.lastMs == null || ms > bucket.lastMs) {
    bucket.lastMs = ms;
    bucket.lastAttemptAt = log.answeredAt;
  }
};

const toRow = (groupBy: DataLabGroupBy, key: string, bucket: BucketAcc): DataLabAggregateRow => {
  const attemptCount = bucket.attemptCount;
  const correctCount = bucket.correctCount;
  return {
    groupBy,
    key,
    label: bucket.label,
    attemptCount,
    correctCount,
    incorrectCount: attemptCount - correctCount,
    accuracy: attemptCount > 0 ? correctCount / attemptCount : null,
    masteryProbability: null,
    averageResponseTimeMs: bucket.timeN > 0 ? bucket.timeSum / bucket.timeN : null,
    firstAttemptAt: bucket.firstAttemptAt,
    lastAttemptAt: bucket.lastAttemptAt,
    conceptId: bucket.conceptId,
    domainTag: bucket.domainTag,
    deckId: bucket.deckId,
    periodStart: bucket.periodStart,
    periodEnd: bucket.periodEnd
  };
};

const sortByLabelThenKey = (a: DataLabAggregateRow, b: DataLabAggregateRow): number => {
  const byLabel = a.label.localeCompare(b.label, "ja");
  if (byLabel !== 0) {
    return byLabel;
  }
  return a.key.localeCompare(b.key, "ja");
};

const sortByPeriod = (a: DataLabAggregateRow, b: DataLabAggregateRow): number => {
  const aStart = a.periodStart ?? a.key;
  const bStart = b.periodStart ?? b.key;
  const byStart = aStart.localeCompare(bStart);
  if (byStart !== 0) {
    return byStart;
  }
  return a.key.localeCompare(b.key);
};

const conceptLabel = (conceptId: string | null, conceptById: Map<string, Concept>): string => {
  if (!conceptId) {
    return "Conceptなし";
  }
  const concept = conceptById.get(conceptId);
  const title = concept?.title?.trim();
  if (title) {
    return title;
  }
  return "削除済みConcept";
};

const deckLabel = (
  deckId: string | null,
  log: QuizAttemptLog,
  deckById: Map<string, QuizDeck>
): string => {
  if (!deckId) {
    return "自由学習";
  }
  const deck = deckById.get(deckId);
  const liveTitle = deck?.title?.trim();
  if (liveTitle) {
    return liveTitle;
  }
  const snapshot = log.deckTitleSnapshot?.trim();
  if (snapshot) {
    return `${snapshot}（削除済み）`;
  }
  return "削除済みDeck";
};

const domainKeysForLog = (
  log: QuizAttemptLog,
  conceptById: Map<string, Concept>
): { key: string; tag: string | null; label: string }[] => {
  const conceptId = getDataLabLogConceptId(log);
  if (!conceptId) {
    return [{ key: DATA_LAB_DOMAIN_NONE_KEY, tag: null, label: "分野なし" }];
  }
  const concept = conceptById.get(conceptId);
  if (!concept) {
    return [{ key: DATA_LAB_DOMAIN_NONE_KEY, tag: null, label: "分野なし" }];
  }
  const uniqueTags = [...new Set((concept.domainTags ?? []).map((tag) => tag.trim()).filter(Boolean))];
  if (uniqueTags.length === 0) {
    return [{ key: DATA_LAB_DOMAIN_NONE_KEY, tag: null, label: "分野なし" }];
  }
  return uniqueTags.map((tag) => ({ key: tag, tag, label: tag }));
};

const resolveDeckId = (log: QuizAttemptLog): string | null => {
  const id = log.deckId?.trim();
  return id || null;
};

export const aggregateDataLabLogs = ({
  logs,
  groupBy,
  conceptById,
  deckById
}: {
  logs: QuizAttemptLog[];
  groupBy: DataLabGroupBy;
  conceptById: Map<string, Concept>;
  deckById: Map<string, QuizDeck>;
}): DataLabAggregateRow[] => {
  const buckets = new Map<string, BucketAcc>();

  for (const log of logs) {
    const answeredAt = parseAnsweredAt(log.answeredAt);
    const isTimeAxis = groupBy === "day" || groupBy === "week" || groupBy === "month";
    // 日 / 週 / 月は時間軸を決定できないため、不正な answeredAt のログだけ除外する。
    // Concept / 分野 / Deck は件数・正誤・平均時間には含め、first/last の比較だけスキップする。
    if (isTimeAxis && !answeredAt) {
      continue;
    }

    if (groupBy === "concept") {
      const conceptId = getDataLabLogConceptId(log);
      const key = conceptId ?? DATA_LAB_CONCEPT_NONE_KEY;
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = emptyBucket(conceptLabel(conceptId, conceptById), {
          conceptId
        });
        buckets.set(key, bucket);
      }
      addLogToBucket(bucket, log, answeredAt);
      continue;
    }

    if (groupBy === "domain") {
      for (const domain of domainKeysForLog(log, conceptById)) {
        let bucket = buckets.get(domain.key);
        if (!bucket) {
          bucket = emptyBucket(domain.label, { domainTag: domain.tag });
          buckets.set(domain.key, bucket);
        }
        addLogToBucket(bucket, log, answeredAt);
      }
      continue;
    }

    if (groupBy === "deck") {
      const deckId = resolveDeckId(log);
      const key = deckId ?? QUIZ_DECK_BUCKET_FREE;
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = emptyBucket(deckLabel(deckId, log, deckById), { deckId });
        buckets.set(key, bucket);
      } else if (deckId && !deckById.has(deckId)) {
        const nextLabel = deckLabel(deckId, log, deckById);
        if (answeredAt) {
          const ms = answeredAt.getTime();
          if (bucket.lastMs == null || ms >= bucket.lastMs) {
            bucket.label = nextLabel;
          }
        }
      }
      addLogToBucket(bucket, log, answeredAt);
      continue;
    }

    if (!answeredAt) {
      continue;
    }

    if (groupBy === "day") {
      const key = localYmd(answeredAt);
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = emptyBucket(key, { periodStart: key, periodEnd: key });
        buckets.set(key, bucket);
      }
      addLogToBucket(bucket, log, answeredAt);
      continue;
    }

    if (groupBy === "week") {
      const week = isoWeekKeyAndRange(answeredAt);
      let bucket = buckets.get(week.key);
      if (!bucket) {
        bucket = emptyBucket(week.label, {
          periodStart: week.periodStart,
          periodEnd: week.periodEnd
        });
        buckets.set(week.key, bucket);
      }
      addLogToBucket(bucket, log, answeredAt);
      continue;
    }

    const key = localYm(answeredAt);
    const periodStart = `${key}-01`;
    const periodEnd = lastLocalDayOfMonth(answeredAt);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = emptyBucket(key, { periodStart, periodEnd });
      buckets.set(key, bucket);
    }
    addLogToBucket(bucket, log, answeredAt);
  }

  const rows = [...buckets.entries()].map(([key, bucket]) => toRow(groupBy, key, bucket));
  if (groupBy === "day" || groupBy === "week" || groupBy === "month") {
    rows.sort(sortByPeriod);
  } else {
    rows.sort(sortByLabelThenKey);
  }
  return rows;
};
