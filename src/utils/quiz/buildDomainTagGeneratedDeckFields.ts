import type { QuizDeck, QuizDeckGenerationFilters, QuizDeckGenerationSummary } from "../../types/quiz";

type DomainTagGeneratedDeckFields = Pick<
  QuizDeck,
  "sourceType" | "generationSummary" | "generationFilters" | "lastSyncedAt"
>;

/** 分野タグから新規自動生成する Deck に載せる公式フィールド（sourceDomainTag は含めない） */
export function buildDomainTagGeneratedDeckFields(input: {
  targetDomainTag: string;
  includeDraftConcepts: boolean;
  generationMode: NonNullable<QuizDeckGenerationFilters["generationMode"]>;
  generationSummary?: QuizDeckGenerationSummary;
  lastSyncedAt: string;
}): DomainTagGeneratedDeckFields {
  const fields: DomainTagGeneratedDeckFields = {
    sourceType: "domain-tag",
    generationFilters: {
      targetDomainTag: input.targetDomainTag,
      includeDraftConcepts: input.includeDraftConcepts,
      generationMode: input.generationMode
    },
    lastSyncedAt: input.lastSyncedAt
  };
  if (input.generationSummary) {
    fields.generationSummary = input.generationSummary;
  }
  return fields;
}
