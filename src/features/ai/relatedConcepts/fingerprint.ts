/**
 * Embedding 用テキストの安定 fingerprint。暗号学的安全性は不要。
 */
export const fingerprintRelatedConceptEmbeddingText = (text: string): string => {
  let fnv = 0x811c9dc5;
  let djb2 = 5381;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    fnv ^= code;
    fnv = Math.imul(fnv, 0x01000193);
    djb2 = (Math.imul(djb2, 33) + code) >>> 0;
  }
  const fnvHex = (fnv >>> 0).toString(16).padStart(8, "0");
  const djb2Hex = djb2.toString(16).padStart(8, "0");
  return `${text.length.toString(16)}:${fnvHex}:${djb2Hex}`;
};
