import type { GlobalReviewReason, ReviewPriority } from "./types";

const reasonTypes = (reasons: readonly { type: GlobalReviewReason }[]): Set<GlobalReviewReason> =>
  new Set(reasons.map((reason) => reason.type));

/**
 * 説明可能なカテゴリ規則。masteryScore との合算や magic score は使わない。
 *
 * HIGH: low-mastery + recent-errors
 * MEDIUM: low-mastery / recent-errors / frequent-confusion / stale のいずれか
 * LOW: insufficient-data のみ
 */
export const getReviewPriority = (reasons: readonly { type: GlobalReviewReason }[]): ReviewPriority => {
  const types = reasonTypes(reasons);
  if (types.has("low-mastery") && types.has("recent-errors")) {
    return "high";
  }
  if (
    types.has("low-mastery") ||
    types.has("recent-errors") ||
    types.has("frequent-confusion") ||
    types.has("stale")
  ) {
    return "medium";
  }
  return "low";
};
