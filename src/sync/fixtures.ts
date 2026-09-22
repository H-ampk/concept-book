import { QUIZ_ATTEMPT_LOG_SCHEMA_VERSION, QUIZ_DECK_SCHEMA_VERSION, QUIZ_QUESTION_SCHEMA_VERSION } from "../types/quiz";
import type { Concept } from "../types/concept";
import type { ConceptSourceAnchor } from "../types/conceptSourceAnchor";
import type { ContextCard } from "../types/contextCard";
import type { LearningMaterial } from "../types/learningMaterial";
import type { QuizAttemptLog, QuizDeck, QuizQuestion } from "../types/quiz";
import { DATA_LAB_ANALYSIS_SNAPSHOT_SCHEMA_VERSION, type ResearchReport } from "../types/researchReport";
import { DEFAULT_DATA_LAB_FILTERS } from "../utils/dataLab/filterDataLabLogs";
import type { SyncableMediaMetadata } from "./types";

export const ISO = "2026-03-01T12:00:00.000Z";
export const OWNER = "user-auth-uid-1";

export const sampleConcept = (): Concept => ({
  id: "concept_existing_keep",
  title: "エントロピー",
  definition: "不確かさの尺度",
  myInterpretation: "情報量",
  domainTags: ["情報理論"],
  researchTags: [],
  relatedIds: [],
  prerequisiteIds: [],
  source: { book: "", page: "", author: null },
  notes: "",
  status: "active",
  favorite: false,
  createdAt: ISO,
  updatedAt: ISO
});

export const sampleContextCard = (): ContextCard => ({
  id: "context_existing_keep",
  title: "通信路",
  domainTags: ["情報理論"],
  centralQuestion: "なぜ符号化するか",
  background: "",
  flow: "",
  keyConcepts: "エントロピー",
  linkedConcepts: ["concept_existing_keep"],
  createdAt: ISO,
  updatedAt: ISO
});

export const sampleQuizQuestion = (): QuizQuestion => ({
  id: "quiz_existing_keep",
  questionType: "multiple-choice",
  prompt: "エントロピーとは",
  choices: [
    { id: "c1", text: "不確かさ" },
    { id: "c2", text: "電圧" }
  ],
  correctChoiceId: "c1",
  visibility: "private",
  schemaVersion: QUIZ_QUESTION_SCHEMA_VERSION,
  createdAt: ISO,
  updatedAt: ISO
});

export const sampleQuizDeck = (): QuizDeck => ({
  id: "deck_existing_keep",
  title: "情報理論",
  questionIds: ["quiz_existing_keep"],
  visibility: "private",
  schemaVersion: QUIZ_DECK_SCHEMA_VERSION,
  createdAt: ISO,
  updatedAt: ISO
});

export const sampleQuizAttemptLog = (): QuizAttemptLog => ({
  id: "qlog_existing_keep",
  questionId: "quiz_existing_keep",
  questionType: "multiple-choice",
  questionPromptSnapshot: "エントロピーとは",
  selectedChoiceId: "c1",
  selectedChoiceTextSnapshot: "不確かさ",
  correctChoiceId: "c1",
  correctChoiceTextSnapshot: "不確かさ",
  correct: true,
  startedAt: ISO,
  answeredAt: ISO,
  timeMs: 1200,
  schemaVersion: QUIZ_ATTEMPT_LOG_SCHEMA_VERSION
});

export const sampleResearchReport = (): ResearchReport => ({
  id: "research_existing_keep",
  title: "分析",
  blocks: [
    {
      id: "rblock_1",
      type: "data-lab-analysis",
      snapshot: {
        schemaVersion: DATA_LAB_ANALYSIS_SNAPSHOT_SCHEMA_VERSION,
        createdAt: ISO,
        source: "data-lab",
        filters: { ...DEFAULT_DATA_LAB_FILTERS },
        filterChips: [],
        filterLabels: [],
        groupBy: "concept",
        metric: "accuracy",
        displayMode: "table",
        sourceLogCount: 0,
        rows: [],
        totalRowCount: 0,
        savedRowCount: 0,
        truncated: false
      },
      commentary: ""
    }
  ],
  createdAt: ISO,
  updatedAt: ISO
});

export const sampleLearningMaterial = (): LearningMaterial => ({
  id: "material_existing_keep",
  contextCardId: "context_existing_keep",
  type: "pdf",
  title: "資料",
  fileName: "notes.pdf",
  mimeType: "application/pdf",
  fileSize: 1024,
  createdAt: ISO,
  updatedAt: ISO
});

export const sampleAnchor = (): ConceptSourceAnchor => ({
  id: "anchor_existing_keep",
  materialId: "material_existing_keep",
  conceptId: "concept_existing_keep",
  pageIndex: 0,
  rects: [{ x: 0.1, y: 0.1, width: 0.2, height: 0.05 }],
  createdAt: ISO,
  updatedAt: ISO
});

export const sampleMediaMetadata = (): SyncableMediaMetadata => ({
  id: "media_existing_keep",
  conceptId: "concept_existing_keep",
  kind: "image",
  mimeType: "image/png",
  fileName: "fig.png",
  fileSize: 10,
  createdAt: ISO,
  updatedAt: ISO
});
