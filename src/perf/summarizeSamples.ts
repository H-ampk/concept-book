/** p95 は試行がこの件数以上のときだけ記録する。 */
export const P95_MIN_TRIALS = 20;

export type SampleSummary = {
  status: "measured";
  unit: string;
  count: number;
  trials: number[];
  min: number;
  max: number;
  median: number;
  /** 不偏標準偏差。試行が 1 件のときは 0。 */
  stdev: number;
  p95?: number;
};

export type UnmeasuredMetric = {
  status: "unmeasured";
  reason: string;
};

export type Metric = SampleSummary | UnmeasuredMetric;

export const summarizeSamples = (values: number[], unit: string): SampleSummary => {
  if (values.length === 0) {
    throw new Error("集計する測定値がありません。");
  }
  if (values.some((value) => !Number.isFinite(value))) {
    throw new Error("測定値に有限でない数が含まれています。");
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.length === 1
      ? 0
      : values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
  const summary: SampleSummary = {
    status: "measured",
    unit,
    count: values.length,
    trials: [...values],
    min: sorted[0]!,
    max: sorted[sorted.length - 1]!,
    median,
    stdev: Math.sqrt(variance)
  };
  if (values.length >= P95_MIN_TRIALS) {
    const index = Math.min(sorted.length - 1, Math.ceil(0.95 * sorted.length) - 1);
    summary.p95 = sorted[index];
  }
  return summary;
};

export const unmeasured = (reason: string): UnmeasuredMetric => ({
  status: "unmeasured",
  reason
});
