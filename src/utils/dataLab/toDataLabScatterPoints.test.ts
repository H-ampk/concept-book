import { describe, expect, it } from "vitest";
import type { DataLabAggregateRow } from "./aggregateDataLabLogs";
import { isDataLabScatterGroupBy, toDataLabScatterPoints } from "./toDataLabScatterPoints";

const row = (overrides: Partial<DataLabAggregateRow> = {}): DataLabAggregateRow => ({
  groupBy: "concept",
  key: "c1",
  label: "概念A",
  attemptCount: 12,
  correctCount: 8,
  incorrectCount: 4,
  accuracy: 0.784,
  averageResponseTimeMs: 4200,
  firstAttemptAt: null,
  lastAttemptAt: null,
  ...overrides
});

describe("isDataLabScatterGroupBy", () => {
  it.each(["concept", "domain", "deck"] as const)("%s は対応扱いになる", (groupBy) => {
    expect(isDataLabScatterGroupBy(groupBy)).toBe(true);
  });

  it.each(["day", "week", "month"] as const)("%s は非対応になる", (groupBy) => {
    expect(isDataLabScatterGroupBy(groupBy)).toBe(false);
  });
});

describe("toDataLabScatterPoints 指標", () => {
  const sample = row();

  it("回答数を X/Y に利用できる", () => {
    const [point] = toDataLabScatterPoints([sample], "attemptCount", "correctCount");
    expect(point?.x).toBe(12);
    expect(point?.y).toBe(8);
  });

  it("正答数を利用できる", () => {
    expect(toDataLabScatterPoints([sample], "correctCount", "attemptCount")[0]?.x).toBe(8);
  });

  it("誤答数を利用できる", () => {
    expect(toDataLabScatterPoints([sample], "incorrectCount", "attemptCount")[0]?.x).toBe(4);
  });

  it("正答率を 0〜1 の生数値のまま利用できる", () => {
    expect(toDataLabScatterPoints([sample], "accuracy", "attemptCount")[0]?.x).toBe(0.784);
  });

  it("平均回答時間を ms のまま利用できる", () => {
    expect(toDataLabScatterPoints([sample], "averageResponseTimeMs", "accuracy")[0]?.x).toBe(4200);
  });

  it("理解度を X/Y に利用し、null 点は除外する", () => {
    const withMastery = row({ masteryProbability: 0.821 });
    expect(toDataLabScatterPoints([withMastery], "accuracy", "mastery")[0]?.y).toBe(0.821);
    expect(toDataLabScatterPoints([withMastery], "averageResponseTimeMs", "mastery")[0]?.y).toBe(0.821);
    expect(toDataLabScatterPoints([withMastery], "mastery", "accuracy")[0]?.x).toBe(0.821);
    expect(toDataLabScatterPoints([row({ masteryProbability: null })], "accuracy", "mastery")).toEqual([]);
    expect(toDataLabScatterPoints([row({ masteryProbability: 0 })], "mastery", "accuracy")[0]?.x).toBe(0);
  });
});

describe("toDataLabScatterPoints 欠損と 0", () => {
  it("x が null の行は除外する", () => {
    const rows = [row({ averageResponseTimeMs: null, accuracy: 0.5 })];
    expect(toDataLabScatterPoints(rows, "averageResponseTimeMs", "accuracy")).toEqual([]);
  });

  it("y が null の行は除外する", () => {
    const rows = [row({ attemptCount: 1, accuracy: null })];
    expect(toDataLabScatterPoints(rows, "attemptCount", "accuracy")).toEqual([]);
  });

  it("x = 0 かつ y = 0 は有効値として残す", () => {
    const rows = [
      row({
        key: "zero",
        attemptCount: 0,
        correctCount: 0,
        incorrectCount: 0,
        accuracy: 0,
        averageResponseTimeMs: 0
      })
    ];
    const points = toDataLabScatterPoints(rows, "accuracy", "averageResponseTimeMs");
    expect(points).toHaveLength(1);
    expect(points[0]?.x).toBe(0);
    expect(points[0]?.y).toBe(0);
  });

  it("null と 0 を区別する", () => {
    const rows = [
      row({ key: "missing-x", averageResponseTimeMs: null, accuracy: 0.5 }),
      row({ key: "missing-y", averageResponseTimeMs: 1, accuracy: null }),
      row({ key: "zero", averageResponseTimeMs: 0, accuracy: 0 })
    ];
    const points = toDataLabScatterPoints(rows, "averageResponseTimeMs", "accuracy");
    expect(points.map((point) => point.key)).toEqual(["zero"]);
    expect(points[0]?.x).toBe(0);
    expect(points[0]?.y).toBe(0);
  });
});
