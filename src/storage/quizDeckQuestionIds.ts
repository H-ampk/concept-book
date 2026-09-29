/**
 * QuizDeck.questionIds の membership 操作。
 * UI が保持している古い配列をそのまま保存せず、最新の配列に intent を適用する。
 */

export class QuizDeckMembershipConflictError extends Error {
  readonly code = "QUIZ_DECK_MEMBERSHIP_CONFLICT" as const;

  constructor(
    message = "クイズ集の問題順が別の更新と競合しました。最新の内容を読み込み直してください。"
  ) {
    super(message);
    this.name = "QuizDeckMembershipConflictError";
  }
}

export const isQuizDeckMembershipConflict = (error: unknown): boolean =>
  error instanceof QuizDeckMembershipConflictError ||
  (error instanceof Error && error.name === "QuizDeckMembershipConflictError");

export const normalizeQuestionIdList = (ids: readonly string[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    const trimmed = id.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
};

/** 既存順を保ったまま、未所属の ID だけを末尾へ追加する。 */
export const appendQuestionIds = (current: readonly string[], add: readonly string[]): string[] => {
  const base = normalizeQuestionIdList(current);
  const seen = new Set(base);
  const next = [...base];
  for (const id of normalizeQuestionIdList(add)) {
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    next.push(id);
  }
  return next;
};

/** 指定 ID だけを外す。並び順は残った ID の相対順を維持する。 */
export const removeQuestionIds = (current: readonly string[], remove: readonly string[]): string[] => {
  const drop = new Set(normalizeQuestionIdList(remove));
  return normalizeQuestionIdList(current).filter((id) => !drop.has(id));
};

export const questionIdSequencesEqual = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((id, index) => id === right[index]);

export const questionIdMembershipEqual = (left: readonly string[], right: readonly string[]): boolean => {
  if (left.length !== right.length) {
    return false;
  }
  const ids = new Set(left);
  return right.every((id) => ids.has(id));
};

export type QuizDeckReorderPlan =
  | { ok: true; questionIds: string[] }
  | { ok: false; reason: "conflict" | "membership-changed" };

/**
 * 並び替えは expected が current と完全一致するときだけ適用する。
 * 集合の union や last-write-wins では、並行追加された問題の位置を決められない。
 * next が membership を増減させる場合は並び替えとして拒否する。
 */
export const planQuizDeckReorder = (
  current: readonly string[],
  expected: readonly string[],
  next: readonly string[]
): QuizDeckReorderPlan => {
  const currentIds = normalizeQuestionIdList(current);
  const expectedIds = normalizeQuestionIdList(expected);
  const nextIds = normalizeQuestionIdList(next);
  if (!questionIdSequencesEqual(currentIds, expectedIds)) {
    return { ok: false, reason: "conflict" };
  }
  if (!questionIdMembershipEqual(currentIds, nextIds)) {
    return { ok: false, reason: "membership-changed" };
  }
  return { ok: true, questionIds: nextIds };
};
