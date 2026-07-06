import type { Concept, ContextDefinition } from "../types/concept";
import type { ContextCard } from "../types/contextCard";
import type {
  QuizChoice,
  QuizChoiceSourceStrategy,
  QuizGenerationQuality,
  QuizQuestion,
  QuizQuestionSource
} from "../types/quiz";
import { QUIZ_QUESTION_SCHEMA_VERSION } from "../types/quiz";
import { buildConceptByTitleMap } from "./conceptLookupMaps";
import { nowIso } from "./date";
import { maskConceptNameInText } from "./maskConceptNameInText";
import { normalizeConceptTitle } from "./normalizeConceptTitle";
import {
  buildQuizQuestionDuplicateKey,
  collectExistingDuplicateKeys,
  isDuplicateQuizQuestion
} from "./quizQuestionSource";
import { extractImportantTerms } from "./syncImportantTermsToConcepts";

/** 1問あたりの誤答選択肢数（正解を含め4択にする） */
const DISTRACTOR_COUNT = 3;

const createQuizQuestionId = (): string =>
  `quiz_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

const createChoiceId = (): string =>
  `choice_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const shuffleArray = <T>(items: T[]): T[] => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

/** 除外理由 */
export type ContextCardExclusionReason =
  | "no-context-definition" // 文脈別定義なし
  | "no-concept" // 概念カード未登録
  | "insufficient-choices"; // 選択肢不足

export type ContextCardExcludedTerm = {
  term: string;
  reason: ContextCardExclusionReason;
};

/** 文脈別定義を持つ出題候補 */
type ContextCardCandidate = {
  term: string;
  normalizedTerm: string;
  concept: Concept;
  contextDefinition: ContextDefinition;
};

export type ContextCardQuizDraft = {
  question: QuizQuestion;
  term: string;
  conceptTitle: string;
  quality: QuizGenerationQuality;
  warnings: string[];
};

export type ContextCardQuizGenerationPreview = {
  contextCardId: string;
  contextCardTitle: string;
  fieldName?: string;
  questions: ContextCardQuizDraft[];
  usedTerms: string[];
  excludedTerms: ContextCardExcludedTerm[];
  emptyStateMessage?: string;
};

/**
 * 概念の文脈別定義のうち、選択中の文脈カードに対応するものを選ぶ。
 * カードのタイトル・分野・分野タグと context 文字列が一致すればそれを優先し、
 * 一致が無ければ最初の非空文脈別定義を使う。定義がなければ null。
 */
function pickCardContextDefinition(
  concept: Concept,
  card: ContextCard
): ContextDefinition | null {
  const definitions = (concept.contextDefinitions ?? []).filter(
    (item) => item.definition.trim().length > 0
  );
  if (definitions.length === 0) {
    return null;
  }

  const hints = new Set(
    [card.title, card.domain, ...(card.domainTags ?? [])]
      .map((hint) => (hint ? normalizeConceptTitle(hint) : ""))
      .filter(Boolean)
  );
  if (hints.size > 0) {
    const matched = definitions.find((item) =>
      hints.has(normalizeConceptTitle(item.context))
    );
    if (matched) {
      return matched;
    }
  }

  return definitions[0];
}

function buildContextCardSource(card: ContextCard): QuizQuestionSource {
  const fieldName = card.domainTags[0]?.trim() || card.domain?.trim();
  return {
    type: "contextCard",
    sourceId: card.id,
    sourceTitle: card.title,
    ...(fieldName ? { fieldName } : {})
  };
}

/** 文脈別定義本文から、対象概念名を （＿＿） でマスクした問題文を作る */
function buildMaskedPromptText(definition: string, conceptTitle: string): string {
  return maskConceptNameInText(definition.trim(), [conceptTitle]);
}

/** 概念名のみの選択肢を作る */
function buildWordChoiceFromConcept(
  concept: Concept,
  contextDefinition: ContextDefinition | undefined,
  isCorrect: boolean,
  strategy: QuizChoiceSourceStrategy
): QuizChoice {
  return {
    id: createChoiceId(),
    text: concept.title,
    linkedConceptId: concept.id,
    sourceConceptId: concept.id,
    ...(contextDefinition ? { contextDefinitionId: contextDefinition.id } : {}),
    sourceStrategy: isCorrect ? "correct" : strategy
  };
}

/**
 * 同じ分野で文脈別定義を持つ概念から、誤答補充用の候補を集める。
 * 出題対象カード内の概念・出題対象概念は除外する。
 */
function collectSameDomainDistractors(
  card: ContextCard,
  allConcepts: Concept[],
  excludeConceptIds: Set<string>
): Array<{ concept: Concept; contextDefinition: ContextDefinition }> {
  const cardTags = new Set(
    (card.domainTags ?? []).map((tag) => tag.trim()).filter(Boolean)
  );
  if (cardTags.size === 0) {
    return [];
  }

  const out: Array<{ concept: Concept; contextDefinition: ContextDefinition }> = [];
  for (const concept of shuffleArray(allConcepts)) {
    if (excludeConceptIds.has(concept.id)) {
      continue;
    }
    if (!(concept.domainTags ?? []).some((tag) => cardTags.has(tag.trim()))) {
      continue;
    }
    const contextDefinition = pickCardContextDefinition(concept, card);
    if (contextDefinition) {
      out.push({ concept, contextDefinition });
    }
  }
  return out;
}

function buildQuestionForCandidate(
  card: ContextCard,
  target: ContextCardCandidate,
  cardCandidates: ContextCardCandidate[],
  allConcepts: Concept[],
  existingDuplicateKeys: Set<string>
): { draft: ContextCardQuizDraft } | { failed: ContextCardExclusionReason } | { skip: true } {
  const source = buildContextCardSource(card);
  if (
    isDuplicateQuizQuestion(
      source,
      target.concept.id,
      target.normalizedTerm,
      existingDuplicateKeys
    )
  ) {
    // 既に同じ文脈カード×概念のクイズが存在する場合は重複作成しない（除外語句には数えない）
    return { skip: true };
  }

  const usedConceptIds = new Set<string>([target.concept.id]);
  const usedTerms = new Set<string>();

  const correctChoice = buildWordChoiceFromConcept(
    target.concept,
    target.contextDefinition,
    true,
    "correct"
  );
  usedTerms.add(normalizeConceptTitle(correctChoice.text));

  const distractorChoices: QuizChoice[] = [];

  const addDistractor = (
    concept: Concept,
    contextDefinition: ContextDefinition | undefined,
    strategy: QuizChoiceSourceStrategy
  ): boolean => {
    if (usedConceptIds.has(concept.id)) {
      return false;
    }
    const key = normalizeConceptTitle(concept.title);
    if (!key || usedTerms.has(key)) {
      return false;
    }
    usedConceptIds.add(concept.id);
    usedTerms.add(key);
    distractorChoices.push(
      buildWordChoiceFromConcept(concept, contextDefinition, false, strategy)
    );
    return true;
  };

  // 同じ文脈カード内の他の重要語句（文脈別定義ありを優先）
  for (const candidate of shuffleArray(cardCandidates)) {
    if (distractorChoices.length >= DISTRACTOR_COUNT) {
      break;
    }
    if (candidate.concept.id === target.concept.id) {
      continue;
    }
    addDistractor(candidate.concept, candidate.contextDefinition, "same-context");
  }

  // 不足時のみ、同じ分野で文脈別定義を持つ概念から補充
  if (distractorChoices.length < DISTRACTOR_COUNT) {
    const supplements = collectSameDomainDistractors(card, allConcepts, usedConceptIds);
    for (const supplement of supplements) {
      if (distractorChoices.length >= DISTRACTOR_COUNT) {
        break;
      }
      addDistractor(supplement.concept, supplement.contextDefinition, "same-domain");
    }
  }

  if (distractorChoices.length < DISTRACTOR_COUNT) {
    return { failed: "insufficient-choices" };
  }

  const choices = shuffleArray([correctChoice, ...distractorChoices]);
  const quality: QuizGenerationQuality = distractorChoices.every(
    (choice) => choice.sourceStrategy === "same-context"
  )
    ? "high"
    : "medium";

  const warnings: string[] = [];
  if (distractorChoices.some((choice) => choice.sourceStrategy === "same-domain")) {
    warnings.push("同じ文脈カード内の文脈別定義が不足したため、同じ分野の概念から補充しました。");
  }

  const now = nowIso();
  const question: QuizQuestion = {
    id: createQuizQuestionId(),
    conceptId: target.concept.id,
    source,
    prompt: buildMaskedPromptText(
      target.contextDefinition.definition,
      target.concept.title
    ),
    choices,
    correctChoiceId: correctChoice.id,
    visibility: "private",
    schemaVersion: QUIZ_QUESTION_SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now
  };

  existingDuplicateKeys.add(
    buildQuizQuestionDuplicateKey(source, target.concept.id, target.normalizedTerm)
  );

  return {
    draft: {
      question,
      term: target.term,
      conceptTitle: target.concept.title,
      quality,
      warnings
    }
  };
}

/**
 * 文脈カードの重要語句のうち「概念があり、その文脈別定義がある」語句だけを、
 * 「文脈別定義を読んで対応する概念名を選ぶ」形式のクイズにする。
 * 問題文＝マスク済み文脈別定義、選択肢＝概念名のみ。
 */
export function generateQuizSetFromContextCard(input: {
  contextCard: ContextCard;
  allConcepts: Concept[];
  existingQuestions: QuizQuestion[];
}): ContextCardQuizGenerationPreview {
  const { contextCard, allConcepts, existingQuestions } = input;
  const fieldName = contextCard.domainTags[0]?.trim() || contextCard.domain?.trim();
  const conceptByTitle = buildConceptByTitleMap(allConcepts);
  const terms = extractImportantTerms(contextCard.keyConcepts);

  const candidates: ContextCardCandidate[] = [];
  const excludedTerms: ContextCardExcludedTerm[] = [];
  const seen = new Set<string>();

  for (const term of terms) {
    const normalizedTerm = normalizeConceptTitle(term);
    if (!normalizedTerm || seen.has(normalizedTerm)) {
      continue;
    }
    seen.add(normalizedTerm);

    const concept = conceptByTitle.get(normalizedTerm);
    if (!concept) {
      excludedTerms.push({ term, reason: "no-concept" });
      continue;
    }
    const contextDefinition = pickCardContextDefinition(concept, contextCard);
    if (!contextDefinition) {
      excludedTerms.push({ term, reason: "no-context-definition" });
      continue;
    }
    candidates.push({ term, normalizedTerm, concept, contextDefinition });
  }

  if (candidates.length === 0) {
    const message =
      terms.length === 0
        ? "この文脈カードには重要語句が登録されていません。\n重要語句を追加すると、クイズを作成できます。"
        : "この文脈カードには、文脈別定義を持つ重要語句がありません。\n重要語句の概念に文脈別定義を追加すると、クイズを作成できます。";
    return {
      contextCardId: contextCard.id,
      contextCardTitle: contextCard.title,
      fieldName,
      questions: [],
      usedTerms: [],
      excludedTerms,
      emptyStateMessage: message
    };
  }

  const existingDuplicateKeys = collectExistingDuplicateKeys(existingQuestions);
  const questions: ContextCardQuizDraft[] = [];
  const usedTerms: string[] = [];

  for (const target of candidates) {
    const outcome = buildQuestionForCandidate(
      contextCard,
      target,
      candidates,
      allConcepts,
      existingDuplicateKeys
    );
    if ("skip" in outcome) {
      continue;
    }
    if ("failed" in outcome) {
      excludedTerms.push({ term: target.term, reason: outcome.failed });
      continue;
    }
    questions.push(outcome.draft);
    usedTerms.push(target.term);
  }

  if (questions.length === 0) {
    return {
      contextCardId: contextCard.id,
      contextCardTitle: contextCard.title,
      fieldName,
      questions: [],
      usedTerms: [],
      excludedTerms,
      emptyStateMessage: "この文脈カードから作成できる新しいクイズはありません。"
    };
  }

  return {
    contextCardId: contextCard.id,
    contextCardTitle: contextCard.title,
    fieldName,
    questions,
    usedTerms,
    excludedTerms
  };
}
