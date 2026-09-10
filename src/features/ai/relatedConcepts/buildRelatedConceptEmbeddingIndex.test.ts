import { describe, expect, it, vi } from "vitest";
import { AIError } from "../errors";
import type { AIEmbeddingProvider } from "../types";
import { buildRelatedConceptEmbeddingIndex } from "./buildRelatedConceptEmbeddingIndex";
import { MemoryConceptEmbeddingCache } from "./embeddingCache";
import { fingerprintRelatedConceptEmbeddingText } from "./fingerprint";

const providerFrom = (embed: AIEmbeddingProvider["embed"]): AIEmbeddingProvider => ({ embed });

describe("buildRelatedConceptEmbeddingIndex", () => {
  it("一致時は Provider を呼ばず cache を利用する", async () => {
    const cache = new MemoryConceptEmbeddingCache();
    const text = "タイトル: A\n\n定義:\nD\n\n自分の解釈:\nI";
    await cache.putMany([
      {
        conceptId: "c1",
        model: "bge-m3:latest",
        fingerprint: fingerprintRelatedConceptEmbeddingText(text),
        vector: [0.1, 0.2]
      }
    ]);
    const embed = vi.fn(async () => [[9, 9]]);
    const result = await buildRelatedConceptEmbeddingIndex({
      items: [{ conceptId: "c1", text }],
      model: "bge-m3:latest",
      provider: providerFrom(embed),
      cache
    });
    expect(embed).not.toHaveBeenCalled();
    expect(result.embeddings.get("c1")).toEqual([0.1, 0.2]);
    expect(result.failedIds).toEqual([]);
  });

  it("title / definition / myInterpretation 変更と model 変更は cache miss", async () => {
    const cache = new MemoryConceptEmbeddingCache();
    const base = "タイトル: A\n\n定義:\nD\n\n自分の解釈:\nI";
    await cache.putMany([
      {
        conceptId: "c1",
        model: "bge-m3:latest",
        fingerprint: fingerprintRelatedConceptEmbeddingText(base),
        vector: [1, 0]
      }
    ]);
    const embed = vi.fn(async () => [[0, 1]]);

    const titleChanged = await buildRelatedConceptEmbeddingIndex({
      items: [{ conceptId: "c1", text: base.replace("タイトル: A", "タイトル: B") }],
      model: "bge-m3:latest",
      provider: providerFrom(embed),
      cache
    });
    expect(embed).toHaveBeenCalledTimes(1);
    expect(titleChanged.embeddings.get("c1")).toEqual([0, 1]);

    embed.mockClear();
    embed.mockResolvedValue([[0, 2]]);
    const definitionChanged = await buildRelatedConceptEmbeddingIndex({
      items: [{ conceptId: "c1", text: base.replace("定義:\nD", "定義:\nDX") }],
      model: "bge-m3:latest",
      provider: providerFrom(embed),
      cache
    });
    expect(embed).toHaveBeenCalledTimes(1);
    expect(definitionChanged.embeddings.get("c1")).toEqual([0, 2]);

    embed.mockClear();
    embed.mockResolvedValue([[0, 3]]);
    const interpretationChanged = await buildRelatedConceptEmbeddingIndex({
      items: [{ conceptId: "c1", text: base.replace("自分の解釈:\nI", "自分の解釈:\nIX") }],
      model: "bge-m3:latest",
      provider: providerFrom(embed),
      cache
    });
    expect(embed).toHaveBeenCalledTimes(1);
    expect(interpretationChanged.embeddings.get("c1")).toEqual([0, 3]);

    embed.mockClear();
    embed.mockResolvedValue([[3, 0]]);
    const modelChanged = await buildRelatedConceptEmbeddingIndex({
      items: [{ conceptId: "c1", text: base }],
      model: "nomic-embed-text",
      provider: providerFrom(embed),
      cache
    });
    expect(embed).toHaveBeenCalledTimes(1);
    expect(modelChanged.embeddings.get("c1")).toEqual([3, 0]);
  });

  it("複数Conceptをまとめて embed し、batch size 超過時は分割する", async () => {
    const cache = new MemoryConceptEmbeddingCache();
    const calls: Array<string | string[]> = [];
    const embed = vi.fn(async (input: string | string[]) => {
      calls.push(input);
      const texts = Array.isArray(input) ? input : [input];
      return texts.map((_, index) => [index + 1, 0]);
    });
    const items = Array.from({ length: 5 }, (_, index) => ({
      conceptId: `c${index + 1}`,
      text: `タイトル: C${index + 1}\n\n定義:\n（なし）\n\n自分の解釈:\n（なし）`
    }));
    const result = await buildRelatedConceptEmbeddingIndex({
      items,
      model: "bge-m3:latest",
      provider: providerFrom(embed),
      cache,
      batchSize: 2
    });
    expect(calls).toEqual([
      [items[0]?.text, items[1]?.text],
      [items[2]?.text, items[3]?.text],
      [items[4]?.text]
    ]);
    expect(result.embeddings.get("c1")).toEqual([1, 0]);
    expect(result.embeddings.get("c2")).toEqual([2, 0]);
    expect(result.embeddings.get("c5")).toEqual([1, 0]);
  });

  it("stale な Concept だけ再 Embedding する", async () => {
    const cache = new MemoryConceptEmbeddingCache();
    const fresh = "タイトル: A\n\n定義:\nD\n\n自分の解釈:\nI";
    const stale = "タイトル: B\n\n定義:\nD\n\n自分の解釈:\nI";
    await cache.putMany([
      {
        conceptId: "fresh",
        model: "bge-m3:latest",
        fingerprint: fingerprintRelatedConceptEmbeddingText(fresh),
        vector: [1, 0]
      },
      {
        conceptId: "stale",
        model: "bge-m3:latest",
        fingerprint: "old-fingerprint",
        vector: [0, 1]
      }
    ]);
    const embed = vi.fn(async (input: string | string[]) => {
      const texts = Array.isArray(input) ? input : [input];
      return texts.map(() => [0.5, 0.5]);
    });
    const result = await buildRelatedConceptEmbeddingIndex({
      items: [
        { conceptId: "fresh", text: fresh },
        { conceptId: "stale", text: stale }
      ],
      model: "bge-m3:latest",
      provider: providerFrom(embed),
      cache
    });
    expect(embed).toHaveBeenCalledTimes(1);
    expect(embed.mock.calls[0]?.[0]).toEqual([stale]);
    expect(result.embeddings.get("fresh")).toEqual([1, 0]);
    expect(result.embeddings.get("stale")).toEqual([0.5, 0.5]);
  });

  it("一部異常でも他の Concept の Embedding は返す", async () => {
    const cache = new MemoryConceptEmbeddingCache();
    const embed = vi.fn(async (input: string | string[]) => {
      const texts = Array.isArray(input) ? input : [input];
      if (texts.length > 1) {
        throw new AIError("invalid-response", "malformed");
      }
      if (texts[0]?.includes("bad")) {
        throw new AIError("invalid-response", "malformed");
      }
      return [[1, 0]];
    });
    const result = await buildRelatedConceptEmbeddingIndex({
      items: [
        { conceptId: "ok", text: "タイトル: ok\n\n定義:\n（なし）\n\n自分の解釈:\n（なし）" },
        { conceptId: "bad", text: "タイトル: bad\n\n定義:\n（なし）\n\n自分の解釈:\n（なし）" }
      ],
      model: "bge-m3:latest",
      provider: providerFrom(embed),
      cache,
      batchSize: 32
    });
    expect(result.embeddings.get("ok")).toEqual([1, 0]);
    expect(result.embeddings.has("bad")).toBe(false);
    expect(result.failedIds).toEqual(["bad"]);
  });

  it("存在しない Concept の cache は検索対象に使わない", async () => {
    const cache = new MemoryConceptEmbeddingCache();
    await cache.putMany([
      {
        conceptId: "gone",
        model: "bge-m3:latest",
        fingerprint: fingerprintRelatedConceptEmbeddingText("gone"),
        vector: [1, 0]
      }
    ]);
    const embed = vi.fn(async () => [[0, 1]]);
    const result = await buildRelatedConceptEmbeddingIndex({
      items: [{ conceptId: "alive", text: "タイトル: alive\n\n定義:\n（なし）\n\n自分の解釈:\n（なし）" }],
      model: "bge-m3:latest",
      provider: providerFrom(embed),
      cache,
      existingConceptIds: new Set(["alive"])
    });
    expect(result.embeddings.has("gone")).toBe(false);
    const remaining = await cache.getAll();
    expect(remaining.some((entry) => entry.conceptId === "gone")).toBe(false);
  });
});
