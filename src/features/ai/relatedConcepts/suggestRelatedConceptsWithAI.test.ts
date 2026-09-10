import { describe, expect, it, vi } from "vitest";
import { createEmptyConceptInput, type Concept } from "../../../types/concept";
import { AIError } from "../errors";
import type { AIEmbeddingProvider, AITextProvider } from "../types";
import { LLM_CANDIDATE_LIMIT } from "./constants";
import { MemoryConceptEmbeddingCache } from "./embeddingCache";
import { suggestRelatedConceptsWithAI } from "./suggestRelatedConceptsWithAI";

const concept = (overrides: Partial<Concept>): Concept => ({
  ...createEmptyConceptInput(),
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  definition: "",
  myInterpretation: "",
  ...overrides
});

const embeddingProvider = (embed: AIEmbeddingProvider["embed"]): AIEmbeddingProvider => ({ embed });
const textProvider = (generate: AITextProvider["generate"]): AITextProvider => ({ generate });

describe("suggestRelatedConceptsWithAI", () => {
  it("自己と既関連を除外し、LLM に渡す候補数を制限する", async () => {
    const allConcepts = [
      concept({ id: "self", title: "実存主義", definition: "存在", myInterpretation: "選択" }),
      concept({ id: "related", title: "既関連", definition: "存在" }),
      ...Array.from({ length: 15 }, (_, index) =>
        concept({
          id: `c${index}`,
          title: `候補${index}`,
          definition: `存在 ${index}`,
          notes: `秘密${index}`
        })
      )
    ];
    const embed = vi.fn(async (input: string | string[]) => {
      const texts = Array.isArray(input) ? input : [input];
      return texts.map((text) => {
        if (text.includes("実存主義")) {
          return [1, 0];
        }
        if (text.includes("既関連")) {
          return [0.99, 0.01];
        }
        const index = Number(text.match(/候補(\d+)/)?.[1] ?? 0);
        return [1 - index / 100, index / 100];
      });
    });
    const generate = vi.fn(async ({ messages }) => {
      const user = messages.find((message) => message.role === "user")?.content ?? "";
      expect(user).not.toContain("秘密");
      expect(user).not.toContain("notes");
      for (let index = LLM_CANDIDATE_LIMIT; index < 15; index += 1) {
        expect(user).not.toContain(`c${index}`);
      }
      expect(user).not.toContain('"id":"related"');
      expect(user).not.toContain('"id":"self"');
      return {
        text: JSON.stringify({
          existing: [
            { id: "c0", reason: "近い" },
            { id: "hallucinated", reason: "幻覚" }
          ],
          new: [{ title: "現象学", reason: "別観点" }]
        })
      };
    });

    const result = await suggestRelatedConceptsWithAI({
      current: {
        id: "self",
        title: "実存主義",
        definition: "存在",
        myInterpretation: "選択"
      },
      allConcepts,
      selectedIds: ["related"],
      embeddingProvider: embeddingProvider(embed),
      textProvider: textProvider(generate),
      embeddingModel: "bge-m3:latest",
      cache: new MemoryConceptEmbeddingCache()
    });

    expect(result.existing).toEqual([
      { conceptId: "c0", title: "候補0", similarity: expect.any(Number), reason: "近い" }
    ]);
    expect(result.existing[0]?.similarity).toBeGreaterThan(0.9);
    expect(result.new).toEqual([{ title: "現象学", reason: "別観点" }]);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("disabled 時は AIError を投げ、cache だけに閉じない", async () => {
    await expect(
      suggestRelatedConceptsWithAI({
        current: { title: "実存主義", definition: "", myInterpretation: "" },
        allConcepts: [concept({ id: "c1", title: "現象学" })],
        selectedIds: [],
        embeddingProvider: embeddingProvider(async () => {
          throw new AIError("disabled", "AI機能が無効です。設定からローカルAIを有効にしてください。");
        }),
        textProvider: textProvider(async () => ({ text: "{}" })),
        embeddingModel: "bge-m3:latest",
        cache: new MemoryConceptEmbeddingCache()
      })
    ).rejects.toMatchObject({ code: "disabled" });
  });
});
