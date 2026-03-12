import { z } from "zod";
import { conceptStatusList, type Concept } from "../types/concept";
import { nowIso } from "./date";

const conceptStatusSchema = z.enum(conceptStatusList);

const conceptSourceSchema = z.object({
  book: z.string(),
  page: z.string(),
  author: z.string().nullable()
});

const conceptSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  definition: z.string(),
  myInterpretation: z.string(),
  domainTags: z.array(z.string()),
  researchTags: z.array(z.string()),
  relatedIds: z.array(z.string()),
  source: conceptSourceSchema,
  notes: z.string(),
  status: conceptStatusSchema,
  favorite: z.boolean(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1)
});

const conceptArraySchema = z.array(conceptSchema);

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
    source: conceptSourceSchema.partial().optional(),
    notes: z.string().optional(),
    status: conceptStatusSchema.optional(),
    favorite: z.boolean().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional()
  })
  .passthrough();

const formatIssue = (issue: z.ZodIssue): string => {
  const path = issue.path.length > 0 ? issue.path.join(".") : "root";
  return `${path}: ${issue.message}`;
};

const normalizeRawConcept = (raw: z.infer<typeof rawConceptSchema>): Concept => {
  const normalizedDomainTags = raw.domainTags ?? raw.tags ?? [];
  return {
    id: raw.id,
    title: raw.title,
    definition: raw.definition ?? "",
    myInterpretation: raw.myInterpretation ?? "",
    domainTags: normalizedDomainTags,
    researchTags: raw.researchTags ?? [],
    relatedIds: raw.relatedIds ?? [],
    source: {
      book: raw.source?.book ?? "",
      page: raw.source?.page ?? "",
      author: raw.source?.author ?? null
    },
    notes: raw.notes ?? "",
    status: raw.status ?? "active",
    favorite: raw.favorite ?? false,
    createdAt: raw.createdAt ?? nowIso(),
    updatedAt: raw.updatedAt ?? nowIso()
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
