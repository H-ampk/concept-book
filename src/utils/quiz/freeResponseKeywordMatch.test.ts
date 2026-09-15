import { describe, expect, it } from "vitest";
import {
  matchFreeResponseKeywords,
  normalizeFreeResponseKeywords,
  normalizeKeywordForComparison
} from "./freeResponseKeywordMatch";

describe("normalizeFreeResponseKeywords", () => {
  it("trim・空文字除外・重複除外し、最初の表記を保持する", () => {
    expect(normalizeFreeResponseKeywords([" 学習 ", "入力", "", "学習"])).toEqual(["学習", "入力"]);
  });

  it("比較正規化が同じなら重複とみなす", () => {
    expect(normalizeFreeResponseKeywords(["AI", "  ai  ", "ＡＩ"])).toEqual(["AI"]);
  });

  it("空・不正は undefined", () => {
    expect(normalizeFreeResponseKeywords(undefined)).toBeUndefined();
    expect(normalizeFreeResponseKeywords("学習")).toBeUndefined();
    expect(normalizeFreeResponseKeywords([])).toBeUndefined();
    expect(normalizeFreeResponseKeywords(["", "  "])).toBeUndefined();
    expect(normalizeFreeResponseKeywords([1, null, {}])).toBeUndefined();
  });
});

describe("matchFreeResponseKeywords", () => {
  it("基本: 部分一致と不足を登録順の表示文字列で返す", () => {
    const result = matchFreeResponseKeywords("入力データを使って学習する", ["正解ラベル", "入力", "学習"]);
    expect(result.matchedKeywords).toEqual(["入力", "学習"]);
    expect(result.missingKeywords).toEqual(["正解ラベル"]);
  });

  it("NFKC で全角英字と半角英字を一致させる", () => {
    const result = matchFreeResponseKeywords("ＡＩを使う", ["AI"]);
    expect(result.matchedKeywords).toEqual(["AI"]);
    expect(result.missingKeywords).toEqual([]);
  });

  it("英字の大文字小文字を無視する", () => {
    const result = matchFreeResponseKeywords("machine learning を学ぶ", ["Machine Learning"]);
    expect(result.matchedKeywords).toEqual(["Machine Learning"]);
    expect(result.missingKeywords).toEqual([]);
  });

  it("前後・連続 whitespace を正規化する", () => {
    expect(normalizeKeywordForComparison("  Machine   Learning  ")).toBe("machine learning");
    const result = matchFreeResponseKeywords("  入力   データ  ", [" 入力 "]);
    expect(result.matchedKeywords).toEqual(["入力"]);
  });

  it("重複キーワードは1件になる", () => {
    const result = matchFreeResponseKeywords("入力する", ["入力", "入力", " 入力 "]);
    expect(result.matchedKeywords).toEqual(["入力"]);
    expect(result.missingKeywords).toEqual([]);
  });

  it("keywords が空なら matched / missing とも空", () => {
    expect(matchFreeResponseKeywords("何か答える", [])).toEqual({
      matchedKeywords: [],
      missingKeywords: []
    });
    expect(matchFreeResponseKeywords("何か答える", [])).toEqual({
      matchedKeywords: [],
      missingKeywords: []
    });
  });
});
