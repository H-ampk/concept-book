import type { ConceptMediaCommitItem, ConceptMediaDraftItem } from "../types/media";

export const toConceptMediaCommitItems = (
  draft: readonly ConceptMediaDraftItem[]
): ConceptMediaCommitItem[] =>
  draft.map((item) =>
    item.type === "existing"
      ? {
          type: "existing" as const,
          mediaId: item.mediaId,
          caption: item.caption?.trim() ? item.caption.trim() : undefined
        }
      : {
          type: "new" as const,
          file: item.file,
          caption: item.caption?.trim() ? item.caption.trim() : undefined
        }
  );

export const revokeNewMediaObjectUrls = (draft: readonly ConceptMediaDraftItem[]): void => {
  for (const item of draft) {
    if (item.type === "new") {
      URL.revokeObjectURL(item.objectUrl);
    }
  }
};
