/** 起動時にログ配列が揃うと App が実行する学習モデル。回数は固定しない。 */
export const STARTUP_LEARNING_MODEL_NAMES = [
  "learning-model.bkt-mastery-map",
  "learning-model.quiz-stats",
  "learning-model.confusion-pairs"
] as const;

type TimedStoreRead = {
  store: string;
  at: number;
};

type TimedModelSample = {
  name: string;
  at: number;
};

/**
 * 最新の学習ログ読み取り以降に、BKT・クイズ統計・混同ペアがそれぞれ完了しているか。
 * ログ読み取りが無いときは未完了とする。計算回数 0 を、読み取り前の打ち切りと区別する。
 */
export const learningModelsCoverLatestLogRead = (
  idb: readonly TimedStoreRead[],
  models: readonly TimedModelSample[]
): boolean => {
  let lastLogAt: number | null = null;
  for (const sample of idb) {
    if (sample.store !== "quizAttemptLogs") {
      continue;
    }
    if (lastLogAt === null || sample.at >= lastLogAt) {
      lastLogAt = sample.at;
    }
  }
  if (lastLogAt === null) {
    return false;
  }
  return STARTUP_LEARNING_MODEL_NAMES.every((name) =>
    models.some((sample) => sample.name === name && sample.at >= lastLogAt)
  );
};
