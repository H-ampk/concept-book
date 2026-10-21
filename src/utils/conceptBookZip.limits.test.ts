import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { buildConceptBookZip, parseConceptBookZip } from "./conceptBookZip";
import { validateBackupImportPayload } from "./conceptImportValidation";
import {
  ZIP_CONCEPTS_JSON_TOO_LARGE_MESSAGE,
  ZIP_ENTRY_COUNT_MESSAGE,
  ZIP_IMPORT_TOO_LARGE_MESSAGE,
  ZIP_INVALID_MESSAGE,
  ZIP_UNCOMPRESSED_TOO_LARGE_MESSAGE
} from "./importResourceLimits";

const asArrayBuffer = (bytes: Uint8Array): ArrayBuffer =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);

const readU16 = (data: Uint8Array, offset: number): number => data[offset]! | (data[offset + 1]! << 8);

const readU32 = (data: Uint8Array, offset: number): number =>
  (data[offset]! | (data[offset + 1]! << 8) | (data[offset + 2]! << 16) | (data[offset + 3]! << 24)) >>> 0;

const writeU32 = (data: Uint8Array, offset: number, value: number): void => {
  data[offset] = value & 0xff;
  data[offset + 1] = (value >>> 8) & 0xff;
  data[offset + 2] = (value >>> 16) & 0xff;
  data[offset + 3] = (value >>> 24) & 0xff;
};

const patchDeclaredUncompressedSize = (zip: Uint8Array, name: string, size: number): Uint8Array => {
  const out = new Uint8Array(zip);
  let eocd = -1;
  for (let offset = out.length - 22; offset >= 0; offset -= 1) {
    if (readU32(out, offset) === 0x06054b50 && offset + 22 + readU16(out, offset + 20) === out.length) {
      eocd = offset;
      break;
    }
  }
  if (eocd < 0) {
    throw new Error("EOCD not found");
  }
  const count = readU16(out, eocd + 10);
  let cursor = readU32(out, eocd + 16);
  for (let index = 0; index < count; index += 1) {
    const nameLength = readU16(out, cursor + 28);
    const extraLength = readU16(out, cursor + 30);
    const commentLength = readU16(out, cursor + 32);
    const entryName = new TextDecoder().decode(out.subarray(cursor + 46, cursor + 46 + nameLength));
    if (entryName === name) {
      writeU32(out, cursor + 24, size);
      return out;
    }
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  throw new Error(`entry not found: ${name}`);
};

const legacyConcept = {
  id: "c1",
  title: "旧概念",
  definition: "",
  myInterpretation: "",
  domainTags: [] as string[],
  researchTags: [] as string[],
  relatedIds: [] as string[],
  prerequisiteIds: [] as string[],
  source: { book: "", page: "", author: null },
  notes: "",
  status: "draft" as const,
  favorite: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
};

describe("parseConceptBookZip resource limits", () => {
  it("正常なZIPと旧形式の concepts.json を取り込める", () => {
    const json = JSON.stringify({
      concepts: [legacyConcept],
      contextCards: []
    });
    const media = new Uint8Array([9, 8, 7, 6]);
    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 1, 2]);
    const zipped = buildConceptBookZip(json, [{ id: "m1", data: media }], [{ id: "mat1", data: pdf }]);
    const parsed = parseConceptBookZip(asArrayBuffer(zipped));
    expect(parsed.conceptsText).toBe(json);
    expect(parsed.mediaEntries.get("m1")).toEqual(media);
    expect(parsed.learningMaterialEntries.get("mat1")).toEqual(pdf);
    const validation = validateBackupImportPayload(JSON.parse(parsed.conceptsText));
    expect(validation.success).toBe(true);
    if (validation.success) {
      expect(validation.concepts[0]?.title).toBe("旧概念");
    }

    const nested = zipSync({ "backup/concepts.json": strToU8(json) });
    expect(parseConceptBookZip(asArrayBuffer(nested)).conceptsText).toBe(json);
  });

  it("エントリ数が上限ちょうどなら受け入れ、超過なら展開前に拒否する", () => {
    const files: Record<string, Uint8Array> = {
      "concepts.json": strToU8('{"concepts":[]}')
    };
    for (let index = 0; index < 2; index += 1) {
      files[`media/m${index}`] = strToU8("x");
    }
    const zipped = zipSync(files);
    expect(parseConceptBookZip(asArrayBuffer(zipped), { maxZipEntryCount: 3 }).mediaEntries.size).toBe(2);
    expect(() => parseConceptBookZip(asArrayBuffer(zipped), { maxZipEntryCount: 2 })).toThrow(
      ZIP_ENTRY_COUNT_MESSAGE
    );
  });

  it("圧縮後サイズが上限を超えると展開しない", () => {
    const zipped = buildConceptBookZip('{"concepts":[]}', []);
    expect(() =>
      parseConceptBookZip(asArrayBuffer(zipped), { maxZipCompressedBytes: zipped.byteLength - 1 })
    ).toThrow(ZIP_IMPORT_TOO_LARGE_MESSAGE);
  });

  it("宣言されたエントリ展開サイズが上限を超えると拒否する", () => {
    const zipped = zipSync({
      "concepts.json": strToU8('{"concepts":[]}'),
      "media/big": new Uint8Array(3000)
    });
    expect(() =>
      parseConceptBookZip(asArrayBuffer(zipped), {
        maxZipEntryUncompressedBytes: 2000,
        maxZipUncompressedBytes: 100_000,
        maxConceptsJsonBytes: 100_000
      })
    ).toThrow(ZIP_UNCOMPRESSED_TOO_LARGE_MESSAGE);
  });

  it("宣言された合計展開サイズが上限を超えると拒否する", () => {
    const zipped = zipSync({
      "concepts.json": strToU8('{"concepts":[]}'),
      "media/a": new Uint8Array(1500),
      "media/b": new Uint8Array(1500)
    });
    expect(() =>
      parseConceptBookZip(asArrayBuffer(zipped), {
        maxZipEntryUncompressedBytes: 2000,
        maxZipUncompressedBytes: 2000,
        maxConceptsJsonBytes: 100_000
      })
    ).toThrow(ZIP_UNCOMPRESSED_TOO_LARGE_MESSAGE);
  });

  it("concepts.json の宣言サイズが上限を超えると拒否する", () => {
    const json = JSON.stringify({ concepts: [], note: "x".repeat(80) });
    const zipped = zipSync({ "concepts.json": strToU8(json) });
    const exact = new TextEncoder().encode(json).byteLength;
    expect(parseConceptBookZip(asArrayBuffer(zipped), { maxConceptsJsonBytes: exact }).conceptsText).toBe(json);
    expect(() => parseConceptBookZip(asArrayBuffer(zipped), { maxConceptsJsonBytes: exact - 1 })).toThrow(
      ZIP_CONCEPTS_JSON_TOO_LARGE_MESSAGE
    );
  });

  it("不正なZIPヘッダを安全に拒否する", () => {
    const garbage = new Uint8Array(48);
    garbage[3] = 0x50;
    expect(() => parseConceptBookZip(asArrayBuffer(garbage))).toThrow(ZIP_INVALID_MESSAGE);
  });

  it("壊れたDEFLATEは内部エラー文を出さず拒否する", () => {
    const zipped = new Uint8Array(
      buildConceptBookZip('{"concepts":[]}', [{ id: "m", data: new Uint8Array(400).fill(3) }])
    );
    zipped[Math.min(80, zipped.length - 1)] ^= 0xff;
    expect(() => parseConceptBookZip(asArrayBuffer(zipped))).toThrow(ZIP_INVALID_MESSAGE);
  });

  it("宣言サイズより実際の出力が大きいZIP爆弾は展開を完了せず拒否する", () => {
    const payload = new Uint8Array(200_000);
    const zipped = zipSync({
      "concepts.json": strToU8('{"concepts":[]}'),
      "media/bomb": payload
    });
    const patched = patchDeclaredUncompressedSize(zipped, "media/bomb", 100);
    let seen = 0;
    let accepted = 0;
    expect(() =>
      parseConceptBookZip(
        asArrayBuffer(patched),
        {
          maxZipUncompressedBytes: 1_000_000,
          maxZipEntryUncompressedBytes: 1_000_000,
          maxConceptsJsonBytes: 1_000_000
        },
        {
          onChunk: (event) => {
            if (event.name !== "media/bomb") {
              return;
            }
            seen += event.chunkBytes;
            if (event.accepted) {
              accepted += event.chunkBytes;
            }
          }
        }
      )
    ).toThrow(ZIP_INVALID_MESSAGE);
    expect(accepted).toBe(0);
    expect(seen).toBeGreaterThan(0);
    expect(seen).toBeLessThan(80_000);
  });

  it("宣言サイズを小さく偽ったまま実際の出力が展開上限を超えると拒否する", () => {
    const zipped = zipSync({
      "concepts.json": strToU8('{"concepts":[]}'),
      "media/bomb": new Uint8Array(200_000)
    });
    const patched = patchDeclaredUncompressedSize(zipped, "media/bomb", 100);
    let seen = 0;
    expect(() =>
      parseConceptBookZip(
        asArrayBuffer(patched),
        {
          maxZipUncompressedBytes: 4_000,
          maxZipEntryUncompressedBytes: 4_000,
          maxConceptsJsonBytes: 100_000
        },
        {
          onChunk: (event) => {
            if (event.name === "media/bomb") {
              seen += event.chunkBytes;
            }
          }
        }
      )
    ).toThrow(ZIP_UNCOMPRESSED_TOO_LARGE_MESSAGE);
    expect(seen).toBeGreaterThan(0);
    expect(seen).toBeLessThan(80_000);
  });
});
