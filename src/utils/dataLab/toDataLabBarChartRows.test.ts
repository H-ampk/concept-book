import { describe, expect, it } from "vitest";
import type { DataLabAggregateRow } from "./aggregateDataLabLogs";
import { getDataLabMetricValue } from "./dataLabChartMetrics";
import {
  isDataLabBarChartGroupBy,
  toDataLabBarChartRows,
  type DataLabBarChartLimit
} from "./toDataLabBarChartRows";

const row = (overrides: Partial<DataLabAggregateRow> = {}): DataLabAggregateRow => ({
  groupBy: "concept",
  key: "c1",
  label: "概念A",
  attemptCount: 2,
  correctCount: 1,
  incorrectCount: 1,
  accuracy: 0.5,
  averageResponseTimeMs: 1000,
  firstAttemptAt: null,
  lastAttemptAt: null,
  ...overrides
});

describe("isDataLabBarChartGroupBy", () => {
  it.each(["concept", "domain", "deck"] as const)("%s は対応扱いになる", (groupBy) => {
    expect(isDataLabBarChartGroupBy(groupBy)).toBe(true);
  });

  it.each(["day", "week", "month"] as const)("%s は非対応になる", (groupBy) => {
    expect(isDataLabBarChartGroupBy(groupBy)).toBe(false);
  });
});

describe("toDataLabBarChartRows 指標", () => {
  const sample = row({
    attemptCount: 12,
    correctCount: 8,
    incorrectCount: 4,
    accuracy: 0.784,
    averageResponseTimeMs: 4200
  });

  it("回答数を正しく取得する", () => {
    expect(toDataLabBarChartRows([sample], "attemptCount", "original", "all")[0]?.value).toBe(12);
  });

  it("正答数を正しく取得する", () => {
    expect(toDataLabBarChartRows([sample], "correctCount", "original", "all")[0]?.value).toBe(8);
  });

  it("誤答数を正しく取得する", () => {
    expect(toDataLabBarChartRows([sample], "incorrectCount", "original", "all")[0]?.value).toBe(4);
  });

  it("正答率を 0〜1 の生数値のまま取得する", () => {
    expect(toDataLabBarChartRows([sample], "accuracy", "original", "all")[0]?.value).toBe(0.784);
  });

  it("理解度を 0〜1 の生数値のまま取得し、null は除外する", () => {
    const withMastery = [
      row({ key: "missing", masteryProbability: null }),
      row({ key: "ok", masteryProbability: 0.821 }),
      row({ key: "zero", masteryProbability: 0 })
    ];
    expect(toDataLabBarChartRows(withMastery, "mastery", "original", "all").map((item) => item.key)).toEqual([
      "ok",
      "zero"
    ]);
    expect(toDataLabBarChartRows(withMastery, "mastery", "original", "all")[0]?.value).toBe(0.821);
  });

  it("PFA / HLR 指標を生数値のまま取得し、null は除外・0 は残す", () => {
    const withModels = [
      row({ key: "missing", pfaNextCorrectProbability: null, hlrHalfLifeDays: null }),
      row({ key: "ok", pfaNextCorrectProbability: 0.4, hlrHalfLifeDays: 3.2 }),
      row({ key: "zero", pfaNextCorrectProbability: 0, hlrHalfLifeDays: 0 })
    ];
    expect(toDataLabBarChartRows(withModels, "pfaNextCorrectProbability", "original", "all").map((item) => item.key)).toEqual(
      ["ok", "zero"]
    );
    expect(toDataLabBarChartRows(withModels, "hlrHalfLifeDays", "original", "all")[1]?.value).toBe(0);
  });

  it("平均回答時間を ms のまま取得する", () => {
    expect(toDataLabBarChartRows([sample], "averageResponseTimeMs", "original", "all")[0]?.value).toBe(4200);
  });
});

describe("toDataLabBarChartRows ソート", () => {
  it("値の高い順に並べる", () => {
    const rows = [
      row({ key: "a", label: "A", attemptCount: 9 }),
      row({ key: "b", label: "B", attemptCount: 100 }),
      row({ key: "c", label: "C", attemptCount: 82 })
    ];
    expect(toDataLabBarChartRows(rows, "attemptCount", "valueDesc", "all").map((item) => item.value)).toEqual([
      100, 82, 9
    ]);
  });

  it("値の低い順に並べる", () => {
    const rows = [
      row({ key: "a", label: "A", attemptCount: 9 }),
      row({ key: "b", label: "B", attemptCount: 100 }),
      row({ key: "c", label: "C", attemptCount: 82 })
    ];
    expect(toDataLabBarChartRows(rows, "attemptCount", "valueAsc", "all").map((item) => item.value)).toEqual([
      9, 82, 100
    ]);
  });

  it("名前順は label の日本語ロケール比較になる", () => {
    const rows = [
      row({ key: "2", label: "みかん" }),
      row({ key: "1", label: "あいう" }),
      row({ key: "3", label: "りんご" })
    ];
    expect(toDataLabBarChartRows(rows, "attemptCount", "name", "all").map((item) => item.label)).toEqual([
      "あいう",
      "みかん",
      "りんご"
    ]);
  });

  it("元の順序を維持する", () => {
    const rows = [
      row({ key: "c", label: "C", attemptCount: 1 }),
      row({ key: "a", label: "A", attemptCount: 100 }),
      row({ key: "b", label: "B", attemptCount: 10 })
    ];
    expect(toDataLabBarChartRows(rows, "attemptCount", "original", "all").map((item) => item.key)).toEqual([
      "c",
      "a",
      "b"
    ]);
  });

  it("数値を文字列として比較していない（1, 10, 2）", () => {
    const rows = [
      row({ key: "a", label: "A", attemptCount: 1 }),
      row({ key: "b", label: "B", attemptCount: 10 }),
      row({ key: "c", label: "C", attemptCount: 2 })
    ];
    expect(toDataLabBarChartRows(rows, "attemptCount", "valueDesc", "all").map((item) => item.value)).toEqual([
      10, 2, 1
    ]);
    expect(toDataLabBarChartRows(rows, "attemptCount", "valueAsc", "all").map((item) => item.value)).toEqual([
      1, 2, 10
    ]);
  });

  it("同値時は label → key で安定する", () => {
    const rows = [
      row({ key: "z", label: "同じ", attemptCount: 5 }),
      row({ key: "a", label: "同じ", attemptCount: 5 }),
      row({ key: "m", label: "同じ", attemptCount: 5 })
    ];
    const first = toDataLabBarChartRows(rows, "attemptCount", "valueDesc", "all").map((item) => item.key);
    const second = toDataLabBarChartRows(rows, "attemptCount", "valueDesc", "all").map((item) => item.key);
    expect(first).toEqual(["a", "m", "z"]);
    expect(second).toEqual(first);
  });

  it("表示文字列ではなく getDataLabMetricValue の生数値で比較する", () => {
    const rows = [
      row({ key: "low", label: "低", accuracy: 0.09 }),
      row({ key: "high", label: "高", accuracy: 0.82 }),
      row({ key: "mid", label: "中", accuracy: 1 })
    ];
    const values = rows.map((item) => getDataLabMetricValue(item, "accuracy"));
    expect(values.every((value) => typeof value === "number")).toBe(true);
    expect(toDataLabBarChartRows(rows, "accuracy", "valueDesc", "all").map((item) => item.key)).toEqual([
      "mid",
      "high",
      "low"
    ]);
  });
});

describe("toDataLabBarChartRows 表示件数", () => {
  const many = Array.from({ length: 60 }, (_, index) =>
    row({
      key: `c${index}`,
      label: `概念${index}`,
      attemptCount: index
    })
  );

  it.each([
    [10, 10],
    [20, 20],
    [50, 50]
  ] as const)("limit %s は %s 件にする", (limit: DataLabBarChartLimit, expected) => {
    expect(toDataLabBarChartRows(many, "attemptCount", "valueDesc", limit)).toHaveLength(expected);
  });

  it("すべて は全件を返す", () => {
    expect(toDataLabBarChartRows(many, "attemptCount", "valueDesc", "all")).toHaveLength(60);
  });

  it("sort → limit の順で処理する（先頭10件を取ってからソートしない）", () => {
    const rows = [
      row({ key: "low-early", label: "早い低", attemptCount: 1 }),
      row({ key: "high-late", label: "遅い高", attemptCount: 100 }),
      ...Array.from({ length: 12 }, (_, index) =>
        row({ key: `mid-${index}`, label: `中${index}`, attemptCount: 5 })
      )
    ];
    const limited = toDataLabBarChartRows(rows, "attemptCount", "valueDesc", 10);
    expect(limited[0]?.key).toBe("high-late");
    expect(limited).toHaveLength(10);
    expect(limited.map((item) => item.key)).not.toContain("low-early");
  });
});

describe("toDataLabBarChartRows 欠損", () => {
  it("null を 0 にしない", () => {
    const rows = [row({ accuracy: null })];
    expect(toDataLabBarChartRows(rows, "accuracy", "original", "all")).toEqual([]);
  });

  it("欠損 row を除外し、有効な 0 は残す", () => {
    const rows = [
      row({ key: "missing", accuracy: null }),
      row({ key: "zero", attemptCount: 0, accuracy: 0 }),
      row({ key: "ok", accuracy: 0.5 })
    ];
    const result = toDataLabBarChartRows(rows, "accuracy", "original", "all");
    expect(result.map((item) => item.key)).toEqual(["zero", "ok"]);
    expect(result[0]?.value).toBe(0);
  });

  it("全件欠損でもクラッシュせず空配列を返す", () => {
    const rows = [row({ accuracy: null }), row({ key: "c2", accuracy: null })];
    expect(toDataLabBarChartRows(rows, "accuracy", "valueDesc", 10)).toEqual([]);
  });
});
