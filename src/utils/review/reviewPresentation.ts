import { formatConceptRef } from "../quizStats";
import { RECENT_ERROR_WINDOW, REVIEW_PRIORITY_LABELS } from "./constants";
import type { GlobalReviewReasonDetail, ReviewPriority } from "./types";

export { REVIEW_PRIORITY_LABELS };

export const formatReviewPriorityLabel = (priority: ReviewPriority): string =>
  REVIEW_PRIORITY_LABELS[priority];

export const formatReviewReasonDetail = (
  reason: GlobalReviewReasonDetail,
  titleById: Map<string, string>
): string => {
  switch (reason.type) {
    case "low-mastery":
      return "安定して正答できていません";
    case "insufficient-data":
      return "学習データが不足しています";
    case "stale":
      return "長期間確認していません";
    case "recent-errors":
      return `最近${RECENT_ERROR_WINDOW}回中${reason.recentIncorrectCount}回誤答`;
    case "frequent-confusion": {
      const otherName = formatConceptRef(reason.otherConceptId, titleById);
      return `${otherName}と${reason.confusionCount}回混同しています`;
    }
  }
};
