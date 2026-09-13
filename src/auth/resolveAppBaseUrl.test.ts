import { describe, expect, it } from "vitest";
import { resolveAppBaseUrl } from "./resolveAppBaseUrl";

describe("resolveAppBaseUrl", () => {
  it("development の BASE_URL=/ では origin の app root を使う", () => {
    expect(
      resolveAppBaseUrl({
        origin: "http://localhost:5173",
        href: "http://localhost:5173/",
        baseURI: "http://localhost:5173/",
        viteBase: "/"
      })
    ).toBe("http://localhost:5173/");
  });

  it("GitHub Pages の相対 base では document.baseURI から app root を算出する", () => {
    expect(
      resolveAppBaseUrl({
        origin: "https://h-ampk.github.io",
        href: "https://h-ampk.github.io/concept-book/?code=pkce-code",
        baseURI: "https://h-ampk.github.io/concept-book/?code=pkce-code",
        viteBase: "./"
      })
    ).toBe("https://h-ampk.github.io/concept-book/");
  });

  it("index.html 配下でもディレクトリ root に正規化する", () => {
    expect(
      resolveAppBaseUrl({
        origin: "https://h-ampk.github.io",
        href: "https://h-ampk.github.io/concept-book/index.html",
        baseURI: "https://h-ampk.github.io/concept-book/index.html",
        viteBase: "./"
      })
    ).toBe("https://h-ampk.github.io/concept-book/");
  });
});
