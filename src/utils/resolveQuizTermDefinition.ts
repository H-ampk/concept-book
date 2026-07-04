import type { Concept } from "../types/concept";
import type { QuizChoice, QuizQuestionSource } from "../types/quiz";
import { normalizeConceptTitle } from "./normalizeConceptTitle";
import { parseContextualCardSourceId } from "./quizQuestionSource";

/** 語句の定義解決結果の状態 */
export type QuizTermDefinitionStatus =
  | "context" // 文脈別定義を使用
  | "general" // 通常定義を使用
  | "no-definition" // 概念はあるが定義が未登録
  | "no-concept"; // 対応する概念カードが未登録

export type QuizTermDefinition = {
  /** 語句名（選択肢テキスト） */
  term: string;
  /** 対応する概念（見つからない場合は undefined） */
  concept?: Concept;
  /** 定義本文（未登録時は空文字） */
  definition: string;
  status: QuizTermDefinitionStatus;
};

/** 選択肢に対応する概念を探す（linkedConceptId 優先、無ければ正規化タイトル一致） */
export function findConceptForQuizChoice(
  choice: Pick<QuizChoice, "text" | "linkedConceptId">,
  concepts: Concept[]
): Concept | undefined {
  const linkedId = choice.linkedConceptId?.trim();
  if (linkedId) {
    const byId = concepts.find((concept) => concept.id === linkedId);
    if (byId) {
      return byId;
    }
  }
  const key = normalizeConceptTitle(choice.text);
  if (!key) {
    return undefined;
  }
  return concepts.find((concept) => normalizeConceptTitle(concept.title) === key);
}

/**
 * 概念と出題元から、表示に使う文脈別定義本文を決める。
 * 出題元に対応する定義を優先し、見つからなければ最初の非空文脈別定義を返す。
 */
function pickContextDefinition(
  concept: Concept,
  source?: QuizQuestionSource
): string | null {
  const definitions = (concept.contextDefinitions ?? []).filter(
    (item) => item.definition.trim().length > 0
  );
  if (definitions.length === 0) {
    return null;
  }

  if (source?.type === "contextualConceptCard") {
    const parsed = parseContextualCardSourceId(source.sourceId);
    if (parsed && parsed.conceptId === concept.id) {
      const matched = definitions.find((item) => item.id === parsed.contextDefinitionId);
      if (matched) {
        return matched.definition.trim();
      }
    }
  }

  const hints = [source?.fieldName, source?.sourceTitle]
    .map((hint) => (hint ? normalizeConceptTitle(hint) : ""))
    .filter(Boolean);
  if (hints.length > 0) {
    const matched = definitions.find((item) =>
      hints.includes(normalizeConceptTitle(item.context))
    );
    if (matched) {
      return matched.definition.trim();
    }
  }

  return definitions[0].definition.trim();
}

/**
 * 選択肢の語句について、表示する定義を解決する。
 * 優先順位: 出題元に対応する文脈別定義 → 通常定義 → 定義未登録。
 * 概念が見つからない場合は no-concept を返す。
 */
export function resolveQuizTermDefinition(
  choice: Pick<QuizChoice, "text" | "linkedConceptId">,
  concepts: Concept[],
  source?: QuizQuestionSource
): QuizTermDefinition {
  const term = choice.text.trim();
  const concept = findConceptForQuizChoice(choice, concepts);

  if (!concept) {
    return { term, definition: "", status: "no-concept" };
  }

  const contextDefinition = pickContextDefinition(concept, source);
  if (contextDefinition) {
    return { term, concept, definition: contextDefinition, status: "context" };
  }

  const general = concept.definition.trim();
  if (general) {
    return { term, concept, definition: general, status: "general" };
  }

  return { term, concept, definition: "", status: "no-definition" };
}
