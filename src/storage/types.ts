import type { Concept, ConceptInput } from "../types/concept";
import type { ConceptMediaRef } from "../types/media";
import type { ContextCard, ContextCardInput } from "../types/contextCard";
import type { QuizAttemptLog, QuizQuestion } from "../types/quiz";

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
      domainTags?: string[];
      researchTags?: string[];
      media?: ConceptMediaRef[];
    }
  ) => Promise<Concept | undefined>;
  deleteConcept: (id: string) => Promise<void>;
  exportConcepts: () => Promise<Concept[]>;
  importConcepts: (
    concepts: Concept[],
    mode: "replace" | "merge"
  ) => Promise<{ imported: number; skipped: number }>;
  exportBackupData: () => Promise<{
    concepts: Concept[];
    contextCards: ContextCard[];
    quizQuestions: QuizQuestion[];
  }>;
  importBackupData: (
    data: {
      concepts: Concept[];
      contextCards: ContextCard[];
      quizQuestions: QuizQuestion[];
      quizQuestionParseSkipped: number;
    },
    mode: "replace" | "merge"
  ) => Promise<{
    importedConcepts: number;
    skippedConcepts: number;
    importedContextCards: number;
    skippedContextCards: number;
    importedQuizQuestions: number;
    skippedQuizQuestions: number;
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
  exportConceptBookPackage: () => Promise<Blob>;
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
    importedMedia: number;
    missingMedia: number;
  }>;

  /** QuizQuestion（IndexedDB `quizQuestions`）。ZIP の concepts.json にも含める */
  getQuizQuestions: () => Promise<QuizQuestion[]>;
  getQuizQuestionsByConceptId: (conceptId: string) => Promise<QuizQuestion[]>;
  saveQuizQuestion: (question: QuizQuestion) => Promise<void>;
  deleteQuizQuestion: (id: string) => Promise<void>;
  deleteQuizQuestionsByConceptId: (conceptId: string) => Promise<void>;

  /** クイズ回答ログ（ZIP 非対象） */
  getQuizAttemptLogs: () => Promise<QuizAttemptLog[]>;
  getQuizAttemptLogsByQuestionId: (questionId: string) => Promise<QuizAttemptLog[]>;
  saveQuizAttemptLog: (log: QuizAttemptLog) => Promise<void>;
  deleteQuizAttemptLog: (id: string) => Promise<void>;
  clearQuizAttemptLogs: () => Promise<void>;
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
