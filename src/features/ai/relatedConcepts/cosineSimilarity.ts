const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

export const isValidEmbeddingVector = (vector: unknown): vector is number[] => {
  if (!Array.isArray(vector) || vector.length === 0) {
    return false;
  }
  return vector.every(isFiniteNumber);
};

export const vectorNorm = (vector: readonly number[]): number | null => {
  if (vector.length === 0) {
    return null;
  }
  let sum = 0;
  for (const value of vector) {
    if (!isFiniteNumber(value)) {
      return null;
    }
    sum += value * value;
  }
  if (!Number.isFinite(sum) || sum === 0) {
    return null;
  }
  const norm = Math.sqrt(sum);
  return Number.isFinite(norm) && norm > 0 ? norm : null;
};

/**
 * cosine similarity。異常 vector では null を返す（throw しない）。
 */
export const cosineSimilarity = (a: readonly number[], b: readonly number[]): number | null => {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) {
    return null;
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    const x = a[i];
    const y = b[i];
    if (!isFiniteNumber(x) || !isFiniteNumber(y)) {
      return null;
    }
    dot += x * y;
    normA += x * x;
    normB += y * y;
  }
  if (!Number.isFinite(dot) || !Number.isFinite(normA) || !Number.isFinite(normB)) {
    return null;
  }
  if (normA === 0 || normB === 0) {
    return null;
  }
  const similarity = dot / (Math.sqrt(normA) * Math.sqrt(normB));
  return Number.isFinite(similarity) ? similarity : null;
};
