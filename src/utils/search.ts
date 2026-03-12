const normalizeText = (text: string): string =>
  text
    .toLowerCase()
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();

export const normalizeForSearch = normalizeText;

export const includesNormalized = (source: string, query: string): boolean => {
  const normalizedSource = normalizeText(source);
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) {
    return true;
  }
  return normalizedSource.includes(normalizedQuery);
};
