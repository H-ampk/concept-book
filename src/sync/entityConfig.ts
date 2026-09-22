import {
  SYNCABLE_SETTING_KEYS,
  type SyncableSettingKey,
  type SyncEntityType,
  type SyncStrategy
} from "./types";

export const SYNC_STRATEGY_BY_ENTITY: { [T in SyncEntityType]: SyncStrategy } = {
  concept: "versioned",
  contextCard: "versioned",
  quizQuestion: "versioned",
  quizDeck: "versioned",
  quizAttemptLog: "append-only",
  researchReport: "versioned",
  learningMaterial: "versioned",
  conceptSourceAnchor: "versioned",
  setting: "versioned",
  media: "versioned"
};

export const isSyncEntityType = (value: unknown): value is SyncEntityType =>
  value === "concept" ||
  value === "contextCard" ||
  value === "quizQuestion" ||
  value === "quizDeck" ||
  value === "quizAttemptLog" ||
  value === "researchReport" ||
  value === "learningMaterial" ||
  value === "conceptSourceAnchor" ||
  value === "setting" ||
  value === "media";

export const getSyncStrategy = (entityType: SyncEntityType): SyncStrategy =>
  SYNC_STRATEGY_BY_ENTITY[entityType];

/**
 * 明示 allowlist のみ同期可能。未知キーはデフォルト localOnly。
 * AI 設定（local Ollama URL 等）・認証情報は含めない。
 */
export const isSyncableSettingKey = (value: unknown): value is SyncableSettingKey =>
  typeof value === "string" && (SYNCABLE_SETTING_KEYS as readonly string[]).includes(value);

/** 調査済みの localStorage 設定のうち、意図的に同期しないもの */
export const LOCAL_ONLY_SETTING_KEYS = ["aiSettings"] as const;

export type LocalOnlySettingKey = (typeof LOCAL_ONLY_SETTING_KEYS)[number];

/** 同期 allowlist にも localOnly 列挙にも載せない秘密・認証系。未知キーと同じく同期不可 */
export const NEVER_SYNC_SETTING_KEYS = [
  "apiKey",
  "accessToken",
  "refreshToken",
  "supabaseSession",
  "secret",
  "credential"
] as const;

export type SettingSyncPolicy = "syncable" | "localOnly";

export const getSettingSyncPolicy = (key: string): SettingSyncPolicy =>
  isSyncableSettingKey(key) ? "syncable" : "localOnly";
