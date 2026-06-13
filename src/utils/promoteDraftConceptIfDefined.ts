import type { Concept, ConceptInput } from "../types/concept";
import {
  applyDerivedStatusOnUpdate,
  applyDerivedStatusToInput,
  type ConceptSaveOptions
} from "./conceptStatus";

export type { ConceptSaveOptions };

/** @deprecated applyDerivedStatusToInput を使用 */
export function promoteDraftConceptIfDefined<T extends ConceptInput>(
  input: T,
  options?: ConceptSaveOptions
): T {
  return applyDerivedStatusToInput(input, options);
}

/** @deprecated applyDerivedStatusOnUpdate を使用 */
export function applyDraftPromotionOnUpdate(
  existing: Concept,
  updates: Partial<ConceptInput>,
  options?: ConceptSaveOptions
): Partial<ConceptInput> {
  return applyDerivedStatusOnUpdate(existing, updates, options);
}
