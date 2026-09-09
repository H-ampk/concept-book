import type { Concept } from "../../types/concept";

export type AIConceptSnapshot = Readonly<{
  id: string;
  title: string;
  definition?: string;
  myInterpretation?: string;
  relatedTitles?: readonly string[];
}>;

export type BuildAIConceptSnapshotOptions = {
  relatedTitles?: string[];
};

const optionalText = (value: string): string | undefined => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

/**
 * AI通信専用の読み取り専用 Snapshot。
 * Concept オブジェクトをそのまま Provider へ渡さないための抽出層。
 * notes / source / media / relatedIds などは含めない。
 */
export const buildAIConceptSnapshot = (
  concept: Concept,
  options?: BuildAIConceptSnapshotOptions
): AIConceptSnapshot => {
  const definition = optionalText(concept.definition);
  const myInterpretation = optionalText(concept.myInterpretation);
  const relatedTitles = options?.relatedTitles
    ?.map((title) => title.trim())
    .filter((title) => title.length > 0);

  const snapshot: {
    id: string;
    title: string;
    definition?: string;
    myInterpretation?: string;
    relatedTitles?: readonly string[];
  } = {
    id: concept.id,
    title: concept.title
  };

  if (definition !== undefined) {
    snapshot.definition = definition;
  }
  if (myInterpretation !== undefined) {
    snapshot.myInterpretation = myInterpretation;
  }
  if (relatedTitles && relatedTitles.length > 0) {
    snapshot.relatedTitles = Object.freeze([...relatedTitles]);
  }

  return Object.freeze(snapshot);
};
