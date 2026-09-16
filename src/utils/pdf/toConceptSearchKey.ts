const WHITESPACE = /[\s\u00a0\u3000]+/g;

/** PDF照合用: NFKC → 小文字 → 空白・改行除去 */
export const toConceptSearchKey = (value: string): string =>
  value.normalize("NFKC").toLowerCase().replace(WHITESPACE, "");

/**
 * 英数字1文字など誤検出しやすい title だけ除外する。
 * 漢字1文字や日本語2文字は残す。
 */
export const isTooNoisyConceptTitle = (title: string): boolean => {
  const key = toConceptSearchKey(title);
  if (!key) {
    return true;
  }
  if (key.length === 1 && /^[0-9a-z]$/i.test(key)) {
    return true;
  }
  return false;
};
