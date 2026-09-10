import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppearanceSettingsSection } from "./AppearanceSettingsSection";
import { DARK_THEME_COLORS, LIGHT_THEME_COLORS, ThemeProvider } from "../theme";
import { THEME_SETTINGS_STORAGE_KEY } from "../theme/storage";

describe("AppearanceSettingsSection", () => {
  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.style.cssText = "";
  });

  const renderSection = () =>
    render(
      <ThemeProvider>
        <AppearanceSettingsSection />
      </ThemeProvider>
    );

  it("テーマモードを即時保存する", async () => {
    const user = userEvent.setup();
    renderSection();
    await user.click(screen.getByRole("button", { name: "ダーク" }));
    expect(JSON.parse(localStorage.getItem(THEME_SETTINGS_STORAGE_KEY) ?? "{}")).toMatchObject({
      mode: "dark",
      colors: DARK_THEME_COLORS
    });
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("背景色プリセットを即時反映する", async () => {
    const user = userEvent.setup();
    renderSection();
    await user.click(screen.getByRole("button", { name: "背景色 #182028" }));
    const saved = JSON.parse(localStorage.getItem(THEME_SETTINGS_STORAGE_KEY) ?? "{}") as {
      colors: { background: string };
    };
    expect(saved.colors.background).toBe("#182028");
    expect(document.documentElement.style.getPropertyValue("--theme-background")).toBe("#182028");
  });

  it("テーマカラーを初期値に戻す", async () => {
    const user = userEvent.setup();
    renderSection();
    await user.click(screen.getByRole("button", { name: "背景色 #182028" }));
    await user.click(screen.getByRole("button", { name: "テーマカラーを初期値に戻す" }));
    const saved = JSON.parse(localStorage.getItem(THEME_SETTINGS_STORAGE_KEY) ?? "{}") as {
      colors: typeof LIGHT_THEME_COLORS;
    };
    expect(saved.colors).toEqual(LIGHT_THEME_COLORS);
  });

  it("system は OS の prefers-color-scheme 変更に追従する", async () => {
    let listener: ((event: MediaQueryListEvent) => void) | undefined;
    const mql = {
      matches: false,
      media: "(prefers-color-scheme: dark)",
      addEventListener: (_type: string, cb: (event: MediaQueryListEvent) => void) => {
        listener = cb;
      },
      removeEventListener: () => {
        listener = undefined;
      }
    };
    vi.stubGlobal("matchMedia", (query: string) =>
      query.includes("prefers-color-scheme: dark") ? mql : { matches: false, addEventListener: () => undefined, removeEventListener: () => undefined }
    );
    localStorage.setItem(
      THEME_SETTINGS_STORAGE_KEY,
      JSON.stringify({ mode: "system", colors: LIGHT_THEME_COLORS })
    );
    renderSection();
    expect(document.documentElement.dataset.theme).toBe("light");
    mql.matches = true;
    listener?.({ matches: true } as MediaQueryListEvent);
    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe("dark");
    });
    vi.unstubAllGlobals();
  });
});
