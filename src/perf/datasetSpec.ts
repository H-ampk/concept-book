export const PERF_SEARCH_TOKEN = "perfprobe-alpha";
export const PERF_EDIT_TITLE = "PERF-EDIT-TARGET";
export const PERF_DELETE_TITLE = "PERF-DELETE-TARGET";

/** 関係数の意味: floor(n/2) 本の無向 related と、残り本数の有向 prerequisite。 */
export type SyntheticDatasetSpec = {
  id: string;
  seed: number;
  conceptCount: number;
  logCount: number;
  quizCount: number;
  contextCount: number;
  relationCount: number;
  attachmentBytes: number;
};

export type DatasetScale = "S" | "M" | "L" | "XL";

export const PERF_DATASET_SEED = 244001;

const base = (
  id: string,
  conceptCount: number,
  logCount: number,
  quizCount: number,
  contextCount: number,
  relationCount: number,
  attachmentBytes = 0
): SyntheticDatasetSpec => ({
  id,
  seed: PERF_DATASET_SEED,
  conceptCount,
  logCount,
  quizCount,
  contextCount,
  relationCount,
  attachmentBytes
});

export const DATASET_PRESETS: Record<"S" | "M" | "L", SyntheticDatasetSpec> = {
  S: base("S", 100, 1_000, 200, 20, 100, 0),
  M: base("M", 1_000, 10_000, 2_000, 100, 1_000, 0),
  L: base("L", 5_000, 50_000, 10_000, 300, 5_000, 0)
};

export type XlOptions = {
  conceptCount?: number;
  logCount?: number;
  quizCount?: number;
  contextCount?: number;
  relationCount?: number;
  attachmentBytes?: number;
};

/** L を基準に、概念数・ログ数・添付容量などを上書きするストレステスト。 */
export const createXlSpec = (options: XlOptions): SyntheticDatasetSpec => {
  const spec: SyntheticDatasetSpec = {
    ...DATASET_PRESETS.L,
    id: "XL",
    ...options
  };
  assertSyntheticDatasetSpec(spec);
  return spec;
};

const isNonNegativeInt = (value: number): boolean => Number.isInteger(value) && value >= 0;

export const assertSyntheticDatasetSpec = (spec: SyntheticDatasetSpec): void => {
  if (!spec.id.trim()) {
    throw new Error("データセット ID が空です。");
  }
  if (!Number.isInteger(spec.seed)) {
    throw new Error("seed は整数である必要があります。");
  }
  const counts: Array<[string, number]> = [
    ["conceptCount", spec.conceptCount],
    ["logCount", spec.logCount],
    ["quizCount", spec.quizCount],
    ["contextCount", spec.contextCount],
    ["relationCount", spec.relationCount],
    ["attachmentBytes", spec.attachmentBytes]
  ];
  for (const [name, value] of counts) {
    if (!isNonNegativeInt(value)) {
      throw new Error(`${name} は 0 以上の整数である必要があります。`);
    }
  }
  if (spec.quizCount > 0 && spec.conceptCount === 0) {
    throw new Error("概念が 0 件のときクイズ問題は生成できません。");
  }
  if (spec.logCount > 0 && spec.quizCount === 0) {
    throw new Error("学習ログを生成するにはクイズ問題が 1 件以上必要です。");
  }
  if (spec.attachmentBytes > 0 && spec.contextCount === 0) {
    throw new Error("添付容量を持たせるには文脈カードが 1 件以上必要です。");
  }
  const relatedPairs = Math.floor(spec.relationCount / 2);
  const prerequisiteCount = spec.relationCount - relatedPairs;
  const maxUndirected =
    spec.conceptCount < 2 ? 0 : (spec.conceptCount * (spec.conceptCount - 1)) / 2;
  const maxDag = spec.conceptCount < 2 ? 0 : (spec.conceptCount * (spec.conceptCount - 1)) / 2;
  if (relatedPairs > maxUndirected) {
    throw new Error("related 関係が概念数に対して多すぎます。");
  }
  if (prerequisiteCount > maxDag) {
    throw new Error("prerequisite 関係が概念数に対して多すぎます。");
  }
};
