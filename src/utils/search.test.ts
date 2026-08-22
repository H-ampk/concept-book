import { describe, expect, it } from "vitest";
import {
  extractMatchingSentence,
  includesNormalized,
  splitHighlightedSegments
} from "./search";

describe("search utils", () => {
  it("lowercase と NFKC で一致する", () => {
    expect(includesNormalized("ＡＢＣ 定義", "abc")).toBe(true);
    expect(includesNormalized("Mixed CASE", "mixed case")).toBe(true);
  });

  it("連続空白を正規化して一致する", () => {
    expect(includesNormalized("人は  権威  に従う", "人は 権威 に従う")).toBe(true);
  });

  it("検索語を含む一文だけを返す", () => {
    expect(
      extractMatchingSentence("最初の文です。ここには検索語があります。最後の文です。", "検索語")
    ).toBe("ここには検索語があります。");
  });

  it("改行を文境界として扱う", () => {
    expect(extractMatchingSentence("前の段落\n検索語を含む行です\n次の段落", "検索語")).toBe(
      "検索語を含む行です"
    );
  });

  it("長い一文は検索語の前後へ切り詰める", () => {
    const long = `${"あ".repeat(80)}検索語${"い".repeat(80)}`;
    const snippet = extractMatchingSentence(long, "検索語");
    expect(snippet.startsWith("…")).toBe(true);
    expect(snippet.endsWith("…")).toBe(true);
    expect(snippet.includes("検索語")).toBe(true);
    expect(snippet.length).toBeLessThan(long.length);
  });

  it("ハイライト分割が正規化一致位置と対応する", () => {
    const segments = splitHighlightedSegments("人は強い権威への服従を示す", "権威");
    expect(segments.some((segment) => segment.mark && segment.text === "権威")).toBe(true);
  });
});
