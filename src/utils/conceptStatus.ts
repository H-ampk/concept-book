import type { Concept, ConceptInput, ConceptStatus } from "../types/concept";

const MANUAL_STATUSES: ConceptStatus[] = ["researching", "unclear", "archived"];

/** 定義の有無から active / draft を導出する */
export function deriveConceptStatus(definition?: string | null): "active" | "draft" {
  return definition?.trim() ? "active" : "draft";
}

/** 一覧・詳細・フィルタ用の表示状態（定義由来の active/draft を優先） */
export function getDisplayStatus(
  concept: Pick<Concept, "definition" | "status">
): ConceptStatus {
  if (MANUAL_STATUSES.includes(concept.status)) {
    return concept.status;
  }
  return deriveConceptStatus(concept.definition);
}

export type ConceptSaveOptions = {
  /** researching / unclear / archived をユーザーが明示選択した場合は true */
  statusExplicitlySet?: boolean;
};

/** 保存時に definition から status を決定する（手動管理の状態は維持） */
export function resolveConceptStatusOnSave(
  definition: string,
  status: ConceptStatus,
  _options?: ConceptSaveOptions
): ConceptStatus {
  if (MANUAL_STATUSES.includes(status)) {
    return status;
  }
  return deriveConceptStatus(definition);
}

export function applyDerivedStatusToInput<T extends ConceptInput>(
  input: T,
  options?: ConceptSaveOptions
): T {
  const status = resolveConceptStatusOnSave(input.definition, input.status, options);
  if (status === input.status) {
    return input;
  }
  return { ...input, status };
}

/** 更新保存時: マージ後の definition / status から状態を再計算する */
export function applyDerivedStatusOnUpdate(
  existing: Concept,
  updates: Partial<ConceptInput>,
  options?: ConceptSaveOptions
): Partial<ConceptInput> {
  const status = updates.status ?? existing.status;
  const definition =
    updates.definition !== undefined ? updates.definition : existing.definition;
  const resolved = resolveConceptStatusOnSave(definition, status, options);

  if (resolved === existing.status) {
    return updates;
  }
  return { ...updates, status: resolved };
}
