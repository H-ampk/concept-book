import { describe, expect, it } from "vitest";
import type { DataLabAggregateRow } from "./aggregateDataLabLogs";
import {
  DATA_LAB_HISTOGRAM_MAX_BIN_COUNT,
  getDataLabHistogramBinCount,
  isDataLabHistogramGroupBy,
  isValueInDataLabHistogramBin,
  toDataLabHistogramBins
} from "./toDataLabHistogramBins";

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

const validCount = (rows: DataLabAggregateRow[], metric: Parameters<typeof toDataLabHistogramBins>[1]): number =>
  toDataLabHistogramBins(rows, metric).reduce((sum, bin) => sum + bin.count, 0);

describe("isDataLabHistogramGroupBy", () => {
  it.each(["concept", "domain", "deck"] as const)("%s は対応扱いになる", (groupBy) => {
    expect(isDataLabHistogramGroupBy(groupBy)).toBe(true);
  });

  it.each(["day", "week", "month"] as const)("%s は非対応になる", (groupBy) => {
    expect(isDataLabHistogramGroupBy(groupBy)).toBe(false);
  });
});

describe("getDataLabHistogramBinCount", () => {
  it("0件は 0、少量は少なく、上限を超えない", () => {
    expect(getDataLabHistogramBinCount(0)).toBe(0);
    expect(getDataLabHistogramBinCount(1)).toBe(1);
    expect(getDataLabHistogramBinCount(4)).toBe(2);
    expect(getDataLabHistogramBinCount(10000)).toBe(DATA_LAB_HISTOGRAM_MAX_BIN_COUNT);
  });
});

describe("toDataLabHistogramBins", () => {
  it("空配列なら空配列を返す", () => {
    expect(toDataLabHistogramBins([], "accuracy")).toEqual([]);
  });

  it("null metric を除外する", () => {
    const rows = [
      row({ key: "missing", accuracy: null }),
      row({ key: "ok", accuracy: 0.4 }),
      row({ key: "also-missing", accuracy: null })
    ];
    const bins = toDataLabHistogramBins(rows, "accuracy");
    expect(validCount(rows, "accuracy")).toBe(1);
    expect(bins.reduce((sum, bin) => sum + bin.count, 0)).toBe(1);
  });

  it("有効な 0 は残し、null は除外する", () => {
    const rows = [
      row({ key: "missing", accuracy: null }),
      row({ key: "zero", accuracy: 0 }),
      row({ key: "ok", accuracy: 0.5 })
    ];
    expect(validCount(rows, "accuracy")).toBe(2);
  });

  it("全値が bin にちょうど1回ずつ入り、件数合計は valid value 数と一致する", () => {
    const rows = [
      row({ key: "a", accuracy: 0 }),
      row({ key: "b", accuracy: 0.25 }),
      row({ key: "c", accuracy: 0.5 }),
      row({ key: "d", accuracy: 0.75 }),
      row({ key: "e", accuracy: 1 }),
      row({ key: "null", accuracy: null })
    ];
    const values = [0, 0.25, 0.5, 0.75, 1];
    const bins = toDataLabHistogramBins(rows, "accuracy");
    expect(bins.reduce((sum, bin) => sum + bin.count, 0)).toBe(values.length);
    for (const value of values) {
      const hits = bins.filter((bin) => isValueInDataLabHistogramBin(value, bin));
      expect(hits).toHaveLength(1);
    }
  });

  it("最小値と最大値を bin 範囲の端にする", () => {
    const rows = [
      row({ key: "low", attemptCount: 3 }),
      row({ key: "high", attemptCount: 18 }),
      row({ key: "mid", attemptCount: 9 })
    ];
    const bins = toDataLabHistogramBins(rows, "attemptCount");
    expect(bins[0]?.min).toBe(3);
    expect(bins[bins.length - 1]?.max).toBe(18);
  });

  it("bin 境界値を二重計上しない", () => {
    const rows = [
      row({ key: "a", accuracy: 0 }),
      row({ key: "b", accuracy: 0.5 }),
      row({ key: "c", accuracy: 1 })
    ];
    const bins = toDataLabHistogramBins(rows, "accuracy");
    const boundary = 0.5;
    const hits = bins.filter((bin) => isValueInDataLabHistogramBin(boundary, bin));
    expect(hits).toHaveLength(1);
    expect(bins.reduce((sum, bin) => sum + bin.count, 0)).toBe(3);
  });

  it("全値が同一でも 1 つの bin を生成する", () => {
    const rows = [
      row({ key: "a", accuracy: 0.4 }),
      row({ key: "b", accuracy: 0.4 }),
      row({ key: "c", accuracy: 0.4 })
    ];
    const bins = toDataLabHistogramBins(rows, "accuracy");
    expect(bins).toHaveLength(1);
    expect(bins[0]?.min).toBe(0.4);
    expect(bins[0]?.max).toBe(0.4);
    expect(bins[0]?.count).toBe(3);
    expect(bins[0]?.maxInclusive).toBe(true);
    expect(isValueInDataLabHistogramBin(0.4, bins[0]!)).toBe(true);
  });

  it("accuracy は内部値 0〜1 のまま bin 化する", () => {
    const rows = [row({ key: "a", accuracy: 0 }), row({ key: "b", accuracy: 1 })];
    const bins = toDataLabHistogramBins(rows, "accuracy");
    expect(bins[0]?.min).toBe(0);
    expect(bins[bins.length - 1]?.max).toBe(1);
    expect(bins.every((bin) => bin.min >= 0 && bin.max <= 1)).toBe(true);
  });

  it("averageResponseTimeMs は内部値 ms のまま bin 化する", () => {
    const rows = [
      row({ key: "a", averageResponseTimeMs: 1000 }),
      row({ key: "b", averageResponseTimeMs: 5000 })
    ];
    const bins = toDataLabHistogramBins(rows, "averageResponseTimeMs");
    expect(bins[0]?.min).toBe(1000);
    expect(bins[bins.length - 1]?.max).toBe(5000);
  });

  it("入力を mutate しない", () => {
    const rows = [
      row({ key: "a", accuracy: 0.2 }),
      row({ key: "b", accuracy: 0.8 })
    ];
    const snapshot = structuredClone(rows);
    toDataLabHistogramBins(rows, "accuracy");
    expect(rows).toEqual(snapshot);
  });

  it("入力順に依存せず、同じ入力なら同じ bin を返す", () => {
    const rows = [
      row({ key: "a", accuracy: 0.1 }),
      row({ key: "b", accuracy: 0.9 }),
      row({ key: "c", accuracy: 0.4 }),
      row({ key: "d", accuracy: 0.6 })
    ];
    const reversed = [...rows].reverse();
    expect(toDataLabHistogramBins(rows, "accuracy")).toEqual(toDataLabHistogramBins(reversed, "accuracy"));
    expect(toDataLabHistogramBins(rows, "accuracy")).toEqual(toDataLabHistogramBins(rows, "accuracy"));
  });

  it("大量データでも bin 数が上限を超えない", () => {
    const rows = Array.from({ length: 400 }, (_, index) =>
      row({
        key: `c${index}`,
        label: `概念${index}`,
        accuracy: index / 399
      })
    );
    const bins = toDataLabHistogramBins(rows, "accuracy");
    expect(bins.length).toBeLessThanOrEqual(DATA_LAB_HISTOGRAM_MAX_BIN_COUNT);
    expect(bins.reduce((sum, bin) => sum + bin.count, 0)).toBe(400);
  });

  it("accuracy の label はパーセント、averageResponseTimeMs の label は秒になる", () => {
    const accuracyBins = toDataLabHistogramBins(
      [row({ key: "a", accuracy: 0 }), row({ key: "b", accuracy: 1 })],
      "accuracy"
    );
    expect(accuracyBins.every((bin) => bin.label.includes("%"))).toBe(true);

    const timeBins = toDataLabHistogramBins(
      [row({ key: "a", averageResponseTimeMs: 1000 }), row({ key: "b", averageResponseTimeMs: 5000 })],
      "averageResponseTimeMs"
    );
    expect(timeBins.every((bin) => bin.label.includes("秒"))).toBe(true);
  });

  it("mastery の null を除外し、0 は含める", () => {
    const rows = [
      row({ key: "missing", masteryProbability: null }),
      row({ key: "zero", masteryProbability: 0 }),
      row({ key: "ok", masteryProbability: 0.8 })
    ];
    expect(validCount(rows, "mastery")).toBe(2);
  });
});
