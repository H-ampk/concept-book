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
 * 保存直前: 各選択肢にテキスト一致による linkedConceptId を付与（ambiguous は付与しない）。
 * displayText / sourceConceptId 等の既存 Choice metadata は保持する。
 * linkedConceptId だけはテキスト照合結果で再計算する（一意一致時のみ付与）。
 */
export const applyAutoLinkedConceptIdsToChoices = (
  choices: QuizChoice[],
  concepts: Concept[]
): QuizChoice[] =>
  choices.map((c) => {
    const resolved = resolveChoiceConceptLink(c.text.trim(), concepts);
    const next: QuizChoice = { ...c };
    if (resolved.state === "linked" && resolved.linkedConceptId) {
      next.linkedConceptId = resolved.linkedConceptId;
    } else {
      delete next.linkedConceptId;
    }
    return next;
  });

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
