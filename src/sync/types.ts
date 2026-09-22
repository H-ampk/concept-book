import type { Concept } from "../types/concept";
import type { ConceptSourceAnchor } from "../types/conceptSourceAnchor";
import type { ContextCard } from "../types/contextCard";
import type { LearningMaterial } from "../types/learningMaterial";
import type { MediaKind } from "../types/media";
import type { QuizAttemptLog, QuizDeck, QuizQuestion } from "../types/quiz";
import type { ResearchReport } from "../types/researchReport";
import type { ThemeSettings } from "../theme/types";

/**
 * Private Sync 通信フォーマット自体のスキーマ版。
 * Domain 内の QuizQuestion.schemaVersion 等とは別物。
 *
 * 将来クラウド側が v2 になったとき、v1 クライアントは schemaVersion 不一致で拒否できる。
 */
export const PRIVATE_SYNC_SCHEMA_VERSION = 1 as const;

/**
 * 競合検出用の初期 version。
 * 実際の increment / compare-and-swap は後続 Issue（#71 / #73）で扱う。
 */
export const PRIVATE_SYNC_INITIAL_VERSION = 1 as const;

export type SyncStrategy = "versioned" | "append-only";

/**
 * IndexedDB 上に実在し、Private Sync の対象になりうる entity。
 * media / learningMaterial はメタデータ・参照のみ（Blob / PDF 本体は含めない）。
 */
export const SYNC_ENTITY_TYPES = [
  "concept",
  "contextCard",
  "quizQuestion",
  "quizDeck",
  "quizAttemptLog",
  "researchReport",
  "learningMaterial",
  "conceptSourceAnchor",
  "setting",
  "media"
] as const;

export type SyncEntityType = (typeof SYNC_ENTITY_TYPES)[number];

/**
 * Private Sync メタデータ。
 *
 * ownerUserId はクライアントが保持する所有者の記録であり、
 * クラウド側の認可根拠にしてはならない。将来のサーバーは
 * authenticated session → auth.uid() で owner を判定する（Issue #69 / #82）。
 *
 * metadata.updatedAt は Domain の更新時刻を同期レコードへ写したもので、
 * クラウド操作時刻（将来の syncedAt 等）とは別概念。
 *
 * deviceId は debug / sync log / conflict UI 用。アクセス許可の認証情報ではない。
 *
 * deletedAt があるレコードは tombstone。保持期間・GC・クラウド delete は未実装。
 */
export type SyncMetadata = {
  ownerUserId: string;
  version: number;
  updatedAt: string;
  deletedAt?: string;
  deviceId?: string;
};

/**
 * Concept の media[] は参照メタのみ。こちらは IndexedDB media ストアの
 * レコードから Blob を除いた同期用メタデータ。
 */
export type SyncableMediaMetadata = {
  id: string;
  conceptId: string;
  kind: MediaKind;
  mimeType: string;
  fileName: string;
  fileSize: number;
  caption?: string;
  createdAt: string;
  updatedAt: string;
};

export const SYNCABLE_SETTING_KEYS = ["domainColors", "themeSettings"] as const;
export type SyncableSettingKey = (typeof SYNCABLE_SETTING_KEYS)[number];

export type DomainColorSettingValue = Record<string, string>;

export type SyncableSettingValueMap = {
  domainColors: DomainColorSettingValue;
  themeSettings: ThemeSettings;
};

export type SyncableSettingPayload<K extends SyncableSettingKey = SyncableSettingKey> = {
  key: K;
  value: SyncableSettingValueMap[K];
};

export type SyncDomainDataByType = {
  concept: Concept;
  contextCard: ContextCard;
  quizQuestion: QuizQuestion;
  quizDeck: QuizDeck;
  quizAttemptLog: QuizAttemptLog;
  researchReport: ResearchReport;
  learningMaterial: LearningMaterial;
  conceptSourceAnchor: ConceptSourceAnchor;
  setting: SyncableSettingPayload;
  media: SyncableMediaMetadata;
};

export type PrivateSyncEntityRecord<TType extends SyncEntityType> = {
  schemaVersion: typeof PRIVATE_SYNC_SCHEMA_VERSION;
  id: string;
  entityType: TType;
  strategy: SyncStrategy;
  metadata: SyncMetadata;
  data: SyncDomainDataByType[TType];
};

/**
 * entityType を discriminator にした union。
 * Private Sync Record ≠ Public Concept / Context Card Snapshot。
 * visibility による公開制御はこの型に載せない。
 */
export type PrivateSyncRecord = {
  [TType in SyncEntityType]: PrivateSyncEntityRecord<TType>;
}[SyncEntityType];

export type SyncValidationError = {
  code: string;
  message: string;
  path?: string;
};

export type SyncValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: SyncValidationError };

export type ToPrivateSyncRecordInput<TType extends SyncEntityType> = {
  entityType: TType;
  data: SyncDomainDataByType[TType];
  ownerUserId: string;
  /** 省略時は data.id（setting は data.key） */
  id?: string;
  version?: number;
  /** 省略時は Domain の updatedAt。無い種別は呼び出し側で渡す */
  updatedAt?: string;
  deletedAt?: string;
  deviceId?: string;
};
