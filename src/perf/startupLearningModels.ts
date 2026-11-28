/** 起動時にログ配列が揃うと App が実行する学習モデル。回数は固定しない。 */
export const STARTUP_LEARNING_MODEL_NAMES = [
  "learning-model.bkt-mastery-map",
  "learning-model.quiz-stats",
  "learning-model.confusion-pairs"
] as const;

type OrderedStoreRead = {
  store: string;
  seq: number;
};

type OrderedModelSample = {
  name: string;
  seq: number;
};

/**
 * 最新の学習ログ読み取りより後の記録で、BKT・クイズ統計・混同ペアが揃っているか。
 * 順序は performance.now() ではなく、プローブが記録した単調増加の連番で見る。
 * 同じ時刻でも、読み取りより前に記録された計算は含めず、後に記録された計算は含める。
 * ログ読み取りが無いときは未完了とする。
 *
 * 連番は記録順であり、計算がどのログ配列を閉じ込めたかまでは見ない。
 * 現行の App は読み取り完了を記録したあと、その結果を state に入れて useMemo で計算する。
 * 読み取りが重なると、より新しい読み取りの後に、より古い配列の計算が記録される余地がある。
 */
export const learningModelsCoverLatestLogRead = (
  idb: readonly OrderedStoreRead[],
  models: readonly OrderedModelSample[]
): boolean => {
  let lastLogSeq: number | null = null;
  for (const sample of idb) {
    if (sample.store !== "quizAttemptLogs" || typeof sample.seq !== "number") {
      continue;
    }
    if (lastLogSeq === null || sample.seq > lastLogSeq) {
      lastLogSeq = sample.seq;
    }
  }
  if (lastLogSeq === null) {
    return false;
  }
  return STARTUP_LEARNING_MODEL_NAMES.every((name) =>
    models.some(
      (sample) => sample.name === name && typeof sample.seq === "number" && sample.seq > lastLogSeq
    )
  );
};
