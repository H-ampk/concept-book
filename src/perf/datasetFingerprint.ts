import type { SyntheticDataset } from "./generateSyntheticDataset";

/** 概念 CRUD が書き換え得るストア。ログと Sync Queue は削除処理の対象外。 */
export const CRUD_TOUCHED_STORES = ["concepts", "contextCards", "quizQuestions", "media", "conceptSourceAnchors"] as const;

export const CRUD_UNTOUCHED_STORES = [
  "quizAttemptLogs",
  "quizDecks",
  "researchReports",
  "vocabularyBooks",
  "learningMaterials",
  "learningMaterialBlobs",
  "syncQueue",
  "syncState"
] as const;

export type FingerprintInput = {
  concepts: Array<{
    id: string;
    title?: string;
    relatedIds?: string[];
    prerequisiteIds?: string[];
    createdAt?: string;
    updatedAt?: string;
  }>;
  contextCards: Array<{
    id: string;
    linkedConcepts?: string[];
    createdAt?: string;
    updatedAt?: string;
  }>;
  quizQuestions: Array<{
    id: string;
    conceptId?: string;
    updatedAt?: string;
    choices?: Array<{ sourceConceptId?: string }>;
  }>;
  quizAttemptLogs: Array<{ id: string; questionId?: string; conceptId?: string; answeredAt?: string }>;
  learningMaterials: Array<{ id: string; fileSize?: number; contextCardId?: string }>;
  emptyStores: Record<string, number>;
};

const line = (value: unknown): string => JSON.stringify(value);

export const fingerprintPayload = (input: FingerprintInput): Record<string, string> => ({
  concepts: input.concepts
    .map((concept) =>
      line({
        id: concept.id,
        title: concept.title ?? "",
        relatedIds: [...(concept.relatedIds ?? [])].sort(),
        prerequisiteIds: [...(concept.prerequisiteIds ?? [])].sort(),
        createdAt: concept.createdAt ?? "",
        updatedAt: concept.updatedAt ?? ""
      })
    )
    .sort()
    .join("\n"),
  contextCards: input.contextCards
    .map((card) =>
      line({
        id: card.id,
        linkedConcepts: [...(card.linkedConcepts ?? [])].sort(),
        createdAt: card.createdAt ?? "",
        updatedAt: card.updatedAt ?? ""
      })
    )
    .sort()
    .join("\n"),
  quizQuestions: input.quizQuestions
    .map((question) =>
      line({
        id: question.id,
        conceptId: question.conceptId ?? "",
        updatedAt: question.updatedAt ?? "",
        sourceConceptIds: (question.choices ?? []).map((choice) => choice.sourceConceptId ?? "").sort()
      })
    )
    .sort()
    .join("\n"),
  quizAttemptLogs: input.quizAttemptLogs
    .map((log) =>
      line({
        id: log.id,
        questionId: log.questionId ?? "",
        conceptId: log.conceptId ?? "",
        answeredAt: log.answeredAt ?? ""
      })
    )
    .sort()
    .join("\n"),
  learningMaterials: input.learningMaterials
    .map((material) =>
      line({
        id: material.id,
        fileSize: material.fileSize ?? 0,
        contextCardId: material.contextCardId ?? ""
      })
    )
    .sort()
    .join("\n"),
  emptyStores: line(input.emptyStores)
});

export const datasetToFingerprintInput = (dataset: SyntheticDataset): FingerprintInput => ({
  concepts: dataset.concepts,
  contextCards: dataset.contextCards,
  quizQuestions: dataset.quizQuestions,
  quizAttemptLogs: dataset.quizAttemptLogs,
  learningMaterials: dataset.attachment ? [dataset.attachment.material] : [],
  emptyStores: {
    media: 0,
    conceptSourceAnchors: 0,
    quizDecks: 0,
    researchReports: 0,
    vocabularyBooks: 0,
    learningMaterialBlobs: dataset.attachment ? 1 : 0,
    syncQueue: 0,
    syncState: 0
  }
});

export const fingerprintDataset = (dataset: SyntheticDataset): Record<string, string> =>
  fingerprintPayload(datasetToFingerprintInput(dataset));

export const firstFingerprintMismatch = (
  expected: Record<string, string>,
  actual: Record<string, string>
): string | null => {
  for (const key of Object.keys(expected)) {
    if (expected[key] !== actual[key]) {
      return key;
    }
  }
  return null;
};
