import type { Concept } from "../types/concept";
import type { ContextCard } from "../types/contextCard";
import type { QuizGenerationQuality, QuizQuestion, QuizQuestionSource } from "../types/quiz";
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

const MIN_TERM_LENGTH = 2;
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

export type ContextCardTermCandidate = {
  term: string;
  concept: Concept;
  normalizedTerm: string;
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
  emptyStateMessage?: string;
};

export function getContextCardBodyText(card: ContextCard): string {
  return [card.centralQuestion, card.background, card.flow]
    .map((part) => part.trim())
    .filter(Boolean)
    .join("\n");
}

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
    if (!normalizedTerm || normalizedTerm.length < MIN_TERM_LENGTH || seen.has(normalizedTerm)) {
      continue;
    }
    const concept = conceptByTitle.get(normalizedTerm);
    if (!concept) {
      continue;
    }
    seen.add(normalizedTerm);
    out.push({ term, concept, normalizedTerm });
  }

  return out;
}

function termAppearsInBody(body: string, term: string): boolean {
  if (!body.trim() || !term.trim()) {
    return false;
  }
  if (body.includes(term)) {
    return true;
  }
  const normalizedBody = normalizeConceptTitle(body);
  const normalizedTerm = normalizeConceptTitle(term);
  return normalizedBody.includes(normalizedTerm);
}

function findSentenceContainingTerm(body: string, term: string): string | null {
  const sentences = body.split(/(?<=[。！？\n])/);
  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) {
      continue;
    }
    if (termAppearsInBody(trimmed, term)) {
      return trimmed;
    }
  }
  if (termAppearsInBody(body, term)) {
    return body.trim();
  }
  return null;
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

function buildQuestionFromTerm(
  card: ContextCard,
  candidate: ContextCardTermCandidate,
  allCandidates: ContextCardTermCandidate[],
  existingDuplicateKeys: Set<string>
): ContextCardQuizDraft | null {
  const body = getContextCardBodyText(card);
  const sentence = findSentenceContainingTerm(body, candidate.term);
  if (!sentence) {
    return null;
  }

  const source = buildContextCardSource(card);
  if (
    isDuplicateQuizQuestion(
      source,
      candidate.concept.id,
      candidate.normalizedTerm,
      existingDuplicateKeys
    )
  ) {
    return null;
  }

  const prompt = maskConceptNameInText(sentence, [candidate.term], MASK_REPLACEMENT);
  if (!prompt.includes(MASK_REPLACEMENT)) {
    return null;
  }

  const distractorTerms = allCandidates
    .filter((item) => item.normalizedTerm !== candidate.normalizedTerm)
    .map((item) => item.term);

  const shuffledDistractors = shuffleArray(distractorTerms).slice(0, DISTRACTOR_COUNT);
  const choiceTexts = shuffleArray([candidate.term, ...shuffledDistractors]);

  if (choiceTexts.length < 2) {
    return null;
  }

  const correctChoiceId = createChoiceId();
  const choices = choiceTexts.map((text) => {
    const isCorrect = normalizeConceptTitle(text) === candidate.normalizedTerm;
    const choiceId = isCorrect ? correctChoiceId : createChoiceId();
    const matched = allCandidates.find(
      (item) => normalizeConceptTitle(text) === item.normalizedTerm
    );
    return {
      id: choiceId,
      text,
      ...(matched ? { linkedConceptId: matched.concept.id, sourceConceptId: matched.concept.id } : {}),
      sourceStrategy: isCorrect ? ("correct" as const) : ("random" as const)
    };
  });

  const resolvedCorrectId =
    choices.find((c) => normalizeConceptTitle(c.text) === candidate.normalizedTerm)?.id ??
    correctChoiceId;

  const quality: QuizGenerationQuality =
    choices.length >= 4 ? "high" : choices.length >= 3 ? "medium" : "low";

  const now = nowIso();
  const question: QuizQuestion = {
    id: createQuizQuestionId(),
    conceptId: candidate.concept.id,
    source,
    prompt,
    choices,
    correctChoiceId: resolvedCorrectId,
    visibility: "private",
    schemaVersion: QUIZ_QUESTION_SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now
  };

  existingDuplicateKeys.add(
    buildQuizQuestionDuplicateKey(source, candidate.concept.id, candidate.normalizedTerm)
  );

  return {
    question,
    term: candidate.term,
    conceptTitle: candidate.concept.title,
    quality,
    warnings: choices.length < 4 ? ["選択肢が不足しているため、手動で追加してください。"] : []
  };
}

export function generateQuizSetFromContextCard(input: {
  contextCard: ContextCard;
  allConcepts: Concept[];
  existingQuestions: QuizQuestion[];
}): ContextCardQuizGenerationPreview {
  const { contextCard, allConcepts, existingQuestions } = input;
  const body = getContextCardBodyText(contextCard);
  const fieldName = contextCard.domainTags[0]?.trim() || contextCard.domain?.trim();

  if (!body) {
    return {
      contextCardId: contextCard.id,
      contextCardTitle: contextCard.title,
      fieldName,
      questions: [],
      usedTerms: [],
      emptyStateMessage: "この文脈カードには本文がありません。\n本文を追加すると、クイズを作成できます。"
    };
  }

  const candidates = collectContextCardTermCandidates(contextCard, allConcepts);
  if (candidates.length === 0) {
    return {
      contextCardId: contextCard.id,
      contextCardTitle: contextCard.title,
      fieldName,
      questions: [],
      usedTerms: [],
      emptyStateMessage:
        "この文脈カードには、クイズにできる重要語句がありません。\n先に重要語句を登録してください。"
    };
  }

  const inBodyCandidates = candidates.filter((c) => termAppearsInBody(body, c.term));
  if (inBodyCandidates.length === 0) {
    const missingConcepts = candidates.length < extractImportantTerms(contextCard.keyConcepts).length;
    return {
      contextCardId: contextCard.id,
      contextCardTitle: contextCard.title,
      fieldName,
      questions: [],
      usedTerms: [],
      emptyStateMessage: missingConcepts
        ? "クイズ化できる概念が不足しています。\n重要語句を概念として登録すると、クイズを作成できます。"
        : "この文脈カードには、クイズにできる重要語句がありません。\n先に重要語句を登録してください。"
    };
  }

  const existingDuplicateKeys = collectExistingDuplicateKeys(existingQuestions);
  const questions: ContextCardQuizDraft[] = [];
  const usedTerms: string[] = [];

  for (const candidate of inBodyCandidates) {
    const draft = buildQuestionFromTerm(
      contextCard,
      candidate,
      inBodyCandidates,
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
      questions: [],
      usedTerms: [],
      emptyStateMessage: "この文脈カードから作成できる新しいクイズはありません。"
    };
  }

  return {
    contextCardId: contextCard.id,
    contextCardTitle: contextCard.title,
    fieldName,
    questions,
    usedTerms
  };
}
