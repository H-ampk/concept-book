import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { unzipSync } from "fflate";
import { buildConceptBookZip } from "../utils/conceptBookZip";

describe("AI cache は backup / ZIP に混入しない", () => {
  it("IndexedDB storage 実装が AI cache DB を開かない", () => {
    const storageDir = dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(join(storageDir, "indexeddb.ts"), "utf8");
    expect(source).not.toContain("concept-book-ai-cache");
    expect(source).not.toContain("conceptEmbeddings");
  });

  it("ZIP パッケージに AI cache エントリを含めない", () => {
    const json = JSON.stringify({
      concepts: [{ id: "c1", title: "概念" }],
      contextCards: [],
      quizQuestions: [],
      quizDecks: [],
      quizAttemptLogs: []
    });
    const zipped = buildConceptBookZip(json, []);
    const unzipped = unzipSync(zipped);
    expect(Object.keys(unzipped)).toEqual(["concepts.json"]);
    expect(JSON.parse(new TextDecoder().decode(unzipped["concepts.json"]))).not.toHaveProperty(
      "conceptEmbeddings"
    );
    expect(JSON.stringify(unzipped)).not.toContain("concept-book-ai-cache");
  });
});
