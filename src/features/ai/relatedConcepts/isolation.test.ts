import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("relatedConcepts isolation", () => {
  it("Ollama API を直接呼ばず Storage 書き込み API も持たない", () => {
    const root = dirname(fileURLToPath(import.meta.url));
    const collect = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) {
          return collect(path);
        }
        return entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts") ? [path] : [];
      });

    const files = collect(root);
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source).not.toMatch(/\bcreateConcept\b/);
      expect(source).not.toMatch(/\bupdateConcept\b/);
      expect(source).not.toMatch(/\bdeleteConcept\b/);
      expect(source).not.toMatch(/from ["'][^"']*storage/);
      expect(source).not.toMatch(/\/api\/embed/);
      expect(source).not.toMatch(/\/api\/chat/);
      expect(source).not.toMatch(/ollamaClient/);
    }
  });
});
