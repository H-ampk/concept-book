import { describe, expect, it, vi } from "vitest";
import type { AITextProvider } from "../types";
import { analyzeRelatedConceptCandidates } from "./analyzeRelatedConceptCandidates";
import { LLM_CANDIDATE_LIMIT } from "./constants";

const target = {
  id: "concept_self",
  title: "実存主義",
  definition: "人間の存在",
  myInterpretation: "選択"
};

describe("analyzeRelatedConceptCandidates", () => {
  it("Embedding candidate 外の ID を採用せず、上限を守る", async () => {
    const candidates = Array.from({ length: LLM_CANDIDATE_LIMIT + 5 }, (_, index) => ({
      id: `concept_${index}`,
      title: `候補${index}`,
      definition: `定義${index}`,
      similarity: 1 - index / 100
    }));
    const generate = vi.fn(async () => ({
      text: JSON.stringify({
        existing: [
          { id: "hallucinated", reason: "幻覚" },
          { id: "concept_0", reason: "関連0" },
          { id: "concept_99", reason: "範囲外" }
        ],
        new: [{ title: "現象学", reason: "別観点" }]
      })
    }));
    const titlesById = new Map(candidates.map((item) => [item.id, item.title]));
    const similaritiesById = new Map(candidates.map((item) => [item.id, item.similarity]));
    const result = await analyzeRelatedConceptCandidates({
      target,
      candidates,
      textProvider: { generate } satisfies AITextProvider,
      relatedIds: new Set(),
      titlesById,
      similaritiesById
    });

    const prompt = String(generate.mock.calls[0]?.[0]?.messages[1]?.content ?? "");
    expect(generate).toHaveBeenCalledTimes(1);
    expect(prompt).not.toContain("concept_12");
    expect(prompt).not.toContain("notes");
    expect(prompt).not.toContain("ConceptBook全体");
    expect(result.existing).toEqual([
      { conceptId: "concept_0", title: "候補0", similarity: 1, reason: "関連0" }
    ]);
    expect(result.new).toEqual([{ title: "現象学", reason: "別観点" }]);
  });

  it("候補が無いときは LLM を呼ばない", async () => {
    const generate = vi.fn();
    const result = await analyzeRelatedConceptCandidates({
      target,
      candidates: [],
      textProvider: { generate } satisfies AITextProvider,
      relatedIds: new Set(),
      titlesById: new Map(),
      similaritiesById: new Map()
    });
    expect(generate).not.toHaveBeenCalled();
    expect(result).toEqual({ existing: [], new: [] });
  });
});
