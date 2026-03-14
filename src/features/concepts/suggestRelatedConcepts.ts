import { normalizeForSearch } from "../../utils/search";

type SuggestableConceptNode = {
  id: string;
  title: string;
  definition: string;
  tags: string[];
  links: string[];
};

export type RelatedConceptSuggestion = {
  id: string;
  title: string;
  score: number;
  reasons: string[];
};

export type SuggestRelatedConceptsOptions = {
  stopwords?: string[];
};

const DEFAULT_STOPWORDS = new Set([
  "こと",
  "もの",
  "ため",
  "よう",
  "これ",
  "それ",
  "あれ",
  "する",
  "ある",
  "なる",
  "いる"
]);

const normalize = (text: string): string => normalizeForSearch(text);

const unique = (items: string[]): string[] => Array.from(new Set(items));

const normalizeTag = (tag: string): string => normalize(tag);

const tokenize = (text: string, stopwords: Set<string>): string[] => {
  const normalized = normalize(text);
  if (!normalized) {
    return [];
  }

  const words = normalized.match(/[一-龯ぁ-んァ-ヶーA-Za-z0-9]{2,}/g) ?? [];
  const japaneseRuns = normalized.match(/[一-龯ぁ-んァ-ヶー]{2,}/g) ?? [];

  const tokens = new Set<string>();
  words.forEach((word) => tokens.add(word));

  // 日本語文でも最低限共通語が拾えるよう、2文字のn-gramを追加する。
  japaneseRuns.forEach((run) => {
    for (let i = 0; i < run.length - 1; i += 1) {
      tokens.add(run.slice(i, i + 2));
    }
  });

  return [...tokens].filter((token) => {
    if (!token) {
      return false;
    }
    if (stopwords.has(token)) {
      return false;
    }
    if (/^[ぁ-ん]$/.test(token)) {
      return false;
    }
    if (/^[^一-龯ぁ-んァ-ヶーA-Za-z0-9]+$/.test(token)) {
      return false;
    }
    return token.length >= 2;
  });
};

const intersect = (a: string[], b: string[]): string[] => {
  const bSet = new Set(b);
  return a.filter((item) => bSet.has(item));
};

const toComparableNode = (
  node: {
    id: string;
    title?: string;
    definition?: string;
    tags?: string[];
    links?: string[];
  }
): SuggestableConceptNode => ({
  id: node.id,
  title: node.title ?? "",
  definition: node.definition ?? "",
  tags: node.tags ?? [],
  links: node.links ?? []
});

export const suggestRelatedConcepts = (
  inputNodeRaw: {
    id: string;
    title?: string;
    definition?: string;
    tags?: string[];
    links?: string[];
  },
  allNodesRaw: Array<{
    id: string;
    title?: string;
    definition?: string;
    tags?: string[];
    links?: string[];
  }>,
  options?: SuggestRelatedConceptsOptions
): RelatedConceptSuggestion[] => {
  const isDev = import.meta.env.DEV;
  const stopwords = new Set(options?.stopwords ?? [...DEFAULT_STOPWORDS]);
  const inputNode = toComparableNode(inputNodeRaw);

  const inputTitle = inputNode.title.trim();
  const inputTitleNormalized = normalize(inputTitle);
  const inputDefinitionNormalized = normalize(inputNode.definition);
  const inputTagsNormalized = unique(inputNode.tags.map(normalizeTag).filter(Boolean));
  const inputLinkedIds = new Set(inputNode.links);
  const inputKeywords = tokenize(`${inputNode.title} ${inputNode.definition}`, stopwords);

  const suggestions: RelatedConceptSuggestion[] = [];

  allNodesRaw.forEach((candidateRaw) => {
    const candidate = toComparableNode(candidateRaw);
    const candidateTitle = candidate.title.trim();
    if (!candidateTitle) {
      return;
    }
    if (candidate.id === inputNode.id) {
      return;
    }
    if (inputLinkedIds.has(candidate.id)) {
      return;
    }

    const reasons: string[] = [];
    let score = 0;

    const candidateTitleNormalized = normalize(candidateTitle);
    const candidateDefinitionNormalized = normalize(candidate.definition);

    if (candidateTitleNormalized && inputDefinitionNormalized.includes(candidateTitleNormalized)) {
      score += 5;
      reasons.push(`定義文に「${candidateTitle}」が含まれています`);
    }

    if (inputTitleNormalized && candidateDefinitionNormalized.includes(inputTitleNormalized)) {
      score += 4;
      reasons.push(`既存概念の定義文に「${inputTitle}」が含まれています`);
    }

    if (
      inputTitleNormalized &&
      candidateTitleNormalized &&
      (inputTitleNormalized.includes(candidateTitleNormalized) ||
        candidateTitleNormalized.includes(inputTitleNormalized))
    ) {
      score += 3;
      reasons.push("概念名が部分一致しています");
    }

    const candidateTagsNormalized = unique(candidate.tags.map(normalizeTag).filter(Boolean));
    const sharedTags = intersect(inputTagsNormalized, candidateTagsNormalized);
    sharedTags.forEach((tag) => {
      score += 2;
      reasons.push(`同じタグ「${tag}」があります`);
    });

    const candidateKeywords = tokenize(`${candidate.title} ${candidate.definition}`, stopwords);
    const sharedKeywords = intersect(inputKeywords, candidateKeywords).slice(0, 3);
    sharedKeywords.forEach((keyword) => {
      score += 1;
      reasons.push(`共通語「${keyword}」があります`);
    });

    if (isDev) {
      console.log("score breakdown", {
        inputTitle,
        inputDefinition: inputNode.definition,
        candidateTitle,
        score,
        reasons
      });
    }

    if (score <= 0) {
      return;
    }

    suggestions.push({
      id: candidate.id,
      title: candidateTitle,
      score,
      reasons
    });
  });

  return suggestions
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, "ja"));
};
