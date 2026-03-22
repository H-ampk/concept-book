import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

export const CONCEPT_BOOK_ZIP_CONCEPTS_ENTRY = "concepts.json";

export const conceptBookMediaPath = (mediaId: string): string => {
  if (mediaId.includes("/") || mediaId.includes("\\") || mediaId.includes("..")) {
    throw new Error("不正なメディアIDです。");
  }
  return `media/${mediaId}`;
};

export type ParsedConceptBookZip = {
  conceptsText: string;
  /** メディアID → バイナリ */
  mediaEntries: Map<string, Uint8Array>;
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
  const conceptsText = strFromU8(unzipped[conceptsKey]);
  const mediaEntries = new Map<string, Uint8Array>();
  const prefix = "media/";
  for (const key of keys) {
    if (!key.startsWith(prefix)) {
      continue;
    }
    const id = key.slice(prefix.length).replace(/^\/+/, "");
    if (!id || id.includes("/")) {
      continue;
    }
    const data = unzipped[key];
    if (data && data.length > 0) {
      mediaEntries.set(id, data);
    }
  }
  return { conceptsText, mediaEntries };
};

export const buildConceptBookZip = (
  conceptsJson: string,
  mediaFiles: { id: string; data: Uint8Array }[]
): Uint8Array => {
  const out: Record<string, Uint8Array> = {
    [CONCEPT_BOOK_ZIP_CONCEPTS_ENTRY]: strToU8(conceptsJson)
  };
  for (const { id, data } of mediaFiles) {
    out[conceptBookMediaPath(id)] = data;
  }
  return zipSync(out, { level: 5 });
};
