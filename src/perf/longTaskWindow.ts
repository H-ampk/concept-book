export type LongTaskEntry = {
  startTime: number;
  duration: number;
};

const longTaskKey = (task: LongTaskEntry): string => `${task.startTime}:${task.duration}`;

/** コールバック済みの記録と、まだ通知されていない記録を重複なくつなぐ。 */
export const mergeLongTasks = (
  delivered: LongTaskEntry[],
  pending: LongTaskEntry[]
): LongTaskEntry[] => {
  const seen = new Set<string>();
  const merged: LongTaskEntry[] = [];
  for (const task of [...delivered, ...pending]) {
    const key = longTaskKey(task);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push(task);
  }
  return merged;
};

/** 開始以上、終了未満に開始した Long Task だけを残す。 */
export const selectLongTasks = (
  tasks: LongTaskEntry[],
  startTime: number,
  endTime: number
): LongTaskEntry[] =>
  tasks.filter(
    (task) =>
      Number.isFinite(task.startTime) &&
      Number.isFinite(task.duration) &&
      task.startTime >= startTime &&
      task.startTime < endTime
  );
