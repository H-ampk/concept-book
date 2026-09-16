import type { Concept } from "../../types/concept";

export const DATA_LAB_MISSING_CONCEPT_LABEL = "Conceptなし";
export const DATA_LAB_DELETED_CONCEPT_LABEL = "削除済みConcept";

export const formatDeletedDataLabConceptLabel = (conceptId: string): string =>
  `${DATA_LAB_DELETED_CONCEPT_LABEL} (${conceptId})`;

export const formatDataLabConceptLabel = (
  conceptId: string | null,
  conceptById: Map<string, Concept>
): string => {
  if (!conceptId) {
    return DATA_LAB_MISSING_CONCEPT_LABEL;
  }
  const title = conceptById.get(conceptId)?.title?.trim();
  if (title) {
    return title;
  }
  return formatDeletedDataLabConceptLabel(conceptId);
};

export const formatStoredDataLabConceptLabel = (
  label: string,
  conceptId?: string | null
): string => {
  if (label !== DATA_LAB_DELETED_CONCEPT_LABEL || !conceptId) {
    return label;
  }
  return formatDeletedDataLabConceptLabel(conceptId);
};
