import type { Concept } from "../types/concept";
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
import { escapeRegExp, maskConceptNameInText } from "./maskConceptNameInText";
import { normalizeConceptTitle } from "./normalizeConceptTitle";
import {
  buildQuizQuestionDuplicateKey,
  collectExistingDuplicateKeys,
  isDuplicateQuizQuestion
} from "./quizQuestionSource";
import { extractImportantTerms } from "./syncImportantTermsToConcepts";

const DISTRACTOR_COUNT = 3;
const MASK_REPLACEMENT = "（　　　）";

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

/** 定義の由来（文脈別定義 / 通常定義 / 定義なし） */
export type ContextCardDefinitionSource = "context" | "general" | "none";

export type ContextCardTermCandidate = {
  term: string;
  normalizedTerm: string;
  /** 重要語句に対応する概念（未登録の場合は undefined） */
  concept?: Concept;
};

export type ContextCardQuizDraft = {
  question: QuizQuestion;
  term: string;
  conceptTitle: string;
  quality: QuizGenerationQuality;
  definitionSource: ContextCardDefinitionSource;
  warnings: string[];
};

export type ContextCardQuizGenerationPreview = {
  contextCardId: string;
  contextCardTitle: string;
  fieldName?: string;
  /** 文脈カードに登録された重要語句の数（作成予定の問題数） */
  plannedTermCount: number;
  questions: ContextCardQuizDraft[];
  usedTerms: string[];
  emptyStateMessage?: string;
};

/**
 * 文脈カードの重要語句一覧を取得する。
 * 各語句に対応する概念があれば紐づけるが、概念が無い語句も候補に含める。
 */
export function collectContextCardTermCandidates(
  card: ContextCard,
  allConcepts: Concept[]
): ContextCardTermCandidate[] {
  const conceptByTitle = buildConceptByTitleMap(allConcepts);
  const terms = extractImportantTerms(card.keyConcepts);
  const seen = new Set<string>();
  const out: ContextCardTermCandidate[] = [];

  for (const term of terms) {
    const normalizedTerm = normalizeConceptTitle(term);
    if (!normalizedTerm || seen.has(normalizedTerm)) {
      continue;
    }
    seen.add(normalizedTerm);
    out.push({ term, normalizedTerm, concept: conceptByTitle.get(normalizedTerm) });
  }

  return out;
}

/** 概念から、問題文に使う定義を決める（文脈別定義を優先し、無ければ通常定義） */
function resolveDefinitionForConcept(
  concept: Concept | undefined
): { text: string; source: ContextCardDefinitionSource } {
  if (!concept) {
    return { text: "", source: "none" };
  }
  const contextDefinition = (concept.contextDefinitions ?? []).find(
    (item) => item.definition.trim().length > 0
  );
  if (contextDefinition) {
    return { text: contextDefinition.definition.trim(), source: "context" };
  }
  const general = concept.definition.trim();
  if (general) {
    return { text: general, source: "general" };
  }
  return { text: "", source: "none" };
}

/** 定義文から「〜を何というか。」形式の問題文を組み立てる（正解語句はマスク） */
function buildDefinitionPrompt(definition: string, term: string): string {
  let text = maskConceptNameInText(definition.trim(), [term], MASK_REPLACEMENT);
  const leadingPattern = new RegExp(
    `^(?:${escapeRegExp(MASK_REPLACEMENT)})\\s*(?:とは|は|とは、|、)?\\s*[:：]?\\s*`,
    "u"
  );
  text = text.replace(leadingPattern, "").trim();
  text = text.replace(/[。．.!！?？、]+$/u, "").trim();
  if (!text) {
    return `この文脈における重要語句を何というか。`;
  }
  return `${text}を何というか。`;
}

/** 定義が無いときの用語確認問題の問題文 */
function buildRecognitionPrompt(term: string): string {
  return `この文脈で扱う重要語句「${term}」を選びなさい。`;
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

type DistractorTerm = {
  term: string;
  strategy: Extract<QuizChoiceSourceStrategy, "same-context" | "same-domain" | "random">;
};

/**
 * 誤答用の語句候補を集める。
 * 同じ文脈カードの他の重要語句を最優先し、不足時は同分野・その他の概念名で補う。
 */
function collectDistractorTerms(
  targetNormalized: string,
  sameCardTerms: string[],
  card: ContextCard,
  allConcepts: Concept[]
): DistractorTerm[] {
  const used = new Set<string>([targetNormalized]);
  const out: DistractorTerm[] = [];

  const add = (raw: string, strategy: DistractorTerm["strategy"]) => {
    const term = raw.trim();
    const normalized = normalizeConceptTitle(term);
    if (!normalized || used.has(normalized)) {
      return;
    }
    used.add(normalized);
    out.push({ term, strategy });
  };

  for (const term of sameCardTerms) {
    add(term, "same-context");
  }

  const cardTags = new Set(
    (card.domainTags ?? []).map((tag) => tag.trim()).filter(Boolean)
  );
  if (cardTags.size > 0) {
    for (const concept of allConcepts) {
      if ((concept.domainTags ?? []).some((tag) => cardTags.has(tag.trim()))) {
        add(concept.title, "same-domain");
      }
    }
  }

  for (const concept of shuffleArray(allConcepts)) {
    add(concept.title, "random");
  }

  return out;
}

function determineQuality(distractors: DistractorTerm[]): QuizGenerationQuality {
  if (distractors.length === 0) {
    return "failed";
  }
  if (distractors.length < DISTRACTOR_COUNT) {
    return "low";
  }
  if (distractors.every((item) => item.strategy === "same-context")) {
    return "high";
  }
  if (distractors.some((item) => item.strategy === "same-domain")) {
    return "medium";
  }
  return "low";
}

function buildQuestionForTerm(
  card: ContextCard,
  candidate: ContextCardTermCandidate,
  sameCardTerms: string[],
  allConcepts: Concept[],
  existingDuplicateKeys: Set<string>
): ContextCardQuizDraft | null {
  const source = buildContextCardSource(card);
  const answerConceptId = candidate.concept?.id;

  if (
    isDuplicateQuizQuestion(
      source,
      answerConceptId,
      candidate.normalizedTerm,
      existingDuplicateKeys
    )
  ) {
    return null;
  }

  const { text: definition, source: definitionSource } = resolveDefinitionForConcept(
    candidate.concept
  );
  const prompt =
    definitionSource === "none"
      ? buildRecognitionPrompt(candidate.term)
      : buildDefinitionPrompt(definition, candidate.term);

  const distractors = collectDistractorTerms(
    candidate.normalizedTerm,
    sameCardTerms,
    card,
    allConcepts
  ).slice(0, DISTRACTOR_COUNT);

  const conceptByTitle = buildConceptByTitleMap(allConcepts);
  const correctChoiceId = createChoiceId();
  const correctChoice: QuizChoice = {
    id: correctChoiceId,
    text: candidate.term,
    ...(candidate.concept
      ? { linkedConceptId: candidate.concept.id, sourceConceptId: candidate.concept.id }
      : {}),
    sourceStrategy: "correct"
  };

  const distractorChoices: QuizChoice[] = distractors.map((item) => {
    const linked = conceptByTitle.get(normalizeConceptTitle(item.term));
    return {
      id: createChoiceId(),
      text: item.term,
      ...(linked ? { linkedConceptId: linked.id, sourceConceptId: linked.id } : {}),
      sourceStrategy: item.strategy
    };
  });

  const choices = shuffleArray([correctChoice, ...distractorChoices]);
  const quality = determineQuality(distractors);

  const warnings: string[] = [];
  if (definitionSource === "none") {
    warnings.push(
      "定義が未登録のため、用語確認問題として作成しました。定義を追加すると、説明形式の問題になります。"
    );
  }
  if (!candidate.concept) {
    warnings.push("この重要語句に対応する概念が未登録です。概念を登録すると関連づけできます。");
  }
  if (distractors.length === 0) {
    warnings.push("誤答の選択肢が不足しています。手動で追加してください。");
  } else if (distractors.length < DISTRACTOR_COUNT) {
    warnings.push("誤答の選択肢が少ないため、手動で追加してください。");
  }

  const now = nowIso();
  const question: QuizQuestion = {
    id: createQuizQuestionId(),
    ...(candidate.concept ? { conceptId: candidate.concept.id } : {}),
    source,
    prompt,
    choices,
    correctChoiceId,
    visibility: "private",
    schemaVersion: QUIZ_QUESTION_SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now
  };

  existingDuplicateKeys.add(
    buildQuizQuestionDuplicateKey(source, answerConceptId, candidate.normalizedTerm)
  );

  return {
    question,
    term: candidate.term,
    conceptTitle: candidate.concept?.title ?? candidate.term,
    quality,
    definitionSource,
    warnings
  };
}

/**
 * 文脈カードに登録された重要語句から、重要語句ごとに1問ずつクイズを生成する。
 * 本文は不要。重要語句が1つ以上あれば生成可能。
 */
export function generateQuizSetFromContextCard(input: {
  contextCard: ContextCard;
  allConcepts: Concept[];
  existingQuestions: QuizQuestion[];
}): ContextCardQuizGenerationPreview {
  const { contextCard, allConcepts, existingQuestions } = input;
  const fieldName = contextCard.domainTags[0]?.trim() || contextCard.domain?.trim();
  const candidates = collectContextCardTermCandidates(contextCard, allConcepts);

  if (candidates.length === 0) {
    return {
      contextCardId: contextCard.id,
      contextCardTitle: contextCard.title,
      fieldName,
      plannedTermCount: 0,
      questions: [],
      usedTerms: [],
      emptyStateMessage:
        "この文脈カードには重要語句が登録されていません。\n重要語句を追加すると、クイズを作成できます。"
    };
  }

  const sameCardTerms = candidates.map((candidate) => candidate.term);
  const existingDuplicateKeys = collectExistingDuplicateKeys(existingQuestions);
  const questions: ContextCardQuizDraft[] = [];
  const usedTerms: string[] = [];

  for (const candidate of candidates) {
    const draft = buildQuestionForTerm(
      contextCard,
      candidate,
      sameCardTerms,
      allConcepts,
      existingDuplicateKeys
    );
    if (draft) {
      questions.push(draft);
      usedTerms.push(candidate.term);
    }
  }

  if (questions.length === 0) {
    return {
      contextCardId: contextCard.id,
      contextCardTitle: contextCard.title,
      fieldName,
      plannedTermCount: candidates.length,
      questions: [],
      usedTerms: [],
      emptyStateMessage: "この文脈カードから作成できる新しいクイズはありません。"
    };
  }

  return {
    contextCardId: contextCard.id,
    contextCardTitle: contextCard.title,
    fieldName,
    plannedTermCount: candidates.length,
    questions,
    usedTerms
  };
}
