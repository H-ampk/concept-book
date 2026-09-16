import type { Concept } from "../types/concept";
import type { QuizChoice, QuizQuestion } from "../types/quiz";
import { normalizeConceptTitle } from "./normalizeConceptTitle";

/** @deprecated 概念名照合は normalizeConceptTitle を直接使用してください */
export const normalizeTitleForQuizMatch = normalizeConceptTitle;

export type ChoiceConceptLinkState = "linked" | "none" | "ambiguous";

export type ResolvedChoiceConceptLink = {
  state: ChoiceConceptLinkState;
  linkedConceptId?: string;
  matchedTitle?: string;
};

/**
 * 選択肢テキストから Concept への自動リンクを解決する。
 * 同一正規化タイトルの Concept が複数ある場合は ambiguous（ID は付けない）。
 */
export const resolveChoiceConceptLink = (
  choiceTextTrimmed: string,
  concepts: Concept[]
): ResolvedChoiceConceptLink => {
  if (!choiceTextTrimmed) {
    return { state: "none" };
  }
  const key = normalizeConceptTitle(choiceTextTrimmed);
  if (!key) {
    return { state: "none" };
  }
  const matches = concepts.filter((c) => normalizeConceptTitle(c.title || "") === key);
  if (matches.length === 0) {
    return { state: "none" };
  }
  if (matches.length > 1) {
    return { state: "ambiguous", matchedTitle: matches[0]?.title || "" };
  }
  return {
    state: "linked",
    linkedConceptId: matches[0].id,
    matchedTitle: matches[0].title || "無題"
  };
};

/**
 * 保存直前: 手動 Choice にはテキスト一致による linkedConceptId を付与（ambiguous は付与しない）。
 * sourceConceptId がある生成由来 Choice はタイトル照合せず、有効な既存 linkedConceptId のみ保持する。
 * displayText / sourceConceptId 等の既存 Choice metadata は保持する。
 */
export const applyAutoLinkedConceptIdsToChoices = (
  choices: QuizChoice[],
  concepts: Concept[]
): QuizChoice[] => {
  const validConceptIds = new Set(concepts.map((concept) => concept.id));
  return choices.map((choice) => {
    const next: QuizChoice = { ...choice };
    if (choice.sourceConceptId) {
      if (choice.linkedConceptId && validConceptIds.has(choice.linkedConceptId)) {
        return next;
      }
      delete next.linkedConceptId;
      return next;
    }
    const resolved = resolveChoiceConceptLink(choice.text.trim(), concepts);
    if (resolved.state === "linked" && resolved.linkedConceptId) {
      next.linkedConceptId = resolved.linkedConceptId;
    } else {
      delete next.linkedConceptId;
    }
    return next;
  });
};

/** ZIP / JSON インポート後: 存在しない Concept を指す conceptId / linkedConceptId を外す */
export const stripInvalidQuizReferences = (
  q: QuizQuestion,
  validConceptIds: Set<string>
): QuizQuestion => {
  const conceptId =
    q.conceptId !== undefined && q.conceptId !== "" && validConceptIds.has(q.conceptId)
      ? q.conceptId
      : undefined;

  const choices: QuizChoice[] = q.choices.map((c) => {
    const next: QuizChoice = { ...c };
    const linkedId = c.linkedConceptId?.trim() ?? "";
    if (linkedId && validConceptIds.has(linkedId)) {
      next.linkedConceptId = linkedId;
    } else {
      delete next.linkedConceptId;
    }
    return next;
  });

  return { ...q, conceptId, choices };
};
