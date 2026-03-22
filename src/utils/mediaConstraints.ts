import type { MediaKind } from "../types/media";

/** 1ファイルあたりの上限（バイト） */
export const MAX_MEDIA_FILE_BYTES = 20 * 1024 * 1024;

/** 1概念あたりの添付上限 */
export const MAX_MEDIA_FILES_PER_CONCEPT = 24;

const IMAGE_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif"
]);

const VIDEO_MIMES = new Set(["video/mp4", "video/webm"]);

const EXT_TO_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  mp4: "video/mp4",
  webm: "video/webm"
};

/** ZIP インポート時など、ファイル名から MIME を推定 */
export const guessMimeFromFileName = (fileName: string, kind: MediaKind): string => {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (ext && EXT_TO_MIME[ext]) {
    return EXT_TO_MIME[ext];
  }
  return kind === "image" ? "image/png" : "video/mp4";
};

export const normalizeMimeType = (file: File): string => {
  const raw = (file.type || "").trim().toLowerCase();
  if (raw) {
    return raw === "image/jpg" ? "image/jpeg" : raw;
  }
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return EXT_TO_MIME[ext] ?? "";
};

export const mimeToKind = (mime: string): MediaKind | null => {
  const m = mime === "image/jpg" ? "image/jpeg" : mime;
  if (IMAGE_MIMES.has(m) || m === "image/jpeg") {
    return "image";
  }
  if (VIDEO_MIMES.has(m)) {
    return "video";
  }
  return null;
};

export const validateMediaFile = (
  file: File
): { ok: true; mimeType: string; kind: MediaKind } | { ok: false; message: string } => {
  if (file.size > MAX_MEDIA_FILE_BYTES) {
    return {
      ok: false,
      message: `ファイルサイズは ${Math.floor(MAX_MEDIA_FILE_BYTES / (1024 * 1024))}MB 以下にしてください。`
    };
  }
  const mimeType = normalizeMimeType(file);
  const kind = mimeToKind(mimeType);
  if (!kind) {
    return {
      ok: false,
      message: "対応形式: 画像 png / jpg / jpeg / gif、動画 mp4 / webm のみです。"
    };
  }
  return { ok: true, mimeType, kind };
};
