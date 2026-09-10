import { describe, expect, it } from "vitest";
import {
  contrastTextColor,
  deriveActiveColor,
  deriveHoverColor,
  isThemeHexColor,
  mixHex,
  relativeLuminance
} from "./color";

describe("theme color generation", () => {
  it("hover 色は暗い色を明るくする", () => {
    const hover = deriveHoverColor("#202020");
    expect(relativeLuminance(hover)).toBeGreaterThan(relativeLuminance("#202020"));
  });

  it("hover 色は明るい色を暗くする", () => {
    const hover = deriveHoverColor("#FFFFFF");
    expect(relativeLuminance(hover)).toBeLessThan(relativeLuminance("#FFFFFF"));
  });

  it("active 色は指定色より暗い", () => {
    const active = deriveActiveColor("#5E7E93");
    expect(relativeLuminance(active)).toBeLessThan(relativeLuminance("#5E7E93"));
  });

  it("明るい背景には暗い文字を使う", () => {
    expect(contrastTextColor("#FFFFFF")).toBe("#24313A");
    expect(contrastTextColor("#F5F0E8")).toBe("#24313A");
  });

  it("暗い背景には明るい文字を使う", () => {
    expect(contrastTextColor("#202020")).toBe("#F9FBFC");
    expect(contrastTextColor("#182028")).toBe("#F9FBFC");
  });

  it("mixHex は中間色を返す", () => {
    expect(mixHex("#000000", "#FFFFFF", 0.5)).toBe("#808080");
  });

  it("HEX6 のみを受理する", () => {
    expect(isThemeHexColor("#5E7E93")).toBe(true);
    expect(isThemeHexColor("#fff")).toBe(false);
    expect(isThemeHexColor("red")).toBe(false);
    expect(isThemeHexColor("#5E7E93AA")).toBe(false);
  });
});
