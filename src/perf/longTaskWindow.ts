export type LongTaskEntry = {
  startTime: number;
  duration: number;
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
