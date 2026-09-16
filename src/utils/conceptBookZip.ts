import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

export const CONCEPT_BOOK_ZIP_CONCEPTS_ENTRY = "concepts.json";
export const CONCEPT_BOOK_ZIP_LEARNING_MATERIALS_PREFIX = "learning-materials/";

export const conceptBookMediaPath = (mediaId: string): string => {
  if (mediaId.includes("/") || mediaId.includes("\\") || mediaId.includes("..")) {
    throw new Error("不正なメディアIDです。");
  }
  return `media/${mediaId}`;
};

export const conceptBookLearningMaterialPath = (materialId: string): string => {
  if (materialId.includes("/") || materialId.includes("\\") || materialId.includes("..")) {
    throw new Error("不正な教材IDです。");
  }
  return `${CONCEPT_BOOK_ZIP_LEARNING_MATERIALS_PREFIX}${materialId}.pdf`;
};

export type ParsedConceptBookZip = {
  conceptsText: string;
  mediaEntries: Map<string, Uint8Array>;
  learningMaterialEntries: Map<string, Uint8Array>;
};

const parsePrefixedEntries = (
  unzipped: Record<string, Uint8Array>,
  keys: string[],
  prefix: string,
  stripExtension?: string
): Map<string, Uint8Array> => {
  const entries = new Map<string, Uint8Array>();
  for (const key of keys) {
    if (!key.startsWith(prefix)) {
      continue;
    }
    let id = key.slice(prefix.length).replace(/^\/+/, "");
    if (stripExtension && id.toLowerCase().endsWith(stripExtension)) {
      id = id.slice(0, -stripExtension.length);
    }
    if (!id || id.includes("/")) {
      continue;
    }
    const data = unzipped[key];
    if (data && data.length > 0) {
      entries.set(id, data);
    }
  }
  return entries;
};

export const parseConceptBookZip = (buffer: ArrayBuffer): ParsedConceptBookZip => {
  const unzipped = unzipSync(new Uint8Array(buffer));
  const keys = Object.keys(unzipped);
  const conceptsKey =
    keys.find((k) => k === CONCEPT_BOOK_ZIP_CONCEPTS_ENTRY) ??
    keys.find((k) => k.endsWith(`/${CONCEPT_BOOK_ZIP_CONCEPTS_ENTRY}`));
  if (!conceptsKey || !unzipped[conceptsKey]) {
    throw new Error("ZIP内に concepts.json がありません。");
  }
  return {
    conceptsText: strFromU8(unzipped[conceptsKey]),
    mediaEntries: parsePrefixedEntries(unzipped, keys, "media/"),
    learningMaterialEntries: parsePrefixedEntries(
      unzipped,
      keys,
      CONCEPT_BOOK_ZIP_LEARNING_MATERIALS_PREFIX,
      ".pdf"
    )
  };
};

export const buildConceptBookZip = (
  conceptsJson: string,
  mediaFiles: { id: string; data: Uint8Array }[],
  learningMaterialFiles: { id: string; data: Uint8Array }[] = []
): Uint8Array => {
  const out: Record<string, Uint8Array> = {
    [CONCEPT_BOOK_ZIP_CONCEPTS_ENTRY]: strToU8(conceptsJson)
  };
  for (const { id, data } of mediaFiles) {
    out[conceptBookMediaPath(id)] = data;
  }
  for (const { id, data } of learningMaterialFiles) {
    out[conceptBookLearningMaterialPath(id)] = data;
  }
  return zipSync(out, { level: 5 });
};
