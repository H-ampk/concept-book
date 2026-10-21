import { strFromU8, strToU8, Unzip, UnzipInflate, zipSync } from "fflate";
import {
  resolveImportResourceLimits,
  ZIP_CONCEPTS_JSON_TOO_LARGE_MESSAGE,
  ZIP_ENTRY_COUNT_MESSAGE,
  ZIP_IMPORT_TOO_LARGE_MESSAGE,
  ZIP_INFLATE_INPUT_CHUNK_BYTES,
  ZIP_INVALID_MESSAGE,
  ZIP_UNCOMPRESSED_TOO_LARGE_MESSAGE,
  type ImportResourceLimits
} from "./importResourceLimits";

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

export type ZipInflateChunkEvent = {
  name: string;
  chunkBytes: number;
  accepted: boolean;
};

/** テストが展開チャンクを観測するための任意フック。通常の取り込みでは渡さない。 */
export type ZipInflateHooks = {
  onChunk?: (event: ZipInflateChunkEvent) => void;
};

const EOCD_SIGNATURE = 0x06054b50;
const ZIP64_EOCD_LOCATOR_SIGNATURE = 0x07064b50;
const ZIP64_EOCD_SIGNATURE = 0x06064b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const ZIP64_EXTRA_ID = 0x0001;
const UINT16_MAX = 0xffff;
const UINT32_MAX = 0xffffffff;

const isConceptsJsonName = (name: string): boolean =>
  name === CONCEPT_BOOK_ZIP_CONCEPTS_ENTRY || name.endsWith(`/${CONCEPT_BOOK_ZIP_CONCEPTS_ENTRY}`);

const readU16 = (data: Uint8Array, offset: number): number => {
  if (offset < 0 || offset + 2 > data.length) {
    throw new Error(ZIP_INVALID_MESSAGE);
  }
  return data[offset]! | (data[offset + 1]! << 8);
};

const readU32 = (data: Uint8Array, offset: number): number => {
  if (offset < 0 || offset + 4 > data.length) {
    throw new Error(ZIP_INVALID_MESSAGE);
  }
  return (
    (data[offset]! | (data[offset + 1]! << 8) | (data[offset + 2]! << 16) | (data[offset + 3]! << 24)) >>> 0
  );
};

const readU64 = (data: Uint8Array, offset: number): number => {
  const low = readU32(data, offset);
  const high = readU32(data, offset + 4);
  if (high !== 0) {
    return Number.POSITIVE_INFINITY;
  }
  return low;
};

const findEocdOffset = (data: Uint8Array): number => {
  if (data.length < 22) {
    throw new Error(ZIP_INVALID_MESSAGE);
  }
  const min = Math.max(0, data.length - (65535 + 22));
  for (let offset = data.length - 22; offset >= min; offset -= 1) {
    if (readU32(data, offset) !== EOCD_SIGNATURE) {
      continue;
    }
    const commentLength = readU16(data, offset + 20);
    if (offset + 22 + commentLength === data.length) {
      return offset;
    }
  }
  throw new Error(ZIP_INVALID_MESSAGE);
};

const readZip64Eocd = (
  data: Uint8Array,
  eocdOffset: number
): { entryCount: number; cdSize: number; cdOffset: number } | null => {
  if (eocdOffset < 20 || readU32(data, eocdOffset - 20) !== ZIP64_EOCD_LOCATOR_SIGNATURE) {
    return null;
  }
  const zip64Offset = readU64(data, eocdOffset - 12);
  if (!Number.isFinite(zip64Offset) || zip64Offset + 56 > data.length) {
    throw new Error(ZIP_INVALID_MESSAGE);
  }
  if (readU32(data, zip64Offset) !== ZIP64_EOCD_SIGNATURE) {
    throw new Error(ZIP_INVALID_MESSAGE);
  }
  return {
    entryCount: readU64(data, zip64Offset + 32),
    cdSize: readU64(data, zip64Offset + 40),
    cdOffset: readU64(data, zip64Offset + 48)
  };
};

const decodeZipName = (bytes: Uint8Array, utf8: boolean): string =>
  new TextDecoder(utf8 ? "utf-8" : "latin1").decode(bytes);

const readZip64ExtraSizes = (
  extra: Uint8Array,
  compressedSize: number,
  uncompressedSize: number,
  localHeaderOffset: number
): { compressedSize: number; uncompressedSize: number; localHeaderOffset: number } => {
  const needUncompressed = uncompressedSize === UINT32_MAX;
  const needCompressed = compressedSize === UINT32_MAX;
  const needOffset = localHeaderOffset === UINT32_MAX;
  if (!needUncompressed && !needCompressed && !needOffset) {
    return { compressedSize, uncompressedSize, localHeaderOffset };
  }
  let cursor = 0;
  while (cursor + 4 <= extra.length) {
    const id = extra[cursor]! | (extra[cursor + 1]! << 8);
    const size = extra[cursor + 2]! | (extra[cursor + 3]! << 8);
    const start = cursor + 4;
    const end = start + size;
    if (end > extra.length) {
      break;
    }
    if (id === ZIP64_EXTRA_ID) {
      let position = start;
      const next = (): number => {
        if (position + 8 > end) {
          throw new Error(ZIP_INVALID_MESSAGE);
        }
        const value = readU64(extra, position);
        position += 8;
        return value;
      };
      return {
        uncompressedSize: needUncompressed ? next() : uncompressedSize,
        compressedSize: needCompressed ? next() : compressedSize,
        localHeaderOffset: needOffset ? next() : localHeaderOffset
      };
    }
    cursor = end;
  }
  throw new Error(ZIP_INVALID_MESSAGE);
};

const assertDeclaredUncompressedSize = (
  name: string,
  uncompressedSize: number,
  limits: ImportResourceLimits
): void => {
  if (!Number.isFinite(uncompressedSize) || uncompressedSize < 0) {
    throw new Error(ZIP_UNCOMPRESSED_TOO_LARGE_MESSAGE);
  }
  if (isConceptsJsonName(name) && uncompressedSize > limits.maxConceptsJsonBytes) {
    throw new Error(ZIP_CONCEPTS_JSON_TOO_LARGE_MESSAGE);
  }
  if (uncompressedSize > limits.maxZipEntryUncompressedBytes) {
    throw new Error(ZIP_UNCOMPRESSED_TOO_LARGE_MESSAGE);
  }
};

const readZipCentralDirectory = (data: Uint8Array, limits: ImportResourceLimits): Map<string, number> => {
  const eocdOffset = findEocdOffset(data);
  if (readU16(data, eocdOffset + 4) !== 0 || readU16(data, eocdOffset + 6) !== 0) {
    throw new Error(ZIP_INVALID_MESSAGE);
  }
  let entryCount = readU16(data, eocdOffset + 10);
  let cdSize = readU32(data, eocdOffset + 12);
  let cdOffset = readU32(data, eocdOffset + 16);
  if (entryCount === UINT16_MAX || cdSize === UINT32_MAX || cdOffset === UINT32_MAX) {
    const zip64 = readZip64Eocd(data, eocdOffset);
    if (zip64) {
      entryCount = zip64.entryCount;
      cdSize = zip64.cdSize;
      cdOffset = zip64.cdOffset;
    } else if (entryCount === UINT16_MAX) {
      throw new Error(ZIP_ENTRY_COUNT_MESSAGE);
    } else {
      throw new Error(ZIP_INVALID_MESSAGE);
    }
  }
  if (!Number.isFinite(entryCount) || entryCount > limits.maxZipEntryCount) {
    throw new Error(ZIP_ENTRY_COUNT_MESSAGE);
  }
  if (!Number.isFinite(cdSize) || !Number.isFinite(cdOffset) || cdOffset > data.length || cdSize > data.length - cdOffset) {
    throw new Error(ZIP_INVALID_MESSAGE);
  }

  const declaredSizes = new Map<string, number>();
  let cursor = cdOffset;
  const cdEnd = cdOffset + cdSize;
  let declaredTotal = 0;
  for (let index = 0; index < entryCount; index += 1) {
    if (cursor + 46 > cdEnd || cursor + 46 > data.length) {
      throw new Error(ZIP_INVALID_MESSAGE);
    }
    if (readU32(data, cursor) !== CENTRAL_DIRECTORY_SIGNATURE) {
      throw new Error(ZIP_INVALID_MESSAGE);
    }
    const flags = readU16(data, cursor + 8);
    const compression = readU16(data, cursor + 10);
    const compressedSizeField = readU32(data, cursor + 20);
    const uncompressedSizeField = readU32(data, cursor + 24);
    const nameLength = readU16(data, cursor + 28);
    const extraLength = readU16(data, cursor + 30);
    const commentLength = readU16(data, cursor + 32);
    const localHeaderOffsetField = readU32(data, cursor + 42);
    const next = cursor + 46 + nameLength + extraLength + commentLength;
    if (next > data.length || next > cdEnd) {
      throw new Error(ZIP_INVALID_MESSAGE);
    }
    if ((flags & 0x1) !== 0 || (compression !== 0 && compression !== 8)) {
      throw new Error(ZIP_INVALID_MESSAGE);
    }
    const name = decodeZipName(data.subarray(cursor + 46, cursor + 46 + nameLength), (flags & 0x800) !== 0);
    if (!name || declaredSizes.has(name)) {
      throw new Error(ZIP_INVALID_MESSAGE);
    }
    const extra = data.subarray(cursor + 46 + nameLength, cursor + 46 + nameLength + extraLength);
    const sizes = readZip64ExtraSizes(extra, compressedSizeField, uncompressedSizeField, localHeaderOffsetField);
    assertDeclaredUncompressedSize(name, sizes.uncompressedSize, limits);
    if (
      !Number.isFinite(sizes.compressedSize) ||
      sizes.compressedSize < 0 ||
      (sizes.compressedSize === 0 && sizes.uncompressedSize !== 0)
    ) {
      throw new Error(ZIP_INVALID_MESSAGE);
    }
    if (sizes.uncompressedSize > limits.maxZipUncompressedBytes - declaredTotal) {
      throw new Error(ZIP_UNCOMPRESSED_TOO_LARGE_MESSAGE);
    }
    declaredTotal += sizes.uncompressedSize;
    if (
      !Number.isFinite(sizes.localHeaderOffset) ||
      sizes.localHeaderOffset > data.length ||
      sizes.compressedSize > data.length - sizes.localHeaderOffset
    ) {
      throw new Error(ZIP_INVALID_MESSAGE);
    }
    if (readU32(data, sizes.localHeaderOffset) !== LOCAL_FILE_HEADER_SIGNATURE) {
      throw new Error(ZIP_INVALID_MESSAGE);
    }
    const localNameLength = readU16(data, sizes.localHeaderOffset + 26);
    const localExtraLength = readU16(data, sizes.localHeaderOffset + 28);
    const dataStart = sizes.localHeaderOffset + 30 + localNameLength + localExtraLength;
    if (dataStart > data.length || sizes.compressedSize > data.length - dataStart) {
      throw new Error(ZIP_INVALID_MESSAGE);
    }
    declaredSizes.set(name, sizes.uncompressedSize);
    cursor = next;
  }
  return declaredSizes;
};

const concatBytes = (parts: Uint8Array[]): Uint8Array => {
  let length = 0;
  for (const part of parts) {
    length += part.length;
  }
  const out = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
};

const inflateZipWithLimits = (
  data: Uint8Array,
  declaredSizes: Map<string, number>,
  limits: ImportResourceLimits,
  hooks?: ZipInflateHooks
): Record<string, Uint8Array> => {
  const unzip = new Unzip();
  unzip.register(UnzipInflate);
  const stored = new Map<string, Uint8Array>();
  let totalUncompressed = 0;
  let streamedEntries = 0;
  let failure: Error | null = null;
  const fail = (message: string): void => {
    if (!failure) {
      failure = new Error(message);
    }
  };

  unzip.onfile = (file) => {
    if (failure) {
      return;
    }
    streamedEntries += 1;
    if (streamedEntries > limits.maxZipEntryCount) {
      fail(ZIP_ENTRY_COUNT_MESSAGE);
      return;
    }
    const declaredSize = declaredSizes.get(file.name);
    const parts: Uint8Array[] = [];
    let actual = 0;
    file.ondata = (error, chunk, final) => {
      if (failure) {
        return;
      }
      if (error || !chunk) {
        fail(ZIP_INVALID_MESSAGE);
        return;
      }
      const chunkLength = chunk.length;
      const nextActual = actual + chunkLength;
      const nextTotal = totalUncompressed + chunkLength;
      const exceedsConcepts = isConceptsJsonName(file.name) && nextActual > limits.maxConceptsJsonBytes;
      const exceedsUncompressed =
        nextActual > limits.maxZipEntryUncompressedBytes || nextTotal > limits.maxZipUncompressedBytes;
      const exceedsDeclared = declaredSize !== undefined && nextActual > declaredSize;
      if (chunkLength > 0 && (exceedsConcepts || exceedsUncompressed || exceedsDeclared)) {
        hooks?.onChunk?.({ name: file.name, chunkBytes: chunkLength, accepted: false });
        if (exceedsConcepts) {
          fail(ZIP_CONCEPTS_JSON_TOO_LARGE_MESSAGE);
        } else if (exceedsUncompressed) {
          fail(ZIP_UNCOMPRESSED_TOO_LARGE_MESSAGE);
        } else {
          fail(ZIP_INVALID_MESSAGE);
        }
        return;
      }
      if (chunkLength > 0) {
        hooks?.onChunk?.({ name: file.name, chunkBytes: chunkLength, accepted: true });
        parts.push(chunk);
        actual = nextActual;
        totalUncompressed = nextTotal;
      }
      if (!final) {
        return;
      }
      if (declaredSize !== undefined && actual !== declaredSize) {
        fail(ZIP_INVALID_MESSAGE);
        return;
      }
      if (stored.has(file.name)) {
        fail(ZIP_INVALID_MESSAGE);
        return;
      }
      stored.set(file.name, concatBytes(parts));
    };
    try {
      file.start();
    } catch {
      fail(ZIP_INVALID_MESSAGE);
    }
  };

  const chunkSize = ZIP_INFLATE_INPUT_CHUNK_BYTES;
  for (let offset = 0; offset < data.length; offset += chunkSize) {
    try {
      unzip.push(data.subarray(offset, Math.min(data.length, offset + chunkSize)), offset + chunkSize >= data.length);
    } catch {
      if (!failure) {
        failure = new Error(ZIP_INVALID_MESSAGE);
      }
      break;
    }
    if (failure) {
      break;
    }
  }
  if (failure) {
    throw failure;
  }

  const files: Record<string, Uint8Array> = {};
  for (const [name, bytes] of stored) {
    files[name] = bytes;
  }
  return files;
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
    const entry = unzipped[key];
    if (entry && entry.length > 0) {
      entries.set(id, entry);
    }
  }
  return entries;
};

export const parseConceptBookZip = (
  buffer: ArrayBuffer,
  overrides?: Partial<ImportResourceLimits>,
  hooks?: ZipInflateHooks
): ParsedConceptBookZip => {
  const limits = resolveImportResourceLimits(overrides);
  const bytes = new Uint8Array(buffer);
  if (bytes.byteLength > limits.maxZipCompressedBytes) {
    throw new Error(ZIP_IMPORT_TOO_LARGE_MESSAGE);
  }
  const declaredSizes = readZipCentralDirectory(bytes, limits);
  const unzipped = inflateZipWithLimits(bytes, declaredSizes, limits, hooks);
  const keys = Object.keys(unzipped);
  const conceptsKey =
    keys.find((key) => key === CONCEPT_BOOK_ZIP_CONCEPTS_ENTRY) ??
    keys.find((key) => key.endsWith(`/${CONCEPT_BOOK_ZIP_CONCEPTS_ENTRY}`));
  const conceptsBytes = conceptsKey ? unzipped[conceptsKey] : undefined;
  if (!conceptsKey || !conceptsBytes) {
    throw new Error("ZIP内に concepts.json がありません。");
  }
  return {
    conceptsText: strFromU8(conceptsBytes),
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
