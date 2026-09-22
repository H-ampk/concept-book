/**
 * 新規 entity ID 用 helper。既存レコードの ID は変更しない。
 *
 * current main では `prefix_${Date.now().toString(36)}_${Math.random()...}` が散在する。
 * 複数端末衝突を減らすため、新規生成は `prefix_<uuid>` を推奨する。
 * IndexedDB / UI の既存ジェネレータ置換は Issue #70 範囲外（大規模リファクタになるため）。
 */

export const ENTITY_ID_PREFIXES = [
  "concept",
  "context",
  "media",
  "material",
  "anchor",
  "deck",
  "quiz",
  "choice",
  "qlog",
  "session",
  "research",
  "rblock",
  "setting"
] as const;

export type EntityIdPrefix = (typeof ENTITY_ID_PREFIXES)[number];

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const createFallbackUuid = (): string => {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

export const createRandomUuid = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return createFallbackUuid();
};

export const createEntityId = (prefix: EntityIdPrefix): string => `${prefix}_${createRandomUuid()}`;

export const isPrefixedEntityId = (prefix: EntityIdPrefix, id: string): boolean => {
  if (!id.startsWith(`${prefix}_`)) {
    return false;
  }
  const rest = id.slice(prefix.length + 1);
  return UUID_RE.test(rest);
};
