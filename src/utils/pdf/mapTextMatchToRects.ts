import type { NormalizedRect } from "../../types/conceptSourceAnchor";
import { isValidNormalizedRect } from "./normalizeSelectionRects";
import type { PdfPageTextIndex } from "./buildPdfPageTextIndex";
import type { ConceptTermMatch } from "./findConceptTermMatches";
import type { PdfTextItemSlice } from "./pdfTextItem";

export type ViewportLike = {
  width: number;
  height: number;
  convertToViewportPoint?: (x: number, y: number) => [number, number] | number[];
};

const toPoint = (viewport: ViewportLike, x: number, y: number): { x: number; y: number } => {
  if (typeof viewport.convertToViewportPoint === "function") {
    const point = viewport.convertToViewportPoint(x, y);
    return { x: point[0] ?? 0, y: point[1] ?? 0 };
  }
  return { x, y };
};

const sliceItemRect = (
  item: PdfTextItemSlice,
  localStart: number,
  localEnd: number,
  viewport: ViewportLike
): NormalizedRect | null => {
  if (localEnd <= localStart || item.str.length === 0 || viewport.width <= 0 || viewport.height <= 0) {
    return null;
  }
  const transform = item.transform ?? [1, 0, 0, 1, 0, 0];
  const e = transform[4] ?? 0;
  const f = transform[5] ?? 0;
  const a = transform[0] ?? 1;
  const b = transform[1] ?? 0;
  const len = item.str.length;
  const startRatio = localStart / len;
  const endRatio = localEnd / len;
  const hypot = Math.hypot(a, b) || 1;
  const dirX = ((a / hypot) * (item.width || 0));
  const dirY = ((b / hypot) * (item.width || 0));
  const x0 = e + dirX * startRatio;
  const y0 = f + dirY * startRatio;
  const x1 = e + dirX * endRatio;
  const y1 = f + dirY * endRatio + (item.height || 0);
  const p1 = toPoint(viewport, x0, y0);
  const p2 = toPoint(viewport, x1, y1);
  const left = Math.min(p1.x, p2.x);
  const top = Math.min(p1.y, p2.y);
  const right = Math.max(p1.x, p2.x);
  const bottom = Math.max(p1.y, p2.y);
  const rect: NormalizedRect = {
    x: left / viewport.width,
    y: top / viewport.height,
    width: (right - left) / viewport.width,
    height: (bottom - top) / viewport.height
  };
  return isValidNormalizedRect(rect) ? rect : null;
};

export const mapTextMatchToRects = (
  index: PdfPageTextIndex,
  match: ConceptTermMatch,
  viewport: ViewportLike
): NormalizedRect[] => {
  const rects: NormalizedRect[] = [];
  for (const item of index.items) {
    const start = Math.max(match.rawStart, item.rawStart);
    const end = Math.min(match.rawEnd, item.rawEnd);
    if (end <= start) {
      continue;
    }
    const mapped = sliceItemRect(item, start - item.rawStart, end - item.rawStart, viewport);
    if (mapped) {
      rects.push(mapped);
    }
  }
  return rects;
};
