import type { NormalizedRect } from "../../types/conceptSourceAnchor";

export type PageBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type ClientRectLike = {
  left: number;
  top: number;
  width: number;
  height: number;
};

const EPS = 1e-6;

export const clamp01 = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
};

export const isValidNormalizedRect = (rect: NormalizedRect): boolean => {
  if (
    !Number.isFinite(rect.x) ||
    !Number.isFinite(rect.y) ||
    !Number.isFinite(rect.width) ||
    !Number.isFinite(rect.height)
  ) {
    return false;
  }
  if (rect.x < -EPS || rect.y < -EPS || rect.width < -EPS || rect.height < -EPS) {
    return false;
  }
  if (rect.x > 1 + EPS || rect.y > 1 + EPS || rect.width > 1 + EPS || rect.height > 1 + EPS) {
    return false;
  }
  if (rect.x + rect.width > 1 + EPS || rect.y + rect.height > 1 + EPS) {
    return false;
  }
  return rect.width > EPS && rect.height > EPS;
};

export const normalizeClientRect = (rect: ClientRectLike, page: PageBox): NormalizedRect | null => {
  if (page.width <= 0 || page.height <= 0) {
    return null;
  }
  const x = clamp01((rect.left - page.left) / page.width);
  const y = clamp01((rect.top - page.top) / page.height);
  const right = clamp01((rect.left + rect.width - page.left) / page.width);
  const bottom = clamp01((rect.top + rect.height - page.top) / page.height);
  const width = Math.max(0, right - x);
  const height = Math.max(0, bottom - y);
  const normalized: NormalizedRect = { x, y, width, height };
  return isValidNormalizedRect(normalized) ? normalized : null;
};

export const normalizeSelectionRects = (
  rects: ClientRectLike[],
  page: PageBox
): NormalizedRect[] => {
  const candidates = rects.filter((rect) => rect.width > 0 && rect.height > 0);
  if (candidates.length === 0) {
    return [];
  }
  const heights = [...candidates.map((rect) => rect.height)].sort((a, b) => a - b);
  const medianHeight = heights[Math.floor(heights.length / 2)] ?? 0;
  const maxHeight = medianHeight > 0 ? medianHeight * 2.5 : Number.POSITIVE_INFINITY;
  const result: NormalizedRect[] = [];
  for (const rect of candidates) {
    if (rect.height > maxHeight) {
      continue;
    }
    const normalized = normalizeClientRect(rect, page);
    if (!normalized) {
      continue;
    }
    if (normalized.width * normalized.height > 0.12 || normalized.height > 0.15) {
      continue;
    }
    result.push(normalized);
  }
  return result;
};

export const denormalizeAnchorRects = (
  rects: NormalizedRect[],
  page: PageBox
): ClientRectLike[] => {
  return rects.filter(isValidNormalizedRect).map((rect) => ({
    left: page.left + rect.x * page.width,
    top: page.top + rect.y * page.height,
    width: rect.width * page.width,
    height: rect.height * page.height
  }));
};

export const denormalizeAnchorRectsRelative = (
  rects: NormalizedRect[],
  pageSize: { width: number; height: number }
): ClientRectLike[] =>
  denormalizeAnchorRects(rects, {
    left: 0,
    top: 0,
    width: pageSize.width,
    height: pageSize.height
  });
