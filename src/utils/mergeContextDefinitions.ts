import type { ContextDefinition } from "../types/concept";

/**
 * Concept LWW winner の contextDefinitions を preferred、loser を fallback として
 * definition ID 単位で union merge する。
 *
 * - preferred の順を維持する
 * - 同一 ID は preferred の内容を採用する
 * - fallback にだけある ID は fallback 側の順で末尾追加する
 */
export const mergeContextDefinitions = (
  preferred: readonly ContextDefinition[] | undefined,
  fallback: readonly ContextDefinition[] | undefined
): ContextDefinition[] => {
  const preferredList = preferred ?? [];
  const fallbackList = fallback ?? [];
  const seenIds = new Set<string>();
  const merged: ContextDefinition[] = [];

  for (const item of preferredList) {
    if (seenIds.has(item.id)) {
      continue;
    }
    seenIds.add(item.id);
    merged.push(item);
  }

  for (const item of fallbackList) {
    if (seenIds.has(item.id)) {
      continue;
    }
    seenIds.add(item.id);
    merged.push(item);
  }

  return merged;
};
