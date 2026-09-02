import type { QuizDeck } from "../../types/quiz";

/**
 * generationFilters が無い旧 Deck について、sourceDomainTag から生成条件を復元する。
 * 既存の generationFilters は上書きしない。sourceDomainTag 自体は削除しない。
 */
export function hydrateLegacyGenerationFilters(deck: QuizDeck): QuizDeck {
  if (deck.generationFilters?.targetDomainTag?.trim()) {
    return deck;
  }
  const tag = deck.sourceDomainTag?.trim();
  if (!tag) {
    return deck;
  }
  deck.generationFilters = {
    targetDomainTag: tag,
    includeDraftConcepts: false,
    generationMode: "auto"
  };
  return deck;
}
