import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_AI_SETTINGS } from "./settings";
import { getAIEmbeddingProvider, getAITextProvider } from "./factory";

describe("AI provider factory", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("Ollama固有クラスを直接生成せずに Provider を取得できる", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/chat")) {
        return new Response(JSON.stringify({ message: { role: "assistant", content: "ok" } }), {
          status: 200
        });
      }
      return new Response(JSON.stringify({ embeddings: [[0.5]] }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const text = getAITextProvider({ ...DEFAULT_AI_SETTINGS, enabled: true });
    const embedding = getAIEmbeddingProvider({ ...DEFAULT_AI_SETTINGS, enabled: true });
    await expect(text.generate({ messages: [{ role: "user", content: "hi" }] })).resolves.toEqual({
      text: "ok"
    });
    await expect(embedding.embed("hello")).resolves.toEqual([[0.5]]);
  });

  it("無効時は fetch せず disabled を返す", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const text = getAITextProvider(DEFAULT_AI_SETTINGS);
    const embedding = getAIEmbeddingProvider(DEFAULT_AI_SETTINGS);
    await expect(text.generate({ messages: [{ role: "user", content: "hi" }] })).rejects.toMatchObject({
      code: "disabled"
    });
    await expect(embedding.embed("hello")).rejects.toMatchObject({ code: "disabled" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("AI layer storage isolation", () => {
  it("ConceptStorage write API を import / 呼び出ししない", () => {
    const aiRoot = dirname(fileURLToPath(import.meta.url));
    const collect = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) {
          return collect(path);
        }
        return entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts") ? [path] : [];
      });

    const files = collect(aiRoot);
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source).not.toMatch(/\bcreateConcept\b/);
      expect(source).not.toMatch(/\bupdateConcept\b/);
      expect(source).not.toMatch(/\bdeleteConcept\b/);
      expect(source).not.toMatch(/from ["'][^"']*storage/);
    }
  });
});
