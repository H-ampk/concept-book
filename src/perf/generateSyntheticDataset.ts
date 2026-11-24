import type { Concept } from "../types/concept";
import type { ContextCard } from "../types/contextCard";
import type { LearningMaterial } from "../types/learningMaterial";
import {
  QUIZ_ATTEMPT_LOG_SCHEMA_VERSION,
  QUIZ_QUESTION_SCHEMA_VERSION,
  type QuizAttemptLog,
  type QuizQuestion
} from "../types/quiz";
import {
  assertSyntheticDatasetSpec,
  PERF_DELETE_TITLE,
  PERF_EDIT_TITLE,
  PERF_SEARCH_TOKEN,
  type SyntheticDatasetSpec
} from "./datasetSpec";
import { mulberry32 } from "./mulberry32";

const EPOCH = Date.UTC(2020, 0, 1);

const isoAt = (index: number): string => new Date(EPOCH + index * 1000).toISOString();

export type SyntheticAttachment = {
  material: LearningMaterial;
  byteLength: number;
  /** 先頭 64 バイト。残りは 0。ブラウザ投入時に同じ規則で Blob を作る。 */
  prefix: number[];
};

export type SyntheticDataset = {
  spec: SyntheticDatasetSpec;
  concepts: Concept[];
  contextCards: ContextCard[];
  quizQuestions: QuizQuestion[];
  quizAttemptLogs: QuizAttemptLog[];
  attachment: SyntheticAttachment | null;
  counts: {
    concepts: number;
    logs: number;
    quizzes: number;
    contexts: number;
    relatedPairs: number;
    prerequisiteEdges: number;
    relations: number;
    attachmentBytes: number;
  };
};

const conceptId = (index: number): string => `perf-c-${index}`;
const questionId = (index: number): string => `perf-q-${index}`;
const logId = (index: number): string => `perf-log-${index}`;
const contextId = (index: number): string => `perf-ctx-${index}`;

export const generateSyntheticDataset = (spec: SyntheticDatasetSpec): SyntheticDataset => {
  assertSyntheticDatasetSpec(spec);
  const random = mulberry32(spec.seed);
  const concepts: Concept[] = [];
  for (let index = 0; index < spec.conceptCount; index += 1) {
    const title =
      index === 0
        ? `${PERF_SEARCH_TOKEN} 概念`
        : index === 1 && spec.conceptCount > 1
          ? PERF_EDIT_TITLE
          : index === 2 && spec.conceptCount > 2
            ? PERF_DELETE_TITLE
            : `概念 ${index}`;
    concepts.push({
      id: conceptId(index),
      title,
      definition: index === 0 ? `${PERF_SEARCH_TOKEN} の定義` : `定義 ${index}`,
      myInterpretation: `解釈 ${index}`,
      domainTags: [`domain-${index % 8}`],
      researchTags: [`theme-${index % 5}`],
      relatedIds: [],
      prerequisiteIds: [],
      source: { book: "perf-fixture", page: String(index), author: null },
      notes: "",
      status: "active",
      favorite: index % 17 === 0,
      createdAt: isoAt(index),
      updatedAt: isoAt(index),
      contextDefinitions: []
    });
  }

  const relatedPairs = Math.floor(spec.relationCount / 2);
  const usedRelated = new Set<string>();
  let guard = 0;
  while (usedRelated.size < relatedPairs) {
    guard += 1;
    if (guard > relatedPairs * 20 + 10) {
      throw new Error("related 関係を一意に割り当てられませんでした。");
    }
    const left = Math.floor(random() * spec.conceptCount);
    let right = Math.floor(random() * spec.conceptCount);
    if (left === right) {
      right = (right + 1) % spec.conceptCount;
    }
    const a = Math.min(left, right);
    const b = Math.max(left, right);
    const key = `${a}:${b}`;
    if (usedRelated.has(key)) {
      continue;
    }
    usedRelated.add(key);
    const leftConcept = concepts[a];
    const rightConcept = concepts[b];
    if (!leftConcept || !rightConcept) {
      throw new Error("related の概念 index が範囲外です。");
    }
    leftConcept.relatedIds.push(rightConcept.id);
    rightConcept.relatedIds.push(leftConcept.id);
  }

  const prerequisiteEdges = spec.relationCount - relatedPairs;
  const usedPrerequisite = new Set<string>();
  const acceptedPrerequisite = new Set<string>();
  const reaches = (start: number, goal: number): boolean => {
    const seen = new Set<number>([start]);
    const queue = [start];
    while (queue.length > 0) {
      const current = queue.pop()!;
      const concept = concepts[current];
      if (!concept) {
        continue;
      }
      for (const prerequisiteId of concept.prerequisiteIds) {
        const next = Number(prerequisiteId.slice("perf-c-".length));
        if (next === goal) {
          return true;
        }
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    return false;
  };
  guard = 0;
  while (acceptedPrerequisite.size < prerequisiteEdges) {
    guard += 1;
    if (guard > prerequisiteEdges * 40 + 10) {
      throw new Error("prerequisite 関係を一意に割り当てられませんでした。");
    }
    const dependent = Math.floor(random() * spec.conceptCount);
    let required = Math.floor(random() * spec.conceptCount);
    if (dependent === required) {
      required = (required + 1) % spec.conceptCount;
    }
    const key = `${dependent}:${required}`;
    if (usedPrerequisite.has(key)) {
      continue;
    }
    usedPrerequisite.add(key);
    if (reaches(required, dependent)) {
      continue;
    }
    const dependentConcept = concepts[dependent];
    const requiredConcept = concepts[required];
    if (!dependentConcept || !requiredConcept) {
      throw new Error("prerequisite の概念 index が範囲外です。");
    }
    acceptedPrerequisite.add(key);
    dependentConcept.prerequisiteIds.push(requiredConcept.id);
  }

  const contextCards: ContextCard[] = [];
  for (let index = 0; index < spec.contextCount; index += 1) {
    const linked =
      spec.conceptCount === 0 ? [] : [conceptId(index % spec.conceptCount)];
    contextCards.push({
      id: contextId(index),
      title: `文脈 ${index}`,
      domainTags: [`domain-${index % 8}`],
      centralQuestion: `問い ${index}`,
      background: `背景 ${index}`,
      flow: `流れ ${index}`,
      keyConcepts: `概念 ${index}`,
      linkedConcepts: linked,
      createdAt: isoAt(index),
      updatedAt: isoAt(index)
    });
  }

  const quizQuestions: QuizQuestion[] = [];
  for (let index = 0; index < spec.quizCount; index += 1) {
    const owner = conceptId(index % spec.conceptCount);
    quizQuestions.push({
      id: questionId(index),
      conceptId: owner,
      questionType: "multiple-choice",
      prompt: `問題 ${index}`,
      choices: [
        { id: `${questionId(index)}-a`, text: "選択肢A", sourceConceptId: owner },
        { id: `${questionId(index)}-b`, text: "選択肢B" }
      ],
      correctChoiceId: `${questionId(index)}-a`,
      visibility: "private",
      schemaVersion: QUIZ_QUESTION_SCHEMA_VERSION,
      createdAt: isoAt(index),
      updatedAt: isoAt(index)
    });
  }

  const quizAttemptLogs: QuizAttemptLog[] = [];
  for (let index = 0; index < spec.logCount; index += 1) {
    const question = quizQuestions[index % spec.quizCount];
    if (!question?.conceptId) {
      throw new Error("学習ログの参照先問題がありません。");
    }
    const correct = index % 3 !== 0;
    quizAttemptLogs.push({
      id: logId(index),
      sessionId: `perf-session-${index % 50}`,
      conceptId: question.conceptId,
      questionId: question.id,
      questionType: "multiple-choice",
      questionPromptSnapshot: question.prompt,
      questionConceptId: question.conceptId,
      selectedChoiceId: correct ? question.correctChoiceId : `${question.id}-b`,
      selectedChoiceTextSnapshot: correct ? "選択肢A" : "選択肢B",
      correctChoiceId: question.correctChoiceId,
      correctChoiceTextSnapshot: "選択肢A",
      correct,
      startedAt: isoAt(index),
      answeredAt: isoAt(index + 1),
      timeMs: 1000 + (index % 4000),
      schemaVersion: QUIZ_ATTEMPT_LOG_SCHEMA_VERSION
    });
  }

  let attachment: SyntheticAttachment | null = null;
  if (spec.attachmentBytes > 0) {
    const card = contextCards[0];
    if (!card) {
      throw new Error("添付の文脈カードがありません。");
    }
    const prefixLength = Math.min(64, spec.attachmentBytes);
    const prefix: number[] = [];
    for (let index = 0; index < prefixLength; index += 1) {
      prefix.push(Math.floor(random() * 256));
    }
    const material: LearningMaterial = {
      id: "perf-material-0",
      contextCardId: card.id,
      type: "pdf",
      title: "perf attachment",
      fileName: "perf-attachment.bin",
      mimeType: "application/pdf",
      fileSize: spec.attachmentBytes,
      createdAt: isoAt(0),
      updatedAt: isoAt(0)
    };
    attachment = { material, byteLength: spec.attachmentBytes, prefix };
  }

  return {
    spec,
    concepts,
    contextCards,
    quizQuestions,
    quizAttemptLogs,
    attachment,
    counts: {
      concepts: concepts.length,
      logs: quizAttemptLogs.length,
      quizzes: quizQuestions.length,
      contexts: contextCards.length,
      relatedPairs: usedRelated.size,
      prerequisiteEdges: acceptedPrerequisite.size,
      relations: usedRelated.size + usedPrerequisite.size,
      attachmentBytes: attachment?.byteLength ?? 0
    }
  };
};

/** prerequisiteIds を辿って循環があれば、その ID 列を返す。 */
export const findPrerequisiteCycle = (concepts: Concept[]): string[] | null => {
  const outgoing = new Map(concepts.map((concept) => [concept.id, concept.prerequisiteIds]));
  const state = new Map<string, "visiting" | "done">();
  const stack: string[] = [];

  const visit = (id: string): string[] | null => {
    const mark = state.get(id);
    if (mark === "done") {
      return null;
    }
    if (mark === "visiting") {
      const start = stack.indexOf(id);
      return [...stack.slice(start), id];
    }
    state.set(id, "visiting");
    stack.push(id);
    for (const next of outgoing.get(id) ?? []) {
      const cycle = visit(next);
      if (cycle) {
        return cycle;
      }
    }
    stack.pop();
    state.set(id, "done");
    return null;
  };

  for (const concept of concepts) {
    const cycle = visit(concept.id);
    if (cycle) {
      return cycle;
    }
  }
  return null;
};

export const assertDatasetIntegrity = (dataset: SyntheticDataset): void => {
  const ids = new Set(dataset.concepts.map((concept) => concept.id));
  if (ids.size !== dataset.concepts.length) {
    throw new Error("概念 ID が重複しています。");
  }
  for (const concept of dataset.concepts) {
    for (const relatedId of concept.relatedIds) {
      if (relatedId === concept.id || !ids.has(relatedId)) {
        throw new Error(`relatedIds が不正です: ${concept.id} -> ${relatedId}`);
      }
    }
    for (const prerequisiteId of concept.prerequisiteIds) {
      if (prerequisiteId === concept.id || !ids.has(prerequisiteId)) {
        throw new Error(`prerequisiteIds が不正です: ${concept.id} -> ${prerequisiteId}`);
      }
    }
  }
  const cycle = findPrerequisiteCycle(dataset.concepts);
  if (cycle) {
    throw new Error(`prerequisite が循環しています: ${cycle.join(" -> ")}`);
  }
  const questionIds = new Set<string>();
  for (const question of dataset.quizQuestions) {
    if (questionIds.has(question.id)) {
      throw new Error(`クイズ ID が重複しています: ${question.id}`);
    }
    questionIds.add(question.id);
    if (!question.conceptId || !ids.has(question.conceptId)) {
      throw new Error(`クイズの conceptId が不正です: ${question.id}`);
    }
  }
  for (const log of dataset.quizAttemptLogs) {
    if (!questionIds.has(log.questionId)) {
      throw new Error(`学習ログの questionId が不正です: ${log.id}`);
    }
    if (!log.conceptId || !ids.has(log.conceptId)) {
      throw new Error(`学習ログの conceptId が不正です: ${log.id}`);
    }
  }
  for (const card of dataset.contextCards) {
    for (const linked of card.linkedConcepts) {
      if (!ids.has(linked)) {
        throw new Error(`文脈カードの linkedConcepts が不正です: ${card.id}`);
      }
    }
  }
  if (dataset.attachment && !dataset.contextCards.some((card) => card.id === dataset.attachment?.material.contextCardId)) {
    throw new Error("添付の contextCardId が不正です。");
  }
};
