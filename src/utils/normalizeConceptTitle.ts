/** 概念名の照合用: trim → NFKC → 英字小文字化 */
export function normalizeConceptTitle(title: string): string {
  return title.trim().normalize("NFKC").toLowerCase();
}
