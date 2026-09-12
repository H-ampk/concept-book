import type { ReviewPriority } from "./types";

/** 直近何回答を recent-errors の対象にするか。ConceptMastery.recentResults（最大5件）の末尾から取る。 */
export const RECENT_ERROR_WINDOW = 3;

/** 直近 window 内でこの回数以上誤答していれば recent-errors。 */
export const RECENT_ERROR_MIN_INCORRECT = 2;

/** 同一 Concept pair（無向）の混同がこの回数以上なら frequent-confusion。 */
export const MIN_FREQUENT_CONFUSION_COUNT = 2;

export const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const REVIEW_PRIORITY_RANK: Record<ReviewPriority, number> = {
  high: 0,
  medium: 1,
  low: 2
};

export const REVIEW_PRIORITY_LABELS: Record<ReviewPriority, string> = {
  high: "高",
  medium: "中",
  low: "低"
};
