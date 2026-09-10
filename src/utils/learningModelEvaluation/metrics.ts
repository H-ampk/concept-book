import type {
  LearningModelPredictionMetrics,
  LearningModelPredictionPoint,
  LearningModelPredictionPointFilter
} from "./types";

/** Log loss 計算時のみ用いる。stored prediction point の確率は変更しない。 */
const LOG_LOSS_EPSILON = 1e-15;

type OutcomePoint = Pick<LearningModelPredictionPoint, "predictedCorrectProbability" | "actualCorrect">;

const toOutcome = (actualCorrect: boolean): 0 | 1 => (actualCorrect ? 1 : 0);

const clipProbabilityForLogLoss = (probability: number): number =>
  Math.min(1 - LOG_LOSS_EPSILON, Math.max(LOG_LOSS_EPSILON, probability));

/**
 * Brier score。1件は (p - y)^2。複数件は平均。
 * y は correct→1 / incorrect→0。評価対象 0 件では null（0 ではない）。
 */
export const calculateBrierScore = (points: readonly OutcomePoint[]): number | null => {
  if (points.length === 0) {
    return null;
  }
  let sum = 0;
  for (const point of points) {
    const residual = point.predictedCorrectProbability - toOutcome(point.actualCorrect);
    sum += residual * residual;
  }
  return sum / points.length;
};

/**
 * Log loss。1件は -[y log(p) + (1-y) log(1-p)]。複数件は平均。
 * p=0 / p=1 で Infinity にならないよう、計算時だけ epsilon clipping する。
 * 評価対象 0 件では null（0 ではない）。
 */
export const calculateLogLoss = (points: readonly OutcomePoint[]): number | null => {
  if (points.length === 0) {
    return null;
  }
  let sum = 0;
  for (const point of points) {
    const y = toOutcome(point.actualCorrect);
    const clipped = clipProbabilityForLogLoss(point.predictedCorrectProbability);
    sum += -(y * Math.log(clipped) + (1 - y) * Math.log(1 - clipped));
  }
  return sum / points.length;
};

export const filterLearningModelPredictionPoints = (
  points: readonly LearningModelPredictionPoint[],
  filter?: LearningModelPredictionPointFilter
): LearningModelPredictionPoint[] => {
  if (!filter) {
    return [...points];
  }
  return points.filter((point) => {
    if (filter.model !== undefined && point.model !== filter.model) {
      return false;
    }
    if (filter.conceptId !== undefined && point.conceptId !== filter.conceptId) {
      return false;
    }
    return true;
  });
};

/**
 * 予測点群の評価指標を集計する。
 * filter.model / filter.conceptId で全体・モデル単位・Concept 単位、
 * および「モデルを指定したうえで Concept ごと」の集計ができる。
 */
export const summarizeLearningModelPredictionMetrics = (
  points: readonly LearningModelPredictionPoint[],
  filter?: LearningModelPredictionPointFilter
): LearningModelPredictionMetrics => {
  const filtered = filterLearningModelPredictionPoints(points, filter);
  return {
    count: filtered.length,
    brierScore: calculateBrierScore(filtered),
    logLoss: calculateLogLoss(filtered)
  };
};

const summarizeFromBuckets = (
  buckets: Map<string, LearningModelPredictionPoint[]>
): Map<string, LearningModelPredictionMetrics> => {
  const metrics = new Map<string, LearningModelPredictionMetrics>();
  for (const [key, bucket] of buckets) {
    metrics.set(key, summarizeLearningModelPredictionMetrics(bucket));
  }
  return metrics;
};

export const groupLearningModelPredictionMetricsByModel = (
  points: readonly LearningModelPredictionPoint[]
): Map<string, LearningModelPredictionMetrics> => {
  const buckets = new Map<string, LearningModelPredictionPoint[]>();
  for (const point of points) {
    const bucket = buckets.get(point.model);
    if (bucket) {
      bucket.push(point);
    } else {
      buckets.set(point.model, [point]);
    }
  }
  return summarizeFromBuckets(buckets);
};

export const groupLearningModelPredictionMetricsByConcept = (
  points: readonly LearningModelPredictionPoint[]
): Map<string, LearningModelPredictionMetrics> => {
  const buckets = new Map<string, LearningModelPredictionPoint[]>();
  for (const point of points) {
    const bucket = buckets.get(point.conceptId);
    if (bucket) {
      bucket.push(point);
    } else {
      buckets.set(point.conceptId, [point]);
    }
  }
  return summarizeFromBuckets(buckets);
};

/**
 * model → conceptId → metrics。
 * Data Lab から「指定モデルの Concept ごとの予測誤差」を集計するために使う。
 */
export const groupLearningModelPredictionMetricsByModelAndConcept = (
  points: readonly LearningModelPredictionPoint[]
): Map<string, Map<string, LearningModelPredictionMetrics>> => {
  const nested = new Map<string, Map<string, LearningModelPredictionPoint[]>>();
  for (const point of points) {
    let byConcept = nested.get(point.model);
    if (!byConcept) {
      byConcept = new Map();
      nested.set(point.model, byConcept);
    }
    const bucket = byConcept.get(point.conceptId);
    if (bucket) {
      bucket.push(point);
    } else {
      byConcept.set(point.conceptId, [point]);
    }
  }

  const metrics = new Map<string, Map<string, LearningModelPredictionMetrics>>();
  for (const [model, byConcept] of nested) {
    metrics.set(model, summarizeFromBuckets(byConcept));
  }
  return metrics;
};
