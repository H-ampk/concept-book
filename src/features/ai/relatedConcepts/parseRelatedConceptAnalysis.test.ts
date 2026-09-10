import { describe, expect, it } from "vitest";
import { parseRelatedConceptAnalysis } from "./parseRelatedConceptAnalysis";

const options = {
  embeddingCandidateIds: new Set(["concept_ok", "concept_dup", "concept_self", "concept_related"]),
  selfId: "concept_self",
  relatedIds: new Set(["concept_related"])
};

describe("parseRelatedConceptAnalysis", () => {
  it("正常 JSON を検証する", () => {
    const parsed = parseRelatedConceptAnalysis(
      JSON.stringify({
        existing: [{ id: "concept_ok", reason: "関連します" }],
        new: [{ title: "現象学", reason: "別の観点" }]
      }),
      options
    );
    expect(parsed.existing).toEqual([{ id: "concept_ok", reason: "関連します" }]);
    expect(parsed.new).toEqual([{ title: "現象学", reason: "別の観点" }]);
  });

  it("markdown code fence 付き JSON を解析する", () => {
    const parsed = parseRelatedConceptAnalysis(
      "```json\n{\"existing\":[{\"id\":\"concept_ok\",\"reason\":\"関連\"}],\"new\":[]}\n```",
      options
    );
    expect(parsed.existing).toEqual([{ id: "concept_ok", reason: "関連" }]);
  });

  it("malformed JSON は invalid-response", () => {
    expect(() => parseRelatedConceptAnalysis("{not json", options)).toThrow(
      expect.objectContaining({ code: "invalid-response" })
    );
  });

  it("候補外 ID / 重複 / self / 既関連 / 空 reason を除外する", () => {
    const parsed = parseRelatedConceptAnalysis(
      JSON.stringify({
        existing: [
          { id: "concept_missing", reason: "幻覚" },
          { id: "concept_ok", reason: "関連" },
          { id: "concept_ok", reason: "重複" },
          { id: "concept_self", reason: "自分" },
          { id: "concept_related", reason: "既関連" },
          { id: "concept_ok2", reason: "" },
          { id: "concept_dup", reason: "   " }
        ],
        new: []
      }),
      options
    );
    expect(parsed.existing).toEqual([{ id: "concept_ok", reason: "関連" }]);
  });

  it("不正な new candidate を除外する", () => {
    const parsed = parseRelatedConceptAnalysis(
      JSON.stringify({
        existing: [],
        new: [
          { title: "", reason: "空" },
          { title: "現象学", reason: "" },
          { title: "現象学", reason: "有効" },
          { title: "現象学", reason: "重複タイトル" },
          { reason: "タイトルなし" },
          { title: "解釈学", reason: "別観点" }
        ]
      }),
      { ...options, currentTitleNormalized: "じつぞんしゅぎ" }
    );
    expect(parsed.new).toEqual([
      { title: "現象学", reason: "有効" },
      { title: "解釈学", reason: "別観点" }
    ]);
  });

  it("既存 Concept と同じタイトルの new は参考候補にしない", () => {
    const parsed = parseRelatedConceptAnalysis(
      JSON.stringify({
        existing: [],
        new: [{ title: "現象学", reason: "既存タイトル" }]
      }),
      { ...options, existingTitlesNormalized: new Set(["現象学"]) }
    );
    expect(parsed.new).toEqual([]);
  });
});
