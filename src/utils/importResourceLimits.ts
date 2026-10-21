/**
 * ZIP / JSON インポートが確保してよいバイト数。
 *
 * 根拠は既存の単体上限（メディア 20 MiB、PDF 50 MiB）と、インポート時に
 * 圧縮バイト列と展開結果を同時に保持するメモリである。チェック済みの
 * 利用者バックアップ実体はリポジトリに無いため、アプリが書き出せる
 * 個人用ライブラリの重い例で頭打ちにする。
 *
 * - JSON 50 MiB: 画像を含まないテキスト。数万件規模の概念・クイズ・学習ログまで届く。
 * - ZIP 圧縮後 200 MiB: `arrayBuffer()` の前に拒否する。PDF を 4 件、または 20 MiB のメディアを約 10 件。
 * - ZIP 展開後 256 MiB: 500 MiB までは取らない。JPEG / MP4 / PDF はほぼ伸びないので、
 *   圧縮後 200 MiB に concepts.json 最大 50 MiB を足した付近が正当な上限。
 * - エントリ 2,000: 概念あたりメディア 24 件なら約 80 概念分。件数検査は展開前。
 * - 1 エントリ 50 MiB: PDF と concepts.json の既存上限。メディア単体は 20 MiB。
 * - concepts.json 50 MiB: JSON インポートと同じメタデータ量。
 *
 * 展開は 64 バイトずつ入力する。DEFLATE の理論最大膨張は約 1032 倍なので、
 * コールバック前の出力はおおむね 64 KiB を超えない。上限を超えた分は保持せず、
 * それ以降の入力は渡さない。
 */
const MiB = 1024 * 1024;

export const MAX_JSON_IMPORT_BYTES = 50 * MiB;
export const MAX_ZIP_COMPRESSED_BYTES = 200 * MiB;
export const MAX_ZIP_UNCOMPRESSED_BYTES = 256 * MiB;
export const MAX_ZIP_ENTRY_COUNT = 2_000;
export const MAX_ZIP_ENTRY_UNCOMPRESSED_BYTES = 50 * MiB;
export const MAX_CONCEPTS_JSON_BYTES = MAX_JSON_IMPORT_BYTES;
export const ZIP_INFLATE_INPUT_CHUNK_BYTES = 64;

export const JSON_IMPORT_TOO_LARGE_MESSAGE =
  "JSONバックアップの容量が上限を超えています。ファイルを確認してください。";
export const ZIP_IMPORT_TOO_LARGE_MESSAGE =
  "ZIPバックアップの容量が上限を超えています。ファイルを確認してください。";
export const ZIP_ENTRY_COUNT_MESSAGE =
  "ZIP内のファイル数が上限を超えています。ファイルを確認してください。";
export const ZIP_UNCOMPRESSED_TOO_LARGE_MESSAGE =
  "ZIPの展開サイズが上限を超えています。ファイルを確認してください。";
export const ZIP_CONCEPTS_JSON_TOO_LARGE_MESSAGE =
  "ZIP内のconcepts.jsonの容量が上限を超えています。ファイルを確認してください。";
export const ZIP_INVALID_MESSAGE = "ZIPファイルの形式が不正です。";
export const ZIP_EXPORT_TOO_LARGE_MESSAGE =
  "バックアップの容量がZIPの上限を超えるため、エクスポートできません。データ量を減らしてください。";
export const ZIP_EXPORT_ENTRY_COUNT_MESSAGE =
  "バックアップ内のファイル数がZIPの上限を超えるため、エクスポートできません。添付ファイル数を減らしてください。";

export type ImportResourceLimits = {
  maxJsonBytes: number;
  maxZipCompressedBytes: number;
  maxZipUncompressedBytes: number;
  maxZipEntryCount: number;
  maxZipEntryUncompressedBytes: number;
  maxConceptsJsonBytes: number;
};

export const DEFAULT_IMPORT_RESOURCE_LIMITS: ImportResourceLimits = {
  maxJsonBytes: MAX_JSON_IMPORT_BYTES,
  maxZipCompressedBytes: MAX_ZIP_COMPRESSED_BYTES,
  maxZipUncompressedBytes: MAX_ZIP_UNCOMPRESSED_BYTES,
  maxZipEntryCount: MAX_ZIP_ENTRY_COUNT,
  maxZipEntryUncompressedBytes: MAX_ZIP_ENTRY_UNCOMPRESSED_BYTES,
  maxConceptsJsonBytes: MAX_CONCEPTS_JSON_BYTES
};

const limitOrDefault = (value: number | undefined, fallback: number): number => {
  if (value === undefined) {
    return fallback;
  }
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error("インポートの容量上限が不正です。");
  }
  return value;
};

export const resolveImportResourceLimits = (
  overrides?: Partial<ImportResourceLimits>
): ImportResourceLimits => ({
  maxJsonBytes: limitOrDefault(overrides?.maxJsonBytes, DEFAULT_IMPORT_RESOURCE_LIMITS.maxJsonBytes),
  maxZipCompressedBytes: limitOrDefault(
    overrides?.maxZipCompressedBytes,
    DEFAULT_IMPORT_RESOURCE_LIMITS.maxZipCompressedBytes
  ),
  maxZipUncompressedBytes: limitOrDefault(
    overrides?.maxZipUncompressedBytes,
    DEFAULT_IMPORT_RESOURCE_LIMITS.maxZipUncompressedBytes
  ),
  maxZipEntryCount: limitOrDefault(overrides?.maxZipEntryCount, DEFAULT_IMPORT_RESOURCE_LIMITS.maxZipEntryCount),
  maxZipEntryUncompressedBytes: limitOrDefault(
    overrides?.maxZipEntryUncompressedBytes,
    DEFAULT_IMPORT_RESOURCE_LIMITS.maxZipEntryUncompressedBytes
  ),
  maxConceptsJsonBytes: limitOrDefault(
    overrides?.maxConceptsJsonBytes,
    DEFAULT_IMPORT_RESOURCE_LIMITS.maxConceptsJsonBytes
  )
});

const utf8ByteLength = (text: string): number => new TextEncoder().encode(text).byteLength;

/**
 * `file.text()` と `JSON.parse()` の前に容量を見る。
 * サイズ超過では本文を読まず、読んだ後も解析前にもう一度見る。
 */
export const readJsonBackupPayload = async (
  file: File,
  overrides?: Partial<ImportResourceLimits>
): Promise<unknown> => {
  const limits = resolveImportResourceLimits(overrides);
  if (!Number.isSafeInteger(file.size) || file.size < 0 || file.size > limits.maxJsonBytes) {
    throw new Error(JSON_IMPORT_TOO_LARGE_MESSAGE);
  }
  const text = await file.text();
  if (text.length > limits.maxJsonBytes || utf8ByteLength(text) > limits.maxJsonBytes) {
    throw new Error(JSON_IMPORT_TOO_LARGE_MESSAGE);
  }
  return JSON.parse(text);
};
