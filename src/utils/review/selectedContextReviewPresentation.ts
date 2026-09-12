import { MASTERY_CONFIDENCE_LABELS, MASTERY_STATE_LABELS } from "../mastery/constants";
import type { WeakPrerequisiteReason } from "./types";

export const formatWeakPrerequisiteReason = (reason: WeakPrerequisiteReason): string => {
  if (reason.satisfactionReason === "insufficient-evidence") {
    return "前提を満たしたと判断するにはデータが不足しています";
  }
  return "前提としてまだ十分ではありません";
};

export const formatWeakPrerequisiteState = (reason: WeakPrerequisiteReason): string => {
  if (reason.state == null || reason.state === "insufficient-data") {
    return "データ不足";
  }
  if (reason.state === "unlearned") {
    return "未学習";
  }
  const confidenceLabel = reason.confidence
    ? MASTERY_CONFIDENCE_LABELS[reason.confidence]
    : undefined;
  const stateLabel = MASTERY_STATE_LABELS[reason.state];
  return confidenceLabel ? `${stateLabel} / 信頼度 ${confidenceLabel}` : stateLabel;
};
