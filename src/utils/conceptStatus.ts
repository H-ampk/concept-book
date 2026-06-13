import type { Concept, ConceptInput, ConceptStatus } from "../types/concept";
import { nowIso } from "./date";

/** 定義の有無から active / draft を導出する */
export function deriveConceptStatus(definition?: string | null): "active" | "draft" {
  return definition?.trim() ? "active" : "draft";
}

/** @deprecated deriveConceptStatus の別名 */
export const deriveConceptStatusFromDefinition = deriveConceptStatus;

/** 一覧・詳細・フィルタ用の表示状態 */
export function getDisplayStatus(
  concept: Pick<Concept, "definition" | "status">
): ConceptStatus {
  return deriveConceptStatus(concept.definition);
}

export type ConceptSaveOptions = {
  statusExplicitlySet?: boolean;
};

/** 保存時に definition から status を決定する */
export function resolveConceptStatusOnSave(
  definition: string,
  _status?: ConceptStatus,
  _options?: ConceptSaveOptions
): ConceptStatus {
  return deriveConceptStatus(definition);
}

export function applyDerivedStatusToInput<T extends ConceptInput>(
  input: T,
  _options?: ConceptSaveOptions
): T {
  const status = deriveConceptStatus(input.definition);
  if (status === input.status) {
    return input;
  }
  return { ...input, status };
}

/** 更新保存時: definition から status を再計算する */
export function applyDerivedStatusOnUpdate(
  existing: Concept,
  updates: Partial<ConceptInput>,
  _options?: ConceptSaveOptions
): Partial<ConceptInput> {
  const definition =
    updates.definition !== undefined ? updates.definition : existing.definition;
  const resolved = deriveConceptStatus(definition);

  if (resolved === existing.status) {
    return updates;
  }
  return { ...updates, status: resolved };
}

export type NormalizeConceptStatusesResult = {
  concepts: Concept[];
  changedCount: number;
  changedIds: string[];
};

/** 全概念の status を definition から再計算する（冪等） */
export function normalizeConceptStatuses(concepts: Concept[]): NormalizeConceptStatusesResult {
  const changedIds: string[] = [];
  const normalized = concepts.map((concept) => {
    const nextStatus = deriveConceptStatus(concept.definition);
    if (concept.status === nextStatus) {
      return concept;
    }
    changedIds.push(concept.id);
    return {
      ...concept,
      status: nextStatus,
      updatedAt: nowIso()
    };
  });

  return {
    concepts: normalized,
    changedCount: changedIds.length,
    changedIds
  };
}
