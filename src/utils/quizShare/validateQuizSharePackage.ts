import { z } from "zod";
import {
  QUIZ_DECK_SCHEMA_VERSION,
  QUIZ_QUESTION_SCHEMA_VERSION,
  type QuizDeck,
  type QuizQuestion
} from "../../types/quiz";
import {
  QUIZ_SHARE_FORMAT,
  QUIZ_SHARE_VERSION,
  SUPPORTED_QUIZ_SHARE_VERSIONS,
  type QuizShareConceptRef,
  type QuizSharePackage
} from "../../types/quizShare";
import { quizDeckSchema, quizQuestionSchema } from "../conceptImportValidation";

/**
 * 共有 package version 1 が受理する Question / Deck の schemaVersion。
 * QuizSharePackage.version とは別概念。
 * バックアップ Import のような欠落補完はしない。現在の canonical version のみ受理する。
 * 将来の migration では、解釈可能な version をこの配列へ追加する。
 */
export const SUPPORTED_QUIZ_QUESTION_SCHEMA_VERSIONS = [QUIZ_QUESTION_SCHEMA_VERSION] as const;
export const SUPPORTED_QUIZ_DECK_SCHEMA_VERSIONS = [QUIZ_DECK_SCHEMA_VERSION] as const;

export type QuizShareValidationErrorCode =
  | "invalid-root"
  | "invalid-format"
  | "unsupported-version"
  | "invalid-exported-at"
  | "invalid-deck"
  | "invalid-question"
  | "duplicate-question-id"
  | "duplicate-choice-id"
  | "duplicate-deck-question-id"
  | "missing-question"
  | "orphan-question"
  | "invalid-concept-ref"
  | "missing-concept-ref"
  | "unused-concept-ref";

export type QuizShareValidationResult =
  | {
      ok: true;
      data: QuizSharePackage;
    }
  | {
      ok: false;
      code: QuizShareValidationErrorCode;
      reason: string;
    };

const fail = (
  code: QuizShareValidationErrorCode,
  reason: string
): QuizShareValidationResult => ({ ok: false, code, reason });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isSupportedShareVersion = (
  version: number
): version is (typeof SUPPORTED_QUIZ_SHARE_VERSIONS)[number] =>
  (SUPPORTED_QUIZ_SHARE_VERSIONS as readonly number[]).includes(version);

const conceptRefSchema = z.object({
  sourceId: z.string().min(1),
  title: z.string().min(1)
});

const isSupportedQuestionSchemaVersion = (version: number): boolean =>
  (SUPPORTED_QUIZ_QUESTION_SCHEMA_VERSIONS as readonly number[]).includes(version);

const isSupportedDeckSchemaVersion = (version: number): boolean =>
  (SUPPORTED_QUIZ_DECK_SCHEMA_VERSIONS as readonly number[]).includes(version);

const collectReferencedConceptIds = (questions: QuizQuestion[]): string[] => {
  const ids: string[] = [];
  for (const question of questions) {
    if (question.conceptId) {
      ids.push(question.conceptId);
    }
    for (const choice of question.choices) {
      if (choice.linkedConceptId) {
        ids.push(choice.linkedConceptId);
      }
      if (choice.sourceConceptId) {
        ids.push(choice.sourceConceptId);
      }
    }
  }
  return ids;
};

const hasDuplicateChoiceId = (question: QuizQuestion): boolean => {
  const ids = question.choices.map((choice) => choice.id);
  return new Set(ids).size !== ids.length;
};

/**
 * unknown をクイズ共有 package として検証する。
 * 値の補完・重複除去・現在時刻への置換は行わない。canonical でない入力は拒否する。
 */
export const validateQuizSharePackage = (input: unknown): QuizShareValidationResult => {
  if (!isRecord(input)) {
    return fail("invalid-root", "クイズ共有データはオブジェクトである必要があります");
  }

  if (input.format !== QUIZ_SHARE_FORMAT) {
    return fail(
      "invalid-format",
      "クイズ共有フォーマットではありません。conceptbook-quiz-share のみ受け付けます"
    );
  }

  if (typeof input.version !== "number" || !isSupportedShareVersion(input.version)) {
    return fail("unsupported-version", "未対応のクイズ共有フォーマットです");
  }

  if (typeof input.exportedAt !== "string" || Number.isNaN(Date.parse(input.exportedAt))) {
    return fail("invalid-exported-at", "exportedAt は ISO 8601 として解釈できる日時である必要があります");
  }

  const deckResult = quizDeckSchema.safeParse(input.deck);
  if (!deckResult.success || !isSupportedDeckSchemaVersion(deckResult.data.schemaVersion)) {
    return fail("invalid-deck", "QuizDeck が共有形式の必須項目を満たしていません");
  }
  const deck: QuizDeck = deckResult.data;
  if (deck.questionIds.some((id) => id.trim() === "")) {
    return fail("invalid-deck", "deck.questionIds に空の Question ID があります");
  }

  if (!Array.isArray(input.questions)) {
    return fail("invalid-question", "questions は配列である必要があります");
  }

  const questions: QuizQuestion[] = [];
  for (const item of input.questions) {
    const parsed = quizQuestionSchema.safeParse(item);
    if (!parsed.success || !isSupportedQuestionSchemaVersion(parsed.data.schemaVersion)) {
      return fail("invalid-question", "QuizQuestion が共有形式の必須項目を満たしていません");
    }
    if (hasDuplicateChoiceId(parsed.data)) {
      return fail("duplicate-choice-id", "同一 Question 内で Choice ID が重複しています");
    }
    questions.push(parsed.data);
  }

  const questionIds = questions.map((question) => question.id);
  if (new Set(questionIds).size !== questionIds.length) {
    return fail("duplicate-question-id", "questions 内で Question ID が重複しています");
  }

  const deckQuestionIds = deck.questionIds;
  if (new Set(deckQuestionIds).size !== deckQuestionIds.length) {
    return fail("duplicate-deck-question-id", "deck.questionIds に同じ Question ID が複数あります");
  }

  const questionIdSet = new Set(questionIds);
  const deckIdSet = new Set(deckQuestionIds);
  if (deckQuestionIds.some((id) => !questionIdSet.has(id))) {
    return fail("missing-question", "deck.questionIds が指す Question が package にありません");
  }
  if (questionIds.some((id) => !deckIdSet.has(id))) {
    return fail("orphan-question", "questions に Deck から参照されていない Question があります");
  }

  if (!Array.isArray(input.conceptRefs)) {
    return fail("invalid-concept-ref", "conceptRefs は配列である必要があります");
  }

  const conceptRefs: QuizShareConceptRef[] = [];
  for (const item of input.conceptRefs) {
    const parsed = conceptRefSchema.safeParse(item);
    if (!parsed.success) {
      return fail("invalid-concept-ref", "ConceptRef には空でない sourceId と title が必要です");
    }
    conceptRefs.push(parsed.data);
  }

  const sourceIds = conceptRefs.map((ref) => ref.sourceId);
  if (new Set(sourceIds).size !== sourceIds.length) {
    return fail("invalid-concept-ref", "conceptRefs 内で sourceId が重複しています");
  }

  const referenced = collectReferencedConceptIds(questions);
  const referencedSet = new Set(referenced);
  const sourceIdSet = new Set(sourceIds);
  if ([...referencedSet].some((id) => !sourceIdSet.has(id))) {
    return fail(
      "missing-concept-ref",
      "Question または Choice が参照する Concept の ConceptRef がありません"
    );
  }
  if (sourceIds.some((id) => !referencedSet.has(id))) {
    return fail("unused-concept-ref", "package 内で使われていない ConceptRef があります");
  }

  return {
    ok: true,
    data: {
      format: QUIZ_SHARE_FORMAT,
      version: QUIZ_SHARE_VERSION,
      exportedAt: input.exportedAt,
      deck,
      questions,
      conceptRefs
    }
  };
};
