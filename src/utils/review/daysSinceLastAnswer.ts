import { MS_PER_DAY } from "./constants";

/** lastAnsweredAt から now までの経過日数。不正な日時は null。 */
export const daysSinceLastAnswer = (lastAnsweredAt: string, now: Date): number | null => {
  const last = new Date(lastAnsweredAt);
  if (Number.isNaN(last.getTime())) {
    return null;
  }
  return Math.floor((now.getTime() - last.getTime()) / MS_PER_DAY);
};
