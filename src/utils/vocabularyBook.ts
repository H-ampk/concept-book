import type { Concept } from "../types/concept";
import type { ContextCard } from "../types/contextCard";
import type { VocabularyBook } from "../types/vocabularyBook";

/** 分野タグが無いレコードを一覧に残すための表示名。保存値ではない。 */
export const UNASSIGNED_DOMAIN_LABEL = "未設定";

export type VocabularyKindFilter = "all" | "concept" | "context";

export type VocabularyDomainSummary = {
  domain: string;
  conceptCount: number;
  contextCardCount: number;
};

export type VocabularyEntry = {
  id: string;
  kind: "concept" | "context";
  title: string;
  summary: string;
  domains: string[];
};

/** 分野タグの正規化。非文字列・空白のみを捨て、先勝ちで重複を除く。大小文字は区別する。 */
export const normalizeVocabularyDomainTags = (tags: readonly unknown[] | undefined): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const tag of tags ?? []) {
    if (typeof tag !== "string") {
      continue;
    }
    const trimmed = tag.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
};

const uniqueTags = (tags: readonly string[] | undefined): string[] =>
  normalizeVocabularyDomainTags(tags);

/** Concept の所属分野。空なら未設定。同一 Concept 内の重複タグは除く。 */
export const conceptDomainKeys = (concept: Pick<Concept, "domainTags">): string[] => {
  const tags = uniqueTags(concept.domainTags);
  return tags.length > 0 ? tags : [UNASSIGNED_DOMAIN_LABEL];
};

/**
 * 文脈カードの所属分野。
 * 有効な domainTags があればそれを使い、無ければ domain、どちらも無ければ未設定。
 */
export const contextCardDomainKeys = (
  card: Pick<ContextCard, "domainTags" | "domain">
): string[] => {
  const tags = uniqueTags(card.domainTags);
  if (tags.length > 0) {
    return tags;
  }
  const domain = typeof card.domain === "string" ? card.domain.trim() : "";
  return domain ? [domain] : [UNASSIGNED_DOMAIN_LABEL];
};

type VocabularyBookTagCriteria = Pick<VocabularyBook, "domainTags" | "includeUnassigned">;

const matchesVocabularyBookTags = (
  book: VocabularyBookTagCriteria,
  domainKeys: readonly string[],
  isUnassigned: boolean
): boolean => {
  if (isUnassigned) {
    return book.includeUnassigned;
  }
  const bookTags = new Set(uniqueTags(book.domainTags));
  return domainKeys.some((domain) => bookTags.has(domain));
};

/** 単語帳のタグ設定に Concept が一致するかを判定する。 */
export const matchesVocabularyBookConcept = (
  book: VocabularyBookTagCriteria,
  concept: Pick<Concept, "domainTags">
): boolean => {
  const tags = uniqueTags(concept.domainTags);
  return matchesVocabularyBookTags(book, conceptDomainKeys(concept), tags.length === 0);
};

/** 単語帳のタグ設定に文脈カードが一致するかを、domainTags / domain フォールバックで判定する。 */
export const matchesVocabularyBookContextCard = (
  book: VocabularyBookTagCriteria,
  card: Pick<ContextCard, "domainTags" | "domain">
): boolean => {
  const tags = uniqueTags(card.domainTags);
  const fallbackDomain = typeof card.domain === "string" ? card.domain.trim() : "";
  const isUnassigned = tags.length === 0 && !fallbackDomain;
  return matchesVocabularyBookTags(book, contextCardDomainKeys(card), isUnassigned);
};

const remember = (bucket: Map<string, Set<string>>, domain: string, id: string) => {
  const ids = bucket.get(domain) ?? new Set<string>();
  ids.add(id);
  bucket.set(domain, ids);
};

export const buildVocabularyDomainSummaries = (
  concepts: readonly Concept[],
  contextCards: readonly ContextCard[]
): VocabularyDomainSummary[] => {
  const conceptIds = new Map<string, Set<string>>();
  const cardIds = new Map<string, Set<string>>();

  for (const concept of concepts) {
    for (const domain of conceptDomainKeys(concept)) {
      remember(conceptIds, domain, concept.id);
    }
  }
  for (const card of contextCards) {
    for (const domain of contextCardDomainKeys(card)) {
      remember(cardIds, domain, card.id);
    }
  }

  const domains = new Set<string>([...conceptIds.keys(), ...cardIds.keys()]);
  return [...domains]
    .sort((a, b) => {
      if (a === UNASSIGNED_DOMAIN_LABEL) return 1;
      if (b === UNASSIGNED_DOMAIN_LABEL) return -1;
      return a.localeCompare(b, "ja");
    })
    .map((domain) => ({
      domain,
      conceptCount: conceptIds.get(domain)?.size ?? 0,
      contextCardCount: cardIds.get(domain)?.size ?? 0
    }));
};

export const summarizeVocabularyText = (text: string | undefined, max = 80): string => {
  const flat = (text ?? "").replace(/\s+/g, " ").trim();
  if (!flat) {
    return "未入力";
  }
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
};

const conceptSummary = (concept: Concept): string =>
  summarizeVocabularyText(concept.definition || concept.myInterpretation || concept.notes);

const contextSummary = (card: ContextCard): string =>
  summarizeVocabularyText(card.centralQuestion || card.background || card.flow || card.keyConcepts);

export const buildVocabularyEntries = (
  domain: string,
  concepts: readonly Concept[],
  contextCards: readonly ContextCard[],
  kind: VocabularyKindFilter
): VocabularyEntry[] => {
  const entries: VocabularyEntry[] = [];

  if (kind !== "context") {
    const seen = new Set<string>();
    for (const concept of concepts) {
      if (seen.has(concept.id)) {
        continue;
      }
      const domains = conceptDomainKeys(concept);
      if (!domains.includes(domain)) {
        continue;
      }
      seen.add(concept.id);
      entries.push({
        id: concept.id,
        kind: "concept",
        title: concept.title || "無題",
        summary: conceptSummary(concept),
        domains
      });
    }
  }

  if (kind !== "concept") {
    const seen = new Set<string>();
    for (const card of contextCards) {
      if (seen.has(card.id)) {
        continue;
      }
      const domains = contextCardDomainKeys(card);
      if (!domains.includes(domain)) {
        continue;
      }
      seen.add(card.id);
      entries.push({
        id: card.id,
        kind: "context",
        title: card.title || "無題",
        summary: contextSummary(card),
        domains
      });
    }
  }

  return entries;
};
