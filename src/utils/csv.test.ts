import { describe, expect, it } from "vitest";
import { UTF8_BOM, buildCsv, escapeCsvCell, localDateYmd } from "./csv";

describe("escapeCsvCell", () => {
  it("カンマを含む値をダブルクォートで囲む", () => {
    expect(escapeCsvCell("AI, HCI")).toBe('"AI, HCI"');
  });

  it("ダブルクォートを二重化して囲む", () => {
    expect(escapeCsvCell('彼は "AI" と言った')).toBe('"彼は ""AI"" と言った"');
  });

  it("改行を含む値をダブルクォートで囲む", () => {
    expect(escapeCsvCell("1行目\n2行目")).toBe('"1行目\n2行目"');
  });

  it("CRLF を含む値をダブルクォートで囲む", () => {
    expect(escapeCsvCell("1行目\r\n2行目")).toBe('"1行目\r\n2行目"');
  });

  it("日本語と絵文字をそのまま返す", () => {
    expect(escapeCsvCell("人工知能")).toBe("人工知能");
    expect(escapeCsvCell("観測🔭")).toBe("観測🔭");
  });

  it("boolean と number を文字列化する", () => {
    expect(escapeCsvCell(true)).toBe("true");
    expect(escapeCsvCell(false)).toBe("false");
    expect(escapeCsvCell(0)).toBe("0");
    expect(escapeCsvCell(0.784)).toBe("0.784");
  });

  it("null / undefined は空セルにする", () => {
    expect(escapeCsvCell(null)).toBe("");
    expect(escapeCsvCell(undefined)).toBe("");
  });
});

describe("buildCsv", () => {
  it("UTF-8 BOM と CRLF で組み立てる", () => {
    const csv = buildCsv(["a", "b"], [["x", "y"]]);
    expect(csv.startsWith(UTF8_BOM)).toBe(true);
    expect(csv).toBe(`${UTF8_BOM}a,b\r\nx,y\r\n`);
  });

  it("0件でもヘッダーだけ出力し例外を投げない", () => {
    const csv = buildCsv(["a"], []);
    expect(csv).toBe(`${UTF8_BOM}a\r\n`);
  });

  it("null / undefined を 0 や文字列にせず空セルにする", () => {
    const csv = buildCsv(["n", "u"], [[null, undefined]]);
    expect(csv).toBe(`${UTF8_BOM}n,u\r\n,\r\n`);
    expect(csv).not.toContain("null");
    expect(csv).not.toContain("undefined");
  });
});

describe("localDateYmd", () => {
  it("ブラウザのローカル日付を YYYY-MM-DD にする", () => {
    expect(localDateYmd(new Date(2026, 8, 7, 21, 0, 0))).toBe("2026-09-07");
  });
});
