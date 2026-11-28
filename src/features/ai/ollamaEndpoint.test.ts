import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  OLLAMA_EXTERNAL_CONSENT_STORAGE_KEY,
  assessOllamaBaseUrl,
  getExternalSendConsentUrl,
  grantExternalSendConsent,
  hasExternalSendConsent,
  joinOllamaUrl,
  revokeExternalSendConsent,
  syncExternalSendConsent
} from "./ollamaEndpoint";

const installLocalStorage = () => {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => {
        store.clear();
      }
    }
  });
};

describe("assessOllamaBaseUrl", () => {
  it.each([
    ["http://localhost:11434", "http://localhost:11434"],
    ["http://127.0.0.1:11434", "http://127.0.0.1:11434"],
    ["http://[::1]:11434", "http://[::1]:11434"],
    ["http://[0:0:0:0:0:0:0:1]:11434", "http://[::1]:11434"],
    ["HTTP://LOCALHOST:11434/", "http://localhost:11434"],
    ["  http://127.0.0.1:11434/  ", "http://127.0.0.1:11434"],
    ["http://127.1:11434", "http://127.0.0.1:11434"],
    ["http://2130706433:11434", "http://127.0.0.1:11434"]
  ])("%s はローカル接続", (input, normalizedUrl) => {
    expect(assessOllamaBaseUrl(input)).toEqual({
      ok: true,
      normalizedUrl,
      scope: "local",
      protocol: "http:"
    });
  });

  it("パス付きのローカルURLを正規化する", () => {
    expect(assessOllamaBaseUrl("http://localhost:11434/ollama/")).toMatchObject({
      ok: true,
      normalizedUrl: "http://localhost:11434/ollama",
      scope: "local"
    });
  });

  it.each([
    "https://ollama.example.com",
    "http://192.168.1.10:11434",
    "https://localhost.example.com",
    "https://127.0.0.1.example.com",
    "http://[::ffff:127.0.0.1]:11434"
  ])("%s は外部接続", (input) => {
    const assessed = assessOllamaBaseUrl(input);
    expect(assessed.ok).toBe(true);
    if (assessed.ok) {
      expect(assessed.scope).toBe("external");
    }
  });

  it("IPv4射影IPv6はURL APIの正規化後ホストで外部と判定する", () => {
    expect(assessOllamaBaseUrl("http://[::ffff:127.0.0.1]/")).toMatchObject({
      ok: true,
      normalizedUrl: "http://[::ffff:7f00:1]",
      scope: "external"
    });
  });

  it.each([
    "",
    "   ",
    "javascript:alert(1)",
    "file:///test",
    "data:text/plain,test",
    "ftp://localhost:11434",
    "/api/generate",
    "http://user:pass@example.com",
    "http://user@localhost:11434",
    "http://example.com/a?x=1",
    "http://example.com/a#frag",
    "http://",
    "not a url"
  ])("%s は拒否する", (input) => {
    expect(assessOllamaBaseUrl(input)).toEqual({ ok: false });
  });

  it("APIパスを正規化済みベースへ結合する", () => {
    expect(joinOllamaUrl("http://localhost:11434", "/api/generate")).toBe(
      "http://localhost:11434/api/generate"
    );
    expect(joinOllamaUrl("https://ollama.example.com/proxy", "/api/chat")).toBe(
      "https://ollama.example.com/proxy/api/chat"
    );
  });
});

describe("external send consent", () => {
  beforeEach(() => {
    installLocalStorage();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("初期状態は未同意", () => {
    expect(hasExternalSendConsent("https://ollama.example.com")).toBe(false);
    expect(getExternalSendConsentUrl()).toBeNull();
  });

  it("明示的な同意は正規化済みURLに紐づく", () => {
    expect(grantExternalSendConsent("https://ollama.example.com/")).toBe(true);
    expect(hasExternalSendConsent("https://ollama.example.com")).toBe(true);
    expect(hasExternalSendConsent("https://other.example.com")).toBe(false);
    expect(JSON.parse(localStorage.getItem(OLLAMA_EXTERNAL_CONSENT_STORAGE_KEY) ?? "{}")).toEqual({
      baseUrl: "https://ollama.example.com"
    });
  });

  it("ローカル接続には同意を保存しない", () => {
    expect(grantExternalSendConsent("http://localhost:11434")).toBe(false);
    expect(localStorage.getItem(OLLAMA_EXTERNAL_CONSENT_STORAGE_KEY)).toBeNull();
  });

  it("接続先が変わると以前の同意を無効化する", () => {
    grantExternalSendConsent("https://ollama.example.com");
    syncExternalSendConsent("https://other.example.com");
    expect(hasExternalSendConsent("https://ollama.example.com")).toBe(false);
    expect(hasExternalSendConsent("https://other.example.com")).toBe(false);
  });

  it("同じ正規化URLでは同意を維持する", () => {
    grantExternalSendConsent("https://ollama.example.com");
    syncExternalSendConsent("https://ollama.example.com/");
    expect(hasExternalSendConsent("https://ollama.example.com")).toBe(true);
  });

  it("同意を取り消せる", () => {
    grantExternalSendConsent("http://192.168.1.10:11434");
    revokeExternalSendConsent();
    expect(hasExternalSendConsent("http://192.168.1.10:11434")).toBe(false);
  });

  it("壊れた同意データは未同意として扱う", () => {
    localStorage.setItem(OLLAMA_EXTERNAL_CONSENT_STORAGE_KEY, "{not-json");
    expect(getExternalSendConsentUrl()).toBeNull();
    localStorage.setItem(OLLAMA_EXTERNAL_CONSENT_STORAGE_KEY, JSON.stringify({ granted: true }));
    expect(hasExternalSendConsent("https://ollama.example.com")).toBe(false);
  });
});
