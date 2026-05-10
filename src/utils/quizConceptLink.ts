import type { Concept } from "../types/concept";
import type { QuizChoice, QuizQuestion } from "../types/quiz";

/** Concept タイトル比較用: trim → NFKC → 英字小文字化 */
export const normalizeTitleForQuizMatch = (value: string): string =>
  value
    .trim()
    .normalize("NFKC")
    .toLowerCase();

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
  const key = normalizeTitleForQuizMatch(choiceTextTrimmed);
  if (!key) {
    return { state: "none" };
  }
  const matches = concepts.filter((c) => normalizeTitleForQuizMatch(c.title || "") === key);
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

/** 保存直前: 各選択肢にテキスト一致による linkedConceptId を付与（ambiguous は付与しない） */
export const applyAutoLinkedConceptIdsToChoices = (
  choices: QuizChoice[],
  concepts: Concept[]
): QuizChoice[] =>
  choices.map((c) => {
    const resolved = resolveChoiceConceptLink(c.text.trim(), concepts);
    const next: QuizChoice = { id: c.id, text: c.text };
    if (resolved.state === "linked" && resolved.linkedConceptId) {
      next.linkedConceptId = resolved.linkedConceptId;
    }
    return next;
  });

/** ZIP インポート後: 存在しない Concept を指す参照を外す */
export const stripInvalidQuizReferences = (
  q: QuizQuestion,
  validConceptIds: Set<string>
): QuizQuestion => {
  const conceptId =
    q.conceptId !== undefined && q.conceptId !== "" && validConceptIds.has(q.conceptId)
      ? q.conceptId
      : undefined;

  const choices: QuizChoice[] = q.choices.map((c) => {
    const base: QuizChoice = { id: c.id, text: c.text };
    if (
      c.linkedConceptId &&
      c.linkedConceptId.trim() &&
      validConceptIds.has(c.linkedConceptId.trim())
    ) {
      base.linkedConceptId = c.linkedConceptId.trim();
    }
    return base;
  });

  return { ...q, conceptId, choices };
};
