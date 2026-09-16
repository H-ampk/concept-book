import { describe, expect, it } from "vitest";
import {
  denormalizeAnchorRects,
  denormalizeAnchorRectsRelative,
  isValidNormalizedRect,
  normalizeSelectionRects
} from "./normalizeSelectionRects";

describe("normalizeSelectionRects", () => {
  const page = { left: 100, top: 50, width: 200, height: 400 };

  it("selection rect をページ相対の 0〜1 に正規化する", () => {
    const rects = normalizeSelectionRects(
      [{ left: 120, top: 90, width: 40, height: 20 }],
      page
    );
    expect(rects[0]?.x).toBeCloseTo(0.1);
    expect(rects[0]?.y).toBeCloseTo(0.1);
    expect(rects[0]?.width).toBeCloseTo(0.2);
    expect(rects[0]?.height).toBeCloseTo(0.05);
  });

  it("複数行 selection を複数 rect として保持する", () => {
    const rects = normalizeSelectionRects(
      [
        { left: 100, top: 50, width: 100, height: 20 },
        { left: 100, top: 80, width: 80, height: 20 }
      ],
      page
    );
    expect(rects).toHaveLength(2);
    expect(rects[0]).toEqual({ x: 0, y: 0, width: 0.5, height: 0.05 });
    expect(rects[1]).toEqual({ x: 0, y: 0.075, width: 0.4, height: 0.05 });
  });

  it("ページ外にはみ出した選択を clamp する", () => {
    const rects = normalizeSelectionRects(
      [{ left: 80, top: 30, width: 40, height: 40 }],
      page
    );
    expect(rects[0]?.x).toBe(0);
    expect(rects[0]?.y).toBe(0);
  });

  it("行高から大きく外れた巨大 rect は捨てる", () => {
    const rects = normalizeSelectionRects(
      [
        { left: 100, top: 50, width: 40, height: 20 },
        { left: 100, top: 50, width: 200, height: 300 }
      ],
      page
    );
    expect(rects).toHaveLength(1);
    expect(rects[0]?.width).toBeCloseTo(0.2);
  });

  it("ページの大部分を覆う巨大 rect は捨てる", () => {
    const rects = normalizeSelectionRects(
      [{ left: 100, top: 50, width: 200, height: 200 }],
      page
    );
    expect(rects).toEqual([]);
  });
});

describe("denormalizeAnchorRects", () => {
  const page = { left: 10, top: 20, width: 100, height: 200 };

  it("normalized rect を viewer 座標へ戻す", () => {
    const rects = denormalizeAnchorRects([{ x: 0.1, y: 0.2, width: 0.25, height: 0.1 }], page);
    expect(rects).toEqual([{ left: 20, top: 60, width: 25, height: 20 }]);
  });

  it("zoom（ページサイズ変化）後も相対位置が同じ", () => {
    const normalized = [{ x: 0.25, y: 0.5, width: 0.2, height: 0.1 }];
    const small = denormalizeAnchorRectsRelative(normalized, { width: 100, height: 200 });
    const large = denormalizeAnchorRectsRelative(normalized, { width: 200, height: 400 });
    expect(small[0]?.left / 100).toBeCloseTo(large[0]!.left / 200);
    expect(small[0]?.top / 200).toBeCloseTo(large[0]!.top / 400);
    expect(small[0]?.width / 100).toBeCloseTo(large[0]!.width / 200);
    expect(small[0]?.height / 200).toBeCloseTo(large[0]!.height / 400);
  });

  it("不正な rect は描画対象から除外する", () => {
    expect(isValidNormalizedRect({ x: -0.1, y: 0, width: 0.2, height: 0.1 })).toBe(false);
    expect(isValidNormalizedRect({ x: 0.9, y: 0, width: 0.2, height: 0.1 })).toBe(false);
    expect(denormalizeAnchorRects([{ x: 0.9, y: 0, width: 0.2, height: 0.1 }], page)).toEqual([]);
  });
});
