import { describe, expect, it } from "vitest";
import {
  FAR_LABEL_MAX_CHARS,
  FULL_LABEL_SCALE,
  LABEL_ELLIPSIS,
  MEDIUM_LABEL_SCALE,
  getConceptGraphLabelStyle,
  getConceptGraphLabelText
} from "./conceptGraphLod";

const normal = (globalScale: number) =>
  getConceptGraphLabelStyle({
    globalScale,
    isSelected: false,
    isFavorite: false
  });

const selected = (globalScale: number) =>
  getConceptGraphLabelStyle({
    globalScale,
    isSelected: true,
    isFavorite: false
  });

const favorite = (globalScale: number) =>
  getConceptGraphLabelStyle({
    globalScale,
    isSelected: false,
    isFavorite: true
  });

const expectFiniteStyle = (style: ReturnType<typeof getConceptGraphLabelStyle>) => {
  expect(Number.isFinite(style.screenFontSize)).toBe(true);
  expect(Number.isFinite(style.opacity)).toBe(true);
  expect(Number.isFinite(style.fontWeight)).toBe(true);
};

describe("getConceptGraphLabelStyle", () => {
  describe("far (globalScale < 0.8)", () => {
    const globalScale = 0.79;

    it("通常 Concept も表示用 style を返す", () => {
      const style = normal(globalScale);
      expect(style.screenFontSize).toBe(7);
      expect(style.opacity).toBe(0.55);
      expect(style.fontWeight).toBe(400);
    });

    it("opacity は near より低い", () => {
      expect(normal(globalScale).opacity).toBeLessThan(normal(FULL_LABEL_SCALE).opacity);
    });
  });

  describe("medium (0.8 <= globalScale < 1.5)", () => {
    const globalScale = MEDIUM_LABEL_SCALE;

    it("通常 Concept も表示用 style を返す", () => {
      const style = normal(globalScale);
      expect(style.screenFontSize).toBe(9);
      expect(style.opacity).toBe(0.75);
      expect(style.fontWeight).toBe(400);
    });

    it("far より文字サイズが大きい", () => {
      expect(normal(globalScale).screenFontSize).toBeGreaterThan(normal(0.79).screenFontSize);
    });
  });

  describe("near (globalScale >= 1.5)", () => {
    const globalScale = FULL_LABEL_SCALE;

    it("通常 Concept が通常サイズになり opacity が 1 になる", () => {
      const style = normal(globalScale);
      expect(style.screenFontSize).toBe(12);
      expect(style.opacity).toBe(1);
      expect(style.fontWeight).toBe(400);
    });
  });

  describe("selected", () => {
    it("極端な遠景でも十分な文字サイズと opacity 1 で強調する", () => {
      const style = selected(0.01);
      const regular = normal(0.01);
      expect(style.screenFontSize).toBe(12);
      expect(style.opacity).toBe(1);
      expect(style.fontWeight).toBe(600);
      expect(style.screenFontSize).toBeGreaterThan(regular.screenFontSize);
      expect(style.opacity).toBeGreaterThan(regular.opacity);
      expect(style.fontWeight).toBeGreaterThan(regular.fontWeight);
    });
  });

  describe("favorite", () => {
    it("遠景でも非表示にならず通常 Concept より強調される", () => {
      const style = favorite(0.01);
      const regular = normal(0.01);
      expect(style.screenFontSize).toBe(10);
      expect(style.opacity).toBe(0.95);
      expect(style.fontWeight).toBe(600);
      expect(style.screenFontSize).toBeGreaterThan(regular.screenFontSize);
      expect(style.opacity).toBeGreaterThan(regular.opacity);
      expect(style.fontWeight).toBeGreaterThan(regular.fontWeight);
    });
  });

  describe("境界値", () => {
    it("globalScale = 0.8 は medium", () => {
      expect(normal(0.8).screenFontSize).toBe(9);
    });

    it("0.8 直前は far", () => {
      expect(normal(MEDIUM_LABEL_SCALE - 0.0001).screenFontSize).toBe(7);
    });

    it("globalScale = 1.5 は near", () => {
      expect(normal(1.5).screenFontSize).toBe(12);
      expect(normal(1.5).opacity).toBe(1);
    });

    it("1.5 直前は medium", () => {
      expect(normal(FULL_LABEL_SCALE - 0.0001).screenFontSize).toBe(9);
    });
  });

  describe("extreme scale", () => {
    it.each([0.01, 10])("globalScale %s で NaN / Infinity を返さない", (globalScale) => {
      expectFiniteStyle(normal(globalScale));
      expectFiniteStyle(selected(globalScale));
      expectFiniteStyle(favorite(globalScale));
    });
  });
});

const LONG_TITLE = "社会的アイデンティティ理論";
const SHORT_TITLE = "概念";

const labelText = (
  title: string,
  globalScale: number,
  flags?: { isSelected?: boolean; isFavorite?: boolean }
) =>
  getConceptGraphLabelText({
    title,
    globalScale,
    isSelected: flags?.isSelected ?? false,
    isFavorite: flags?.isFavorite ?? false
  });

describe("getConceptGraphLabelText", () => {
  describe("far normal", () => {
    const globalScale = MEDIUM_LABEL_SCALE - 0.0001;

    it("短いタイトルは元タイトル", () => {
      expect(labelText(SHORT_TITLE, globalScale)).toBe(SHORT_TITLE);
    });

    it("境界ちょうど FAR_LABEL_MAX_CHARS は省略しない", () => {
      const exact = "あ".repeat(FAR_LABEL_MAX_CHARS);
      expect(labelText(exact, globalScale)).toBe(exact);
    });

    it("長いタイトルは省略される", () => {
      const truncated = labelText(LONG_TITLE, globalScale);
      expect(truncated).not.toBe(LONG_TITLE);
      expect(truncated.length).toBeLessThan(LONG_TITLE.length + 1);
      expect(truncated.startsWith(LONG_TITLE.slice(0, FAR_LABEL_MAX_CHARS))).toBe(true);
    });

    it("省略後に ellipsis が付く", () => {
      expect(labelText(LONG_TITLE, globalScale).endsWith(LABEL_ELLIPSIS)).toBe(true);
      expect(labelText(LONG_TITLE, globalScale)).toBe(
        `${LONG_TITLE.slice(0, FAR_LABEL_MAX_CHARS)}${LABEL_ELLIPSIS}`
      );
    });
  });

  describe("far selected / favorite", () => {
    const globalScale = 0.01;

    it("長いタイトルでも selected は全文", () => {
      expect(labelText(LONG_TITLE, globalScale, { isSelected: true })).toBe(LONG_TITLE);
    });

    it("長いタイトルでも favorite は全文", () => {
      expect(labelText(LONG_TITLE, globalScale, { isFavorite: true })).toBe(LONG_TITLE);
    });
  });

  describe("medium / near", () => {
    it("medium では長いタイトルも全文", () => {
      expect(labelText(LONG_TITLE, MEDIUM_LABEL_SCALE)).toBe(LONG_TITLE);
    });

    it("near では長いタイトルも全文", () => {
      expect(labelText(LONG_TITLE, FULL_LABEL_SCALE)).toBe(LONG_TITLE);
    });
  });

  describe("LOD 境界との整合", () => {
    it("0.7999 は far のため省略する", () => {
      expect(labelText(LONG_TITLE, 0.7999)).toBe(
        `${LONG_TITLE.slice(0, FAR_LABEL_MAX_CHARS)}${LABEL_ELLIPSIS}`
      );
    });

    it("0.8 は medium のため全文", () => {
      expect(labelText(LONG_TITLE, 0.8)).toBe(LONG_TITLE);
    });
  });
});
