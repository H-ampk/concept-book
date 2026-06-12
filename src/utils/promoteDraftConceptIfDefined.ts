import type { Concept, ConceptInput, ConceptStatus } from "../types/concept";

export type ConceptSaveOptions = {
  /** 状態をユーザーが明示的に選択した場合は true（draft のまま維持） */
  statusExplicitlySet?: boolean;
};

/** definition が入力済みなら draft を active に昇格する */
export function promoteDraftStatusIfDefined(
  status: ConceptStatus,
  definition: string,
  options?: ConceptSaveOptions
): ConceptStatus {
  if (options?.statusExplicitlySet && status === "draft") {
    return status;
  }
  if (status === "draft" && definition.trim().length > 0) {
    return "active";
  }
  return status;
}

export function promoteDraftConceptIfDefined<T extends ConceptInput>(
  input: T,
  options?: ConceptSaveOptions
): T {
  const promoted = promoteDraftStatusIfDefined(input.status, input.definition, options);
  if (promoted === input.status) {
    return input;
  }
  return { ...input, status: promoted };
}

/** 更新保存時: definition または status が含まれる場合のみ昇格判定する */
export function applyDraftPromotionOnUpdate(
  existing: Concept,
  updates: Partial<ConceptInput>,
  options?: ConceptSaveOptions
): Partial<ConceptInput> {
  if (updates.definition === undefined && updates.status === undefined) {
    return updates;
  }

  const status = updates.status ?? existing.status;
  const definition =
    updates.definition !== undefined ? updates.definition : existing.definition;
  const promoted = promoteDraftStatusIfDefined(status, definition, options);

  if (promoted === status) {
    return updates;
  }
  return { ...updates, status: promoted };
}
