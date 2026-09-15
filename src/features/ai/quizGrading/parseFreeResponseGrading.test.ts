import { describe, expect, it } from "vitest";
import { parseFreeResponseGrading } from "./parseFreeResponseGrading";

describe("parseFreeResponseGrading", () => {
  it.each([
    ["correct", "本質的に一致しています。"],
    ["partial", "重要な要素が不足しています。"],
    ["incorrect", "中心的な説明が異なります。"]
  ] as const)("正常 JSON の %s を検証する", (evaluation, reason) => {
    expect(parseFreeResponseGrading(JSON.stringify({ evaluation, reason }))).toEqual({
      evaluation,
      reason
    });
  });

  it("markdown code fence 付き JSON を解析する", () => {
    expect(
      parseFreeResponseGrading('```json\n{"evaluation":"correct","reason":"本質的に一致しています。"}\n```')
    ).toEqual({
      evaluation: "correct",
      reason: "本質的に一致しています。"
    });
  });

  it("<think> ブロックを取り除いて解析する", () => {
    expect(
      parseFreeResponseGrading(
        '<think>内部推論</think>\n{"evaluation":"partial","reason":"重要な要素が不足しています。"}'
      )
    ).toEqual({
      evaluation: "partial",
      reason: "重要な要素が不足しています。"
    });
  });

  it("未知の evaluation は invalid-response", () => {
    expect(() =>
      parseFreeResponseGrading(JSON.stringify({ evaluation: "mostly-correct", reason: "ほぼ正しい" }))
    ).toThrow(expect.objectContaining({ code: "invalid-response" }));
  });

  it("空 reason は invalid-response", () => {
    expect(() => parseFreeResponseGrading(JSON.stringify({ evaluation: "correct", reason: "  " }))).toThrow(
      expect.objectContaining({ code: "invalid-response" })
    );
  });

  it("reason 欠落は invalid-response", () => {
    expect(() => parseFreeResponseGrading(JSON.stringify({ evaluation: "correct" }))).toThrow(
      expect.objectContaining({ code: "invalid-response" })
    );
  });

  it("malformed JSON は invalid-response", () => {
    expect(() => parseFreeResponseGrading("{not json")).toThrow(
      expect.objectContaining({ code: "invalid-response" })
    );
  });

  it("array response は invalid-response", () => {
    expect(() =>
      parseFreeResponseGrading(JSON.stringify([{ evaluation: "correct", reason: "配列" }]))
    ).toThrow(expect.objectContaining({ code: "invalid-response" }));
  });
});
