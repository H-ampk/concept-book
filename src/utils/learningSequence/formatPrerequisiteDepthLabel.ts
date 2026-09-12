import type { ConceptLearningSequenceItem } from "./types";

export const formatPrerequisiteDepthLabel = (
  item: Pick<ConceptLearningSequenceItem, "prerequisiteDepth" | "isTarget">
): string => {
  if (item.isTarget || item.prerequisiteDepth <= 0) {
    return "学習対象";
  }
  if (item.prerequisiteDepth === 1) {
    return "直接の前提";
  }
  return `${item.prerequisiteDepth}段階前の前提`;
};
