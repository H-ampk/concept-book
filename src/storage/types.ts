import type { Concept, ConceptInput } from "../types/concept";
import type { ConceptMediaCommitItem, ConceptMediaRef } from "../types/media";
import type { ContextCard, ContextCardInput } from "../types/contextCard";
import type { QuizAttemptLog, QuizDeck, QuizQuestion } from "../types/quiz";
import type { ResearchReport } from "../types/researchReport";
import type { ConceptSourceAnchor } from "../types/conceptSourceAnchor";
import type { LearningMaterial } from "../types/learningMaterial";

export type BackupExportData = {
  concepts: Concept[];
  contextCards: ContextCard[];
  quizQuestions: QuizQuestion[];
  quizDecks: QuizDeck[];
  quizAttemptLogs: QuizAttemptLog[];
  researchReports: ResearchReport[];
  learningMaterials: LearningMaterial[];
  conceptSourceAnchors: ConceptSourceAnchor[];
};

/** 省略時・true は従来どおり学習ログ全件を含む完全バックアップ */
export type BackupExportOptions = {
  includeQuizAttemptLogs?: boolean;
};

/**
 * JSON backup import 向け。ZIP package から内部呼び出しするときは
 * preserveMediaReferences: true を明示し、Concept の media 参照を残す。
 */
export type BackupImportOptions = {
  preserveMediaReferences?: boolean;
};

/**
 * 既存 Deck へ Question を追加するときに一緒に書く metadata。
 * questionIds は含めない。membership は transaction 内の最新 Deck へ append する。
 */
export type QuizDeckAppendPatch = {
  lastSyncedAt?: string;
  generationFilters?: QuizDeck["generationFilters"];
  generationSummary?: QuizDeck["generationSummary"];
};

// Security note for future sync backends:
// - Keep this interface storage-agnostic so UI never talks directly to remote APIs.
// - When adding cloud sync, enforce auth + transport encryption (HTTPS/TLS) at implementation level.
// - Validate imported payload shape/version and avoid trusting remote data blindly.
// - Consider per-record encryption and audit logging if sensitive notes are synced.
export type ConceptStorage = {
  getAllConcepts: () => Promise<Concept[]>;
  getConceptById: (id: string) => Promise<Concept | undefined>;
  createConcept: (input: ConceptInput) => Promise<Concept>;
  updateConcept: (
    id: string,
    updates: Partial<ConceptInput> & {
      relatedIds?: string[];
      prerequisiteIds?: string[];
      domainTags?: string[];
      researchTags?: string[];
      media?: ConceptMediaRef[];
    }
  ) => Promise<Concept | undefined>;
  saveConceptWithMediaDraft: (args: {
    mode: "create" | "edit";
    conceptId?: string;
    input: ConceptInput | (Partial<ConceptInput> & {
      relatedIds?: string[];
      prerequisiteIds?: string[];
      domainTags?: string[];
      researchTags?: string[];
      media?: ConceptMediaRef[];
    });
    media: ConceptMediaCommitItem[];
  }) => Promise<Concept>;
  saveContextCardWithConceptSync: (args: {
    mode: "create" | "edit";
    contextCardId?: string;
    input: ContextCardInput;
  }) => Promise<{
    card: ContextCard;
    createdCount: number;
    updatedCount: number;
    metadataUpdatedCount: number;
  }>;
  deleteConcept: (id: string) => Promise<void>;
  importConcepts: (
    concepts: Concept[],
    mode: "replace" | "merge"
  ) => Promise<{ imported: number; skipped: number }>;
  exportBackupData: (options?: BackupExportOptions) => Promise<BackupExportData>;
  importBackupData: (
    data: {
      concepts: Concept[];
      contextCards: ContextCard[];
      quizQuestions: QuizQuestion[];
      quizQuestionParseSkipped: number;
      quizDecks: QuizDeck[];
      quizDeckParseSkipped: number;
      quizAttemptLogs: QuizAttemptLog[];
      quizAttemptLogParseSkipped: number;
      /** フィールドなしは旧形式。空配列は新形式の0件バックアップ。 */
      researchReports?: ResearchReport[];
      researchReportParseSkipped?: number;
      learningMaterials?: LearningMaterial[];
      learningMaterialParseSkipped?: number;
      conceptSourceAnchors?: ConceptSourceAnchor[];
      conceptSourceAnchorParseSkipped?: number;
    },
    mode: "replace" | "merge",
    options?: BackupImportOptions
  ) => Promise<{
    importedConcepts: number;
    skippedConcepts: number;
    importedContextCards: number;
    skippedContextCards: number;
    importedQuizQuestions: number;
    skippedQuizQuestions: number;
    importedQuizDecks: number;
    skippedQuizDecks: number;
    importedQuizAttemptLogs: number;
    skippedQuizAttemptLogs: number;
    importedResearchReports: number;
    skippedResearchReports: number;
    importedLearningMaterials: number;
    skippedLearningMaterials: number;
    importedConceptSourceAnchors: number;
    skippedConceptSourceAnchors: number;
  }>;
  /** 画像・動画を保存し、概念の media 参照を更新する */
  addMedia: (input: {
    conceptId: string;
    file: File;
    caption?: string;
  }) => Promise<ConceptMediaRef>;
  deleteMedia: (mediaId: string) => Promise<void>;
  updateMediaCaption: (mediaId: string, caption: string | undefined) => Promise<void>;
  getMediaBlob: (mediaId: string) => Promise<Blob | undefined>;
  /** concepts.json + media/ を含む ZIP */
  exportConceptBookPackage: (
    domainColors?: Record<string, string>,
    options?: BackupExportOptions
  ) => Promise<Blob>;
  importConceptBookPackage: (
    file: File,
    mode: "replace" | "merge"
  ) => Promise<{
    importedConcepts: number;
    skippedConcepts: number;
    importedContextCards: number;
    skippedContextCards: number;
    importedQuizQuestions: number;
    skippedQuizQuestions: number;
    importedQuizDecks: number;
    skippedQuizDecks: number;
    importedQuizAttemptLogs: number;
    skippedQuizAttemptLogs: number;
    importedResearchReports: number;
    skippedResearchReports: number;
    importedMedia: number;
    missingMedia: number;
    importedLearningMaterials: number;
    skippedLearningMaterials: number;
    missingLearningMaterials: number;
    importedConceptSourceAnchors: number;
    skippedConceptSourceAnchors: number;
    domainColors?: Record<string, string>;
  }>;

  getLearningMaterialsByContextCardId: (contextCardId: string) => Promise<LearningMaterial[]>;
  getLearningMaterial: (id: string) => Promise<LearningMaterial | undefined>;
  saveLearningMaterial: (material: LearningMaterial, blob?: Blob) => Promise<void>;
  addLearningMaterialPdf: (input: {
    contextCardId: string;
    file: File;
    title?: string;
  }) => Promise<LearningMaterial>;
  deleteLearningMaterial: (id: string) => Promise<void>;
  saveLearningMaterialBlob: (materialId: string, blob: Blob) => Promise<void>;
  getLearningMaterialBlob: (materialId: string) => Promise<Blob | undefined>;
  getAnchorsByMaterialId: (materialId: string) => Promise<ConceptSourceAnchor[]>;
  getAnchorsByConceptId: (conceptId: string) => Promise<ConceptSourceAnchor[]>;
  saveConceptSourceAnchor: (anchor: ConceptSourceAnchor) => Promise<void>;
  deleteConceptSourceAnchor: (id: string) => Promise<void>;

  /** QuizQuestion（IndexedDB `quizQuestions`）。ZIP の concepts.json にも含める */
  getQuizQuestions: () => Promise<QuizQuestion[]>;
  getQuizQuestionsByConceptId: (conceptId: string) => Promise<QuizQuestion[]>;
  saveQuizQuestion: (question: QuizQuestion) => Promise<void>;
  /** 複数 Question と Deck を同一 transaction で保存する */
  saveQuizQuestionsAndDeck: (questions: QuizQuestion[], deck: QuizDeck) => Promise<void>;
  /** 新規 Question 保存と既存 Deck への membership 追加を同一 transaction で行う */
  saveQuizQuestionAndAppendToDeck: (question: QuizQuestion, deckId: string) => Promise<QuizDeck>;
  /**
   * 複数 Question の保存と、既存 Deck の最新 membership への append を同一 transaction で行う。
   * 呼び出し側の Deck snapshot で questionIds を置き換えない。
   */
  saveQuizQuestionsAndAppendToDeck: (
    questions: QuizQuestion[],
    deckId: string,
    patch?: QuizDeckAppendPatch
  ) => Promise<QuizDeck>;
  deleteQuizQuestion: (id: string) => Promise<void>;
  deleteQuizQuestionsByConceptId: (conceptId: string) => Promise<void>;

  /** QuizDeck（IndexedDB `quizDecks`。自分用 JSON / ZIP バックアップ対象） */
  getQuizDecks: () => Promise<QuizDeck[]>;
  getQuizDeck: (id: string) => Promise<QuizDeck | undefined>;
  getQuizDecksByDeckKey: (deckKey: string) => Promise<QuizDeck[]>;
  /**
   * Deck 全体の置換。新規作成や、呼び出し側が完全な状態を所有する意図的な置換に使う。
   * questionIds の追加・削除・並び替えには使わない。
   */
  saveQuizDeck: (deck: QuizDeck) => Promise<void>;
  /**
   * タイトル・説明・タグ・公開設定を更新する。
   * 既存 Deck では transaction 内の最新 questionIds と生成条件を維持する。
   * 未保存の id のときは Deck を新規作成する。
   */
  saveQuizDeckMetadata: (deck: QuizDeck) => Promise<QuizDeck>;
  /** transaction 内で最新 Deck を読み、未所属の questionIds を末尾へ追加する。 */
  addQuestionsToDeck: (deckId: string, questionIds: string[]) => Promise<QuizDeck>;
  /** transaction 内で最新 Deck を読み、指定 ID だけを外す。 */
  removeQuestionsFromDeck: (deckId: string, questionIds: string[]) => Promise<QuizDeck>;
  /**
   * expectedQuestionIds が最新の questionIds と一致するときだけ並び替える。
   * 一致しなければ QuizDeckMembershipConflictError。追加・削除はしない。
   */
  reorderQuizDeckQuestions: (
    deckId: string,
    expectedQuestionIds: string[],
    nextQuestionIds: string[]
  ) => Promise<QuizDeck>;
  deleteQuizDeck: (id: string) => Promise<void>;
  /** クイズ集と、他集に属さない問題・関連ログを削除する */
  deleteQuizDeckWithContents: (id: string) => Promise<{ deletedQuestionCount: number }>;
  /** どのクイズ集にも参照されていない問題と関連ログを削除する */
  deleteOrphanQuizQuestions: () => Promise<{ deletedQuestionCount: number }>;
  /** クイズ集・問題・回答ログをすべて削除する（概念・文脈カードは残す） */
  deleteAllQuizData: () => Promise<void>;
  deleteQuizAttemptLogsByQuestionIds: (questionIds: string[]) => Promise<void>;
  deleteQuizAttemptLogsByDeckId: (deckId: string) => Promise<void>;

  /** クイズ回答ログ。自分用 JSON / ZIP バックアップ対象 */
  getQuizAttemptLogs: () => Promise<QuizAttemptLog[]>;
  getQuizAttemptLogsByQuestionId: (questionId: string) => Promise<QuizAttemptLog[]>;
  saveQuizAttemptLog: (log: QuizAttemptLog) => Promise<void>;
  deleteQuizAttemptLog: (id: string) => Promise<void>;
  clearQuizAttemptLogs: () => Promise<void>;

  /** 保存済み研究レポート（IndexedDB `researchReports`。JSON / ZIP バックアップ対象） */
  getResearchReports: () => Promise<ResearchReport[]>;
  getResearchReport: (id: string) => Promise<ResearchReport | undefined>;
  saveResearchReport: (report: ResearchReport) => Promise<void>;
};

export type ContextCardStorage = {
  getAllContextCards: () => Promise<ContextCard[]>;
  getContextCardById: (id: string) => Promise<ContextCard | undefined>;
  createContextCard: (input: ContextCardInput) => Promise<ContextCard>;
  updateContextCard: (
    id: string,
    updates: Partial<ContextCardInput>
  ) => Promise<ContextCard | undefined>;
  deleteContextCard: (id: string) => Promise<void>;
  importContextCards: (
    contextCards: ContextCard[],
    mode: "replace" | "merge"
  ) => Promise<{ imported: number; skipped: number }>;
};
