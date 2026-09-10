import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../index.css"), "utf8");
const lightBlock = css.slice(0, css.indexOf("[data-theme=\"dark\"]"));

describe("card-face-selected tokens", () => {
  it("light の --card-face-selected は --theme-button-selected を参照する", () => {
    expect(lightBlock).toMatch(
      /--card-face-selected:\s*linear-gradient\(\s*145deg,\s*var\(--theme-button-selected\)/
    );
    expect(lightBlock).toMatch(
      /--card-face-selected-hover:\s*linear-gradient\(\s*145deg,\s*var\(--theme-button-selected-hover\)/
    );
    expect(lightBlock).not.toMatch(/--card-face-selected:\s*linear-gradient\(145deg,\s*#5e7e93/);
  });

  it("選択カード面のクラスは theme-selected 系 token を使う", () => {
    expect(css).toMatch(/\.concept-index-item-selected\s*\{[^}]*background:\s*var\(--card-face-selected\)/s);
    expect(css).toMatch(
      /\.concept-index-item-selected \.concept-index-item-title[\s\S]*?color:\s*var\(--theme-button-selected-text\)/
    );
  });
});
