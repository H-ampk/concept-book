const ensureTrailingSlash = (value: string): string => (value.endsWith("/") ? value : `${value}/`);

const isAbsoluteHttpUrl = (value: string): boolean =>
  value.startsWith("http://") || value.startsWith("https://");

export type ResolveAppBaseUrlInput = {
  href?: string;
  origin?: string;
  baseURI?: string;
  viteBase?: string;
};

/**
 * Magic Link の emailRedirectTo 用に、現在のアプリ root の絶対 URL を求める。
 * GitHub Pages の production は Vite `base: "./"` のため、BASE_URL をパスとして固定しない。
 */
export const resolveAppBaseUrl = (input: ResolveAppBaseUrlInput = {}): string => {
  const href = input.href ?? (typeof window !== "undefined" ? window.location.href : "http://localhost/");
  const origin =
    input.origin ?? (typeof window !== "undefined" ? window.location.origin : "http://localhost");
  const baseURI =
    input.baseURI ?? (typeof document !== "undefined" ? document.baseURI : href);
  const viteBase =
    input.viteBase ??
    (typeof import.meta.env?.BASE_URL === "string" ? import.meta.env.BASE_URL : "/");

  try {
    if (isAbsoluteHttpUrl(viteBase)) {
      const absolute = new URL(viteBase);
      absolute.search = "";
      absolute.hash = "";
      return ensureTrailingSlash(absolute.href);
    }

    if (viteBase === "./" || viteBase === "." || viteBase === "") {
      const fromDocument = new URL(".", baseURI || href);
      fromDocument.search = "";
      fromDocument.hash = "";
      return ensureTrailingSlash(fromDocument.href);
    }

    const fromViteBase = new URL(viteBase, `${origin}/`);
    fromViteBase.search = "";
    fromViteBase.hash = "";
    return ensureTrailingSlash(fromViteBase.href);
  } catch {
    return ensureTrailingSlash(`${origin}/`);
  }
};
