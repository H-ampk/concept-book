import type { NormalizedRect } from "../../types/conceptSourceAnchor";

const overlapArea = (a: NormalizedRect, b: NormalizedRect): number => {
  const left = Math.max(a.x, b.x);
  const top = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  const w = right - left;
  const h = bottom - top;
  if (w <= 0 || h <= 0) {
    return 0;
  }
  return w * h;
};

export const rectSetsOverlap = (autoRects: NormalizedRect[], manualRects: NormalizedRect[]): boolean => {
  for (const autoRect of autoRects) {
    for (const manualRect of manualRects) {
      if (overlapArea(autoRect, manualRect) > 0) {
        return true;
      }
    }
  }
  return false;
};
