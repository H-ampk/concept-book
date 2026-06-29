import type { ContextDefinition } from "../types/concept";
import { normalizeConceptTitle } from "./normalizeConceptTitle";

export type AddContextDefinitionsFromFieldTagsResult =
  | { kind: "added"; count: number; message: string; newDefinitions: ContextDefinition[] }
  | { kind: "none"; message: string }
  | { kind: "no_tags"; message: string };

const parseFieldTags = (fieldTags: string): string[] =>
  fieldTags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

const uniqueTagsPreservingOrder = (tags: string[]): string[] =>
  Array.from(new Map(tags.map((tag) => [normalizeConceptTitle(tag), tag])).values());

export function hasAddableContextDefinitionsFromFieldTags(
  fieldTags: string,
  existingContextDefinitions: ContextDefinition[]
): boolean {
  const tags = uniqueTagsPreservingOrder(parseFieldTags(fieldTags));
  if (tags.length === 0) {
    return false;
  }

  const existingContextNames = new Set(
    existingContextDefinitions.map((def) => normalizeConceptTitle(def.context))
  );

  return tags.some((tag) => !existingContextNames.has(normalizeConceptTitle(tag)));
}

export function addContextDefinitionsFromFieldTags(
  fieldTags: string,
  existingContextDefinitions: ContextDefinition[]
): AddContextDefinitionsFromFieldTagsResult {
  const tags = parseFieldTags(fieldTags);

  if (tags.length === 0) {
    return { kind: "no_tags", message: "分野タグが入力されていません。" };
  }

  const uniqueTags = uniqueTagsPreservingOrder(tags);

  const existingContextNames = new Set(
    existingContextDefinitions.map((def) => normalizeConceptTitle(def.context))
  );

  const missingTags = uniqueTags.filter(
    (tag) => !existingContextNames.has(normalizeConceptTitle(tag))
  );

  if (missingTags.length === 0) {
    return { kind: "none", message: "追加できる文脈別定義はありません。" };
  }

  const newDefinitions: ContextDefinition[] = missingTags.map((tag) => ({
    id: crypto.randomUUID(),
    context: tag,
    definition: "",
  }));

  return {
    kind: "added",
    count: newDefinitions.length,
    message: `${newDefinitions.length}件の文脈別定義を追加しました。`,
    newDefinitions,
  };
}
