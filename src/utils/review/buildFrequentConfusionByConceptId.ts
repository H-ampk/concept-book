import { buildDirectConfusionEdges, type ConfusionEdgeCountInput } from "../conceptGraphConfusion";
import { MIN_FREQUENT_CONFUSION_COUNT } from "./constants";
import type { FrequentConfusionReason } from "./types";

const compareConfusionReasons = (a: FrequentConfusionReason, b: FrequentConfusionReason): number => {
  if (b.confusionCount !== a.confusionCount) {
    return b.confusionCount - a.confusionCount;
  }
  return a.otherConceptId.localeCompare(b.otherConceptId);
};

/**
 * 方向付き混同統計を既存の無向エッジへ畳み、threshold 以上の pair を両 Concept へ付ける。
 * 自己 pair・欠損 ID・削除済み Concept は buildDirectConfusionEdges と同じく除外する。
 */
export const buildFrequentConfusionByConceptId = (
  confusionStats: readonly ConfusionEdgeCountInput[],
  validConceptIds: ReadonlySet<string>
): Map<string, FrequentConfusionReason[]> => {
  const edges = buildDirectConfusionEdges(confusionStats, validConceptIds);
  const byConceptId = new Map<string, FrequentConfusionReason[]>();

  const push = (conceptId: string, otherConceptId: string, confusionCount: number) => {
    const list = byConceptId.get(conceptId);
    const reason: FrequentConfusionReason = {
      type: "frequent-confusion",
      otherConceptId,
      confusionCount
    };
    if (list) {
      list.push(reason);
    } else {
      byConceptId.set(conceptId, [reason]);
    }
  };

  for (const edge of edges) {
    if (edge.count < MIN_FREQUENT_CONFUSION_COUNT) {
      continue;
    }
    push(edge.source, edge.target, edge.count);
    push(edge.target, edge.source, edge.count);
  }

  for (const reasons of byConceptId.values()) {
    reasons.sort(compareConfusionReasons);
  }

  return byConceptId;
};
