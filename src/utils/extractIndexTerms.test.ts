import { describe, expect, it } from "vitest";
import { appendKeyConcepts, extractIndexTerms, validateIndexPageRange } from "./extractIndexTerms";

const termsIn = (indexText: string, start = 36, end = 65) =>
  extractIndexTerms(indexText, start, end).terms.map((term) => term.term);

describe("extractIndexTerms", () => {
  it("単一ページが範囲内なら用語を返す", () => {
    expect(termsIn("機械学習 42")).toEqual(["機械学習"]);
  });

  it("複数ページのうち1つでも範囲内なら抽出する", () => {
    expect(termsIn("機械学習 12, 38, 90")).toEqual(["機械学習"]);
  });

  it("ページ範囲が交差すれば抽出する", () => {
    expect(termsIn("教師あり学習 30-42")).toEqual(["教師あり学習"]);
  });

  it("範囲外の用語は抽出しない", () => {
    expect(termsIn("データベース 100, 120")).toEqual([]);
  });

  it("境界ページは含め、境界の外は含めない", () => {
    expect(termsIn("A 36\nB 65\nC 35\nD 66")).toEqual(["A", "B"]);
  });

  it("カンマ・読点・ダッシュの表記揺れを解釈する", () => {
    const indexText = ["A 40-45", "B 40–45", "C 40〜45", "D 40，45", "E 40、45"].join("\n");
    expect(termsIn(indexText)).toEqual(["A", "B", "C", "D", "E"]);
  });

  it("用語中の数字をページ番号と誤認しない", () => {
    expect(termsIn("HTML5 42\nWeb3 50")).toEqual(["HTML5", "Web3"]);
  });

  it("章範囲の例から交差する用語だけを索引順で返す", () => {
    const indexText = [
      "インターネット 12, 38, 52",
      "ISP 40-42",
      "FTTH 44",
      "モデム 18, 47",
      "データ通信 66-70"
    ].join("\n");
    expect(termsIn(indexText)).toEqual(["インターネット", "ISP", "FTTH", "モデム"]);
  });

  it("波ダッシュと en dash の範囲、全角カンマを解釈する", () => {
    expect(termsIn("勾配降下法 40–50\nアルゴリズム 23〜28\n教師あり学習 40～45", 36, 65)).toEqual([
      "勾配降下法",
      "教師あり学習"
    ]);
    expect(termsIn("ニューラルネットワーク 67，71，120")).toEqual([]);
  });

  it("同一用語は先に現れた表記を残して重複させない", () => {
    const result = extractIndexTerms("機械学習 12\n機械学習 40, 90", 36, 65);
    expect(result.terms).toEqual([{ term: "機械学習", matchedPages: ["40"] }]);
  });

  it("空行とページ番号のない行は候補にせず、解釈不能行だけを返す", () => {
    const result = extractIndexTerms("見出し\n\n機械学習 42\n???\n", 36, 65);
    expect(result.terms.map((term) => term.term)).toEqual(["機械学習"]);
    expect(result.unparsedLines).toEqual(["見出し", "???"]);
  });

  it("不正な範囲トークンで全体を止めず、その行だけを解釈不能にする", () => {
    const result = extractIndexTerms("壊れた行 40-30\nFTTH 44", 36, 65);
    expect(result.terms.map((term) => term.term)).toEqual(["FTTH"]);
    expect(result.unparsedLines).toEqual(["壊れた行 40-30"]);
  });

  it("タブと余分な空白を許容する", () => {
    expect(termsIn("モデム\t18,  47")).toEqual(["モデム"]);
  });

  it("仕様のページ表記を広い範囲で解釈する", () => {
    const indexText = [
      "機械学習 12, 38, 42",
      "教師あり学習 40-45, 82",
      "ニューラルネットワーク 67，71，120",
      "勾配降下法 74–78",
      "アルゴリズム 23〜28",
      "データ通信 30～35",
      "HTML5 42",
      "Web3 50"
    ].join("\n");
    expect(termsIn(indexText, 1, 200)).toEqual([
      "機械学習",
      "教師あり学習",
      "ニューラルネットワーク",
      "勾配降下法",
      "アルゴリズム",
      "データ通信",
      "HTML5",
      "Web3"
    ]);
  });

  it("開始と終了が同一ページでもそのページだけを抽出する", () => {
    expect(termsIn("A 36\nB 37\nC 35-36", 36, 36)).toEqual(["A", "C"]);
  });

  it("非対応のリーダー線・折り返し・接尾辞を誤抽出しない", () => {
    const result = extractIndexTerms(
      ["機械学習 …… 42", "教師あり学習", "  40, 45", "機械学習 42f", "FTTH 44"].join("\n"),
      36,
      65
    );
    expect(result.terms.map((term) => term.term)).toEqual(["FTTH"]);
    expect(result.unparsedLines).toEqual(["機械学習 …… 42", "教師あり学習", "40, 45", "機械学習 42f"]);
  });

  it("空の索引と空行だけなら候補も解釈不能行もない", () => {
    expect(extractIndexTerms("\n\n  \n", 36, 65)).toEqual({ terms: [], unparsedLines: [] });
  });
});

describe("validateIndexPageRange", () => {
  it("正の整数で開始が終了以下なら受け付ける", () => {
    expect(validateIndexPageRange("36", "65")).toEqual({ startPage: 36, endPage: 65 });
  });

  it("0、小数、逆順はエラーにする", () => {
    expect(validateIndexPageRange("0", "10")).toHaveProperty("error");
    expect(validateIndexPageRange("1.5", "10")).toHaveProperty("error");
    expect(validateIndexPageRange("70", "36")).toHaveProperty("error");
    expect(validateIndexPageRange("", "36")).toHaveProperty("error");
    expect(validateIndexPageRange("-3", "10")).toHaveProperty("error");
    expect(validateIndexPageRange("36", "36")).toEqual({ startPage: 36, endPage: 36 });
  });
});

describe("appendKeyConcepts", () => {
  it("既存の順序を保ったまま新しい用語を末尾へ追加する", () => {
    expect(appendKeyConcepts("機械学習, 過学習", ["機械学習", "教師あり学習"])).toBe(
      "機械学習, 過学習, 教師あり学習"
    );
  });

  it("同じ用語を再度追加しても結果が変わらない", () => {
    const once = appendKeyConcepts("機械学習, 過学習", ["機械学習", "教師あり学習"]);
    expect(appendKeyConcepts(once, ["機械学習", "教師あり学習"])).toBe(once);
  });

  it("空白と正規化の差だけでは重複追加しない", () => {
    expect(appendKeyConcepts("HTML5", [" HTML５ "])).toBe("HTML5");
  });

  it("空の入力欄には追加分だけをカンマ区切りで入れる", () => {
    expect(appendKeyConcepts("", ["ISP", "FTTH"])).toBe("ISP, FTTH");
  });
});
