import { afterEach, describe, expect, it, vi } from "vitest";
import { applyThemeSettings, getSystemThemeMode, resolveThemeMode } from "./applyTheme";
import { DARK_THEME_COLORS, LIGHT_THEME_COLORS } from "./defaults";
import { loadDomainColorMap, saveDomainColorMap } from "../utils/domainColors";
import { THEME_SETTINGS_STORAGE_KEY, saveThemeSettings } from "./storage";

const sampleSettings = {
  mode: "light" as const,
  colors: {
    background: "#112233",
    header: "#445566",
    button: "#778899",
    selectedButton: "#AABBCC"
  }
};

describe("applyTheme / system", () => {
  afterEach(() => {
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.style.cssText = "";
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("カスタム色を CSS variables に書き込む", () => {
    applyThemeSettings(sampleSettings, "light");
    const style = document.documentElement.style;
    expect(style.getPropertyValue("--theme-background")).toBe("#112233");
    expect(style.getPropertyValue("--theme-header")).toBe("#445566");
    expect(style.getPropertyValue("--theme-button")).toBe("#778899");
    expect(style.getPropertyValue("--theme-button-selected")).toBe("#AABBCC");
    expect(style.getPropertyValue("--theme-button-hover")).toMatch(/^#[0-9A-F]{6}$/);
    expect(style.getPropertyValue("--theme-button-active")).toMatch(/^#[0-9A-F]{6}$/);
    expect(style.getPropertyValue("--theme-button-text")).toMatch(/^#[0-9A-F]{6}$/);
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("OS light / dark を解決する", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("dark"),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined
    }));
    expect(getSystemThemeMode()).toBe("dark");
    expect(resolveThemeMode("system")).toBe("dark");

    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined
    }));
    expect(getSystemThemeMode()).toBe("light");
    expect(resolveThemeMode("system")).toBe("light");
  });

  it("OS 変更へ追従して data-theme を更新できる", () => {
    applyThemeSettings({ mode: "system", colors: LIGHT_THEME_COLORS }, "light");
    expect(document.documentElement.dataset.theme).toBe("light");
    applyThemeSettings({ mode: "system", colors: LIGHT_THEME_COLORS }, "dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.style.getPropertyValue("--theme-background")).toBe(
      DARK_THEME_COLORS.background
    );
  });

  it("テーマ設定を変えても domainColors は変化しない", () => {
    saveDomainColorMap({ 心理学: "#2D6B52" });
    const before = loadDomainColorMap();
    saveThemeSettings({ mode: "dark", colors: DARK_THEME_COLORS });
    applyThemeSettings({ mode: "dark", colors: DARK_THEME_COLORS }, "dark");
    expect(loadDomainColorMap()).toEqual(before);
    expect(localStorage.getItem("concept-book-domain-colors")).toContain("#2D6B52");
    expect(localStorage.getItem(THEME_SETTINGS_STORAGE_KEY)).toContain("dark");
  });

  it("テーマ適用は danger 等の意味色 CSS を上書きしない", () => {
    applyThemeSettings(sampleSettings, "light");
    const style = document.documentElement.style;
    expect(style.getPropertyValue("--danger-red")).toBe("");
    expect(style.getPropertyValue("--status-active")).toBe("");
  });
});
