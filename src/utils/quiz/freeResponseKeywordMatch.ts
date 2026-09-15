/**
 * free-response の採点補助キーワード。
 * 一致結果は自己評価の参考情報であり、correct / partial / incorrect の自動決定には使わない。
 *
 * 初期実装の比較範囲:
 * Unicode NFKC + 英字 case 無視 + 前後・連続 whitespace 正規化 + substring match。
 * 形態素解析・活用・同義語・typo 補正・fuzzy / embedding / LLM は行わない。
 */

export type FreeResponseKeywordMatchResult = {
  matchedKeywords: string[];
  missingKeywords: string[];
};

/** 回答・キーワード双方の比較用正規化 */
export const normalizeKeywordForComparison = (text: string): string =>
  text.normalize("NFKC").toLowerCase().trim().replace(/\s+/g, " ");

const displayKeywordFromUnknown = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

/**
 * 保存時正規化。前後 trim・空文字除外・比較キーでの重複除外。
 * 表示用文字列は最初に登録された表記を保持する。
 * 不正・空なら undefined。
 */
export const normalizeFreeResponseKeywords = (raw: unknown): string[] | undefined => {
  if (!Array.isArray(raw)) {
    return undefined;
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of raw) {
    const display = displayKeywordFromUnknown(entry);
    if (!display) {
      continue;
    }
    const key = normalizeKeywordForComparison(display);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(display);
  }
  return out.length > 0 ? out : undefined;
};

export const matchFreeResponseKeywords = (
  answer: string,
  keywords: readonly unknown[]
): FreeResponseKeywordMatchResult => {
  const canonical = normalizeFreeResponseKeywords(keywords) ?? [];
  if (canonical.length === 0) {
    return { matchedKeywords: [], missingKeywords: [] };
  }
  const normalizedAnswer = normalizeKeywordForComparison(answer);
  const matchedKeywords: string[] = [];
  const missingKeywords: string[] = [];
  for (const keyword of canonical) {
    const needle = normalizeKeywordForComparison(keyword);
    if (needle && normalizedAnswer.includes(needle)) {
      matchedKeywords.push(keyword);
    } else {
      missingKeywords.push(keyword);
    }
  }
  return { matchedKeywords, missingKeywords };
};
