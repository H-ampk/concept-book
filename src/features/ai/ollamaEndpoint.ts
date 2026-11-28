import { AIError } from "./errors";

/**
 * Hostnames the WHATWG URL parser yields for loopback.
 * Compared only after `new URL`, so `localhost.example.com` stays external
 * and alternate loopback spellings that the parser rewrites (for example
 * `127.1` or `[0:0:0:0:0:0:0:1]`) follow the actual connection target.
 */
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

export const OLLAMA_EXTERNAL_CONSENT_STORAGE_KEY = "concept-book-ai-external-consent";

export type OllamaBaseUrlAssessment =
  | {
      ok: true;
      normalizedUrl: string;
      scope: "local" | "external";
      protocol: "http:" | "https:";
    }
  | { ok: false };

type StoredConsent = {
  baseUrl: string;
};

export const assessOllamaBaseUrl = (value: unknown): OllamaBaseUrlAssessment => {
  if (typeof value !== "string") {
    return { ok: false };
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return { ok: false };
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false };
  }
  if (url.username !== "" || url.password !== "") {
    return { ok: false };
  }
  if (url.search !== "" || url.hash !== "") {
    return { ok: false };
  }
  if (url.hostname.length === 0) {
    return { ok: false };
  }

  const pathname = url.pathname.replace(/\/+$/, "");
  const normalizedUrl = `${url.origin}${pathname}`;
  const scope = LOCAL_HOSTNAMES.has(url.hostname) ? "local" : "external";
  return {
    ok: true,
    normalizedUrl,
    scope,
    protocol: url.protocol
  };
};

export const joinOllamaUrl = (normalizedBase: string, path: string): string => {
  const base = normalizedBase.endsWith("/") ? normalizedBase : `${normalizedBase}/`;
  const relative = path.startsWith("/") ? path.slice(1) : path;
  return new URL(relative, base).href;
};

const readConsent = (): StoredConsent | null => {
  try {
    if (typeof localStorage === "undefined") {
      return null;
    }
    const raw = localStorage.getItem(OLLAMA_EXTERNAL_CONSENT_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    const baseUrl = (parsed as { baseUrl?: unknown }).baseUrl;
    const assessed = assessOllamaBaseUrl(baseUrl);
    if (!assessed.ok || assessed.scope !== "external" || assessed.normalizedUrl !== baseUrl) {
      return null;
    }
    return { baseUrl: assessed.normalizedUrl };
  } catch {
    return null;
  }
};

export const getExternalSendConsentUrl = (): string | null => readConsent()?.baseUrl ?? null;

export const hasExternalSendConsent = (baseUrl: string): boolean => {
  const assessed = assessOllamaBaseUrl(baseUrl);
  if (!assessed.ok || assessed.scope !== "external") {
    return false;
  }
  return readConsent()?.baseUrl === assessed.normalizedUrl;
};

export const grantExternalSendConsent = (baseUrl: string): boolean => {
  const assessed = assessOllamaBaseUrl(baseUrl);
  if (!assessed.ok || assessed.scope !== "external") {
    return false;
  }
  try {
    localStorage.setItem(
      OLLAMA_EXTERNAL_CONSENT_STORAGE_KEY,
      JSON.stringify({ baseUrl: assessed.normalizedUrl })
    );
    return true;
  } catch {
    return false;
  }
};

export const revokeExternalSendConsent = (): void => {
  try {
    localStorage.removeItem(OLLAMA_EXTERNAL_CONSENT_STORAGE_KEY);
  } catch {
    // Storage access failure must not break ConceptBook.
  }
};

/** Drop stored consent when it is not for this exact normalized URL. */
export const syncExternalSendConsent = (baseUrl: string): void => {
  const consent = readConsent();
  if (!consent) {
    return;
  }
  const assessed = assessOllamaBaseUrl(baseUrl);
  if (!assessed.ok || assessed.normalizedUrl !== consent.baseUrl) {
    revokeExternalSendConsent();
  }
};

export const assertOllamaRequestAllowed = (baseUrl: string): string => {
  const assessed = assessOllamaBaseUrl(baseUrl);
  if (!assessed.ok) {
    throw new AIError("invalid-endpoint", "Ollamaの接続先URLが不正なため、通信を中止しました。");
  }
  if (assessed.scope === "external" && !hasExternalSendConsent(baseUrl)) {
    throw new AIError(
      "external-consent-required",
      "外部の接続先への送信は、設定画面で許可してから利用できます。"
    );
  }
  return assessed.normalizedUrl;
};
