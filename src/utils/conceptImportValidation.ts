import { z } from "zod";
import { conceptStatusList, type Concept } from "../types/concept";
import type { ContextCard } from "../types/contextCard";
import type { ConceptMediaRef } from "../types/media";
import type { QuizChoice, QuizQuestion, QuizVisibility } from "../types/quiz";
import { QUIZ_QUESTION_SCHEMA_VERSION } from "../types/quiz";
import { nowIso } from "./date";

const conceptStatusSchema = z.enum(conceptStatusList);

const conceptSourceSchema = z.object({
  book: z.string(),
  page: z.string(),
  author: z.string().nullable()
});

export const conceptMediaRefSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["image", "video"]),
  fileName: z.string(),
  caption: z.string().optional(),
  sortOrder: z.number().int()
});

export const normalizeMediaRefs = (input: unknown): ConceptMediaRef[] => {
  const parsed = z.array(conceptMediaRefSchema).safeParse(Array.isArray(input) ? input : []);
  if (!parsed.success) {
    return [];
  }
  return [...parsed.data].sort((a, b) => a.sortOrder - b.sortOrder);
};

const conceptSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  definition: z.string(),
  myInterpretation: z.string(),
  domainTags: z.array(z.string()),
  researchTags: z.array(z.string()),
  relatedIds: z.array(z.string()),
  media: z.array(conceptMediaRefSchema).optional(),
  source: conceptSourceSchema,
  notes: z.string(),
  status: conceptStatusSchema,
  favorite: z.boolean(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  contextDefinitions: z.array(z.object({
    id: z.string().min(1),
    context: z.string(),
    definition: z.string()
  })).optional()
});

const conceptArraySchema = z.array(conceptSchema);

const contextCardSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  domain: z.string().optional(),
  domainTags: z.array(z.string()),
  centralQuestion: z.string(),
  background: z.string(),
  flow: z.string(),
  keyConcepts: z.string(),
  linkedConcepts: z.array(z.string()),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1)
});

const contextCardArraySchema = z.array(contextCardSchema);

/** ZIP / JSON バックアップ用。将来 quizAttemptLogs 等を足す余地あり */
export const quizVisibilitySchema = z.enum(["private", "public"]);

export const quizChoiceSchema = z.object({
  id: z.string().min(1),
  text: z.string(),
  linkedConceptId: z.string().min(1).optional()
});

export const quizQuestionSchema = z.object({
  id: z.string().min(1),
  conceptId: z.string().min(1).optional(),
  prompt: z.string().min(1),
  choices: z.array(quizChoiceSchema),
  correctChoiceId: z.string().min(1),
  explanation: z.string().optional(),
  visibility: quizVisibilitySchema,
  sortOrder: z.number().optional(),
  schemaVersion: z.number(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1)
});

const normalizeQuizChoiceEntry = (entry: unknown): QuizChoice | null => {
  if (!entry || typeof entry !== "object") {
    return null;
  }
  const o = entry as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id.trim() : "";
  const text = typeof o.text === "string" ? o.text : "";
  if (!id) {
    return null;
  }
  const lidRaw = typeof o.linkedConceptId === "string" ? o.linkedConceptId.trim() : "";
  const choice: QuizChoice = { id, text };
  if (lidRaw) {
    choice.linkedConceptId = lidRaw;
  }
  return choice;
};

const normalizeQuizQuestionItem = (item: unknown): QuizQuestion | null => {
  if (!item || typeof item !== "object") {
    return null;
  }
  const raw = item as Record<string, unknown>;
  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  const rawCid = typeof raw.conceptId === "string" ? raw.conceptId.trim() : "";
  const conceptId = rawCid.length > 0 ? rawCid : undefined;
  const prompt = typeof raw.prompt === "string" ? raw.prompt.trim() : "";
  if (!id || !prompt) {
    return null;
  }

  if (!Array.isArray(raw.choices)) {
    return null;
  }
  const choices: QuizChoice[] = [];
  for (const entry of raw.choices) {
    const c = normalizeQuizChoiceEntry(entry);
    if (!c) {
      return null;
    }
    choices.push(c);
  }
  if (choices.length < 2) {
    return null;
  }

  const correctChoiceId = typeof raw.correctChoiceId === "string" ? raw.correctChoiceId.trim() : "";
  if (!correctChoiceId || !choices.some((c) => c.id === correctChoiceId)) {
    return null;
  }

  const visResult = quizVisibilitySchema.safeParse(raw.visibility);
  const visibility: QuizVisibility = visResult.success ? visResult.data : "private";

  const schemaVersion =
    typeof raw.schemaVersion === "number" && Number.isFinite(raw.schemaVersion)
      ? raw.schemaVersion
      : QUIZ_QUESTION_SCHEMA_VERSION;

  const explanation =
    raw.explanation === undefined || raw.explanation === null
      ? undefined
      : String(raw.explanation);

  const sortOrder =
    typeof raw.sortOrder === "number" && Number.isFinite(raw.sortOrder) ? raw.sortOrder : undefined;

  const createdAt =
    typeof raw.createdAt === "string" && raw.createdAt.trim().length > 0 ? raw.createdAt : nowIso();
  const updatedAt =
    typeof raw.updatedAt === "string" && raw.updatedAt.trim().length > 0 ? raw.updatedAt : nowIso();

  const candidate: QuizQuestion = {
    id,
    prompt,
    choices,
    correctChoiceId,
    explanation,
    visibility,
    sortOrder,
    schemaVersion,
    createdAt,
    updatedAt
  };
  if (conceptId) {
    candidate.conceptId = conceptId;
  }

  const parsed = quizQuestionSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
};

export const normalizeQuizQuestionsForBackupImport = (
  input: unknown | undefined
): { questions: QuizQuestion[]; skipped: number } => {
  if (input === undefined) {
    return { questions: [], skipped: 0 };
  }
  if (!Array.isArray(input)) {
    return { questions: [], skipped: 0 };
  }
  const questions: QuizQuestion[] = [];
  let skipped = 0;
  for (const item of input) {
    const q = normalizeQuizQuestionItem(item);
    if (!q) {
      skipped += 1;
      continue;
    }
    questions.push(q);
  }
  return { questions, skipped };
};

const backupObjectSchema = z.object({
  concepts: conceptArraySchema,
  contextCards: contextCardArraySchema.optional(),
  quizQuestions: z
    .unknown()
    .optional()
    .transform((v) => (Array.isArray(v) ? v : undefined))
});

const rawConceptSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    definition: z.string().optional(),
    myInterpretation: z.string().optional(),
    domainTags: z.array(z.string()).optional(),
    researchTags: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
    relatedIds: z.array(z.string()).optional(),
    media: z.array(z.unknown()).optional(),
    source: conceptSourceSchema.partial().optional(),
    notes: z.string().optional(),
    status: conceptStatusSchema.optional(),
    favorite: z.boolean().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
    contextDefinitions: z
      .array(
        z.object({
          id: z.string().optional(),
          context: z.string().optional(),
          label: z.string().optional(),
          definition: z.string().optional(),
          text: z.string().optional()
        })
      )
      .optional()
  })
  .passthrough();

const formatIssue = (issue: z.ZodIssue): string => {
  const path = issue.path.length > 0 ? issue.path.join(".") : "root";
  return `${path}: ${issue.message}`;
};

const normalizeRawConcept = (raw: z.infer<typeof rawConceptSchema>): Concept => {
  const normalizedDomainTags = raw.domainTags ?? raw.tags ?? [];
  const media = normalizeMediaRefs(raw.media);
  const contextDefinitions = (raw.contextDefinitions ?? [])
    .map((item, index) => {
      const context = (item.context ?? item.label ?? "").toString();
      const definition = (item.definition ?? item.text ?? "").toString();
      if (!context.trim() && !definition.trim()) {
        return null;
      }
      return {
        id: item.id?.toString() || `ctx_${index}_${Math.random().toString(36).slice(2, 8)}`,
        context,
        definition
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return {
    id: raw.id,
    title: raw.title,
    definition: raw.definition ?? "",
    myInterpretation: raw.myInterpretation ?? "",
    domainTags: normalizedDomainTags,
    researchTags: raw.researchTags ?? [],
    relatedIds: raw.relatedIds ?? [],
    media: media.length > 0 ? media : undefined,
    source: {
      book: raw.source?.book ?? "",
      page: raw.source?.page ?? "",
      author: raw.source?.author ?? null
    },
    notes: raw.notes ?? "",
    status: raw.status ?? "active",
    favorite: raw.favorite ?? false,
    createdAt: raw.createdAt ?? nowIso(),
    updatedAt: raw.updatedAt ?? nowIso(),
    contextDefinitions
  };
};

export const validateConceptImportPayload = (
  payload: unknown
): { success: true; concepts: Concept[] } | { success: false; errorMessage: string } => {
  const rawArrayResult = z.array(z.unknown()).safeParse(payload);
  if (!rawArrayResult.success) {
    const reason = rawArrayResult.error.issues[0]
      ? formatIssue(rawArrayResult.error.issues[0])
      : "配列形式ではありません。";
    return {
      success: false,
      errorMessage: `JSON形式が不正です（${reason}）。`
    };
  }

  const normalized: Concept[] = [];
  for (let index = 0; index < rawArrayResult.data.length; index += 1) {
    const rawItem = rawArrayResult.data[index];
    const rawItemResult = rawConceptSchema.safeParse(rawItem);
    if (!rawItemResult.success) {
      const reason = rawItemResult.error.issues[0]
        ? formatIssue(rawItemResult.error.issues[0])
        : "必須項目が不足しています。";
      return {
        success: false,
        errorMessage: `項目 ${index + 1} の検証に失敗しました（${reason}）。`
      };
    }

    const normalizedItem = normalizeRawConcept(rawItemResult.data);
    const conceptResult = conceptSchema.safeParse(normalizedItem);
    if (!conceptResult.success) {
      const reason = conceptResult.error.issues[0]
        ? formatIssue(conceptResult.error.issues[0])
        : "Conceptスキーマに一致しません。";
      return {
        success: false,
        errorMessage: `項目 ${index + 1} の検証に失敗しました（${reason}）。`
      };
    }
    normalized.push(conceptResult.data);
  }

  const conceptsResult = conceptArraySchema.safeParse(normalized);
  if (!conceptsResult.success) {
    const reason = conceptsResult.error.issues[0]
      ? formatIssue(conceptsResult.error.issues[0])
      : "配列スキーマの検証に失敗しました。";
    return {
      success: false,
      errorMessage: `インポート配列の検証に失敗しました（${reason}）。`
    };
  }

  return { success: true, concepts: conceptsResult.data };
};

export type BackupImportValidationSuccess = {
  success: true;
  concepts: Concept[];
  contextCards: ContextCard[];
  quizQuestions: QuizQuestion[];
  quizQuestionParseSkipped: number;
};

export const validateBackupImportPayload = (
  payload: unknown
): BackupImportValidationSuccess | { success: false; errorMessage: string } => {
  // Try backup object format first
  const backupResult = backupObjectSchema.safeParse(payload);
  if (backupResult.success) {
    const { questions, skipped } = normalizeQuizQuestionsForBackupImport(backupResult.data.quizQuestions);
    return {
      success: true,
      concepts: backupResult.data.concepts,
      contextCards: backupResult.data.contextCards ?? [],
      quizQuestions: questions,
      quizQuestionParseSkipped: skipped
    };
  }

  // Fallback to legacy concept array format
  const legacyResult = validateConceptImportPayload(payload);
  if (legacyResult.success) {
    return {
      success: true,
      concepts: legacyResult.concepts,
      contextCards: [],
      quizQuestions: [],
      quizQuestionParseSkipped: 0
    };
  }
  return legacyResult;
};
