import { z } from "zod";
import type { ConceptSourceAnchor, NormalizedRect } from "../types/conceptSourceAnchor";
import type { LearningMaterial } from "../types/learningMaterial";
import { isValidNormalizedRect } from "./pdf/normalizeSelectionRects";

const isoLike = z.string().min(1);

const normalizedRectSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number()
});

export const learningMaterialSchema = z.object({
  id: z.string().min(1),
  contextCardId: z.string().min(1),
  type: z.literal("pdf"),
  title: z.string(),
  fileName: z.string().min(1),
  mimeType: z.literal("application/pdf"),
  fileSize: z.number().finite().nonnegative(),
  pageCount: z.number().int().positive().optional(),
  fileHash: z.string().min(1).optional(),
  createdAt: isoLike,
  updatedAt: isoLike
});

export const conceptSourceAnchorSchema = z.object({
  id: z.string().min(1),
  materialId: z.string().min(1),
  conceptId: z.string().min(1),
  pageIndex: z.number().int().nonnegative(),
  rects: z.array(normalizedRectSchema).min(1),
  quotedText: z.string().optional(),
  createdAt: isoLike,
  updatedAt: isoLike
});

export const sanitizeNormalizedRects = (rects: NormalizedRect[]): NormalizedRect[] =>
  rects.filter(isValidNormalizedRect);

export const normalizeLearningMaterial = (raw: unknown): LearningMaterial | null => {
  const parsed = learningMaterialSchema.safeParse(raw);
  if (!parsed.success) {
    return null;
  }
  if (parsed.data.fileName.includes("/") || parsed.data.fileName.includes("\\") || parsed.data.fileName.includes("..")) {
    return null;
  }
  if (parsed.data.id.includes("/") || parsed.data.id.includes("\\") || parsed.data.id.includes("..")) {
    return null;
  }
  return parsed.data;
};

export const normalizeConceptSourceAnchor = (raw: unknown): ConceptSourceAnchor | null => {
  const parsed = conceptSourceAnchorSchema.safeParse(raw);
  if (!parsed.success) {
    return null;
  }
  const rects = sanitizeNormalizedRects(parsed.data.rects);
  if (rects.length === 0) {
    return null;
  }
  const quotedText = parsed.data.quotedText?.toString();
  return {
    ...parsed.data,
    rects,
    ...(quotedText && quotedText.length > 0 ? { quotedText } : {})
  };
};

export const normalizeLearningMaterialsForBackupImport = (
  input: unknown | undefined
): { materials: LearningMaterial[]; skipped: number } => {
  if (input === undefined) {
    return { materials: [], skipped: 0 };
  }
  if (!Array.isArray(input)) {
    return { materials: [], skipped: 0 };
  }
  const materials: LearningMaterial[] = [];
  let skipped = 0;
  for (const item of input) {
    const normalized = normalizeLearningMaterial(item);
    if (!normalized) {
      skipped += 1;
      continue;
    }
    materials.push(normalized);
  }
  return { materials, skipped };
};

export const normalizeConceptSourceAnchorsForBackupImport = (
  input: unknown | undefined
): { anchors: ConceptSourceAnchor[]; skipped: number } => {
  if (input === undefined) {
    return { anchors: [], skipped: 0 };
  }
  if (!Array.isArray(input)) {
    return { anchors: [], skipped: 0 };
  }
  const anchors: ConceptSourceAnchor[] = [];
  let skipped = 0;
  for (const item of input) {
    const normalized = normalizeConceptSourceAnchor(item);
    if (!normalized) {
      skipped += 1;
      continue;
    }
    anchors.push(normalized);
  }
  return { anchors, skipped };
};
