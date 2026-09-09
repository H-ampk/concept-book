import { describe, expect, it } from "vitest";
import type { DataLabAggregateRow } from "./aggregateDataLabLogs";
import {
  formatDataLabLineChartXLabel,
  getDataLabLineChartXTickInterval,
  toDataLabLineChartPoints
} from "./toDataLabLineChartPoints";

const row = (overrides: Partial<DataLabAggregateRow> = {}): DataLabAggregateRow => ({
  groupBy: "day",
  key: "2026-08-28",
  label: "2026-08-28",
  attemptCount: 2,
  correctCount: 1,
  incorrectCount: 1,
  accuracy: 0.5,
  averageResponseTimeMs: 1000,
  firstAttemptAt: null,
  lastAttemptAt: null,
  periodStart: "2026-08-28",
  periodEnd: "2026-08-28",
  ...overrides
});

describe("toDataLabLineChartPoints", () => {
  it("入力行の順序を変えない", () => {
    const rows = [
      row({ key: "2026-08-26", periodStart: "2026-08-26", periodEnd: "2026-08-26", label: "2026-08-26" }),
      row({ key: "2026-08-28", periodStart: "2026-08-28", periodEnd: "2026-08-28", label: "2026-08-28" })
    ];
    const points = toDataLabLineChartPoints(rows, "day", "accuracy");
    expect(points.map((point) => point.key)).toEqual(["2026-08-26", "2026-08-28"]);
  });

  it("欠損の平均回答時間を 0 に変換しない", () => {
    const points = toDataLabLineChartPoints(
      [row({ averageResponseTimeMs: null })],
      "day",
      "averageResponseTimeMs"
    );
    expect(points[0]?.value).toBeNull();
  });

  it("入力行にない期間は追加しない（空期間補完は fillDataLabTimeSeries の責務）", () => {
    const points = toDataLabLineChartPoints(
      [
        row({ key: "2026-08-26", periodStart: "2026-08-26", periodEnd: "2026-08-26" }),
        row({ key: "2026-08-28", periodStart: "2026-08-28", periodEnd: "2026-08-28" })
      ],
      "day",
      "attemptCount"
    );
    expect(points).toHaveLength(2);
    expect(points.map((point) => point.key)).not.toContain("2026-08-27");
  });

  it("正答率の欠損は null のまま渡し 0 にしない", () => {
    const points = toDataLabLineChartPoints(
      [row({ attemptCount: 0, correctCount: 0, incorrectCount: 0, accuracy: null })],
      "day",
      "accuracy"
    );
    expect(points[0]?.value).toBeNull();
  });

  it("日ラベルは 8/26 形式で、年をまたぐと年を付ける", () => {
    const sameYear = row({ key: "2026-08-26", periodStart: "2026-08-26" });
    expect(formatDataLabLineChartXLabel(sameYear, "day", false)).toBe("8/26");
    expect(formatDataLabLineChartXLabel(sameYear, "day", true)).toBe("2026/8/26");

    const points = toDataLabLineChartPoints(
      [
        row({ key: "2025-12-31", periodStart: "2025-12-31", periodEnd: "2025-12-31" }),
        row({ key: "2026-01-01", periodStart: "2026-01-01", periodEnd: "2026-01-01" })
      ],
      "day",
      "accuracy"
    );
    expect(points[0]?.xLabel).toBe("2025/12/31");
    expect(points[1]?.xLabel).toBe("2026/1/1");
  });

  it("週ラベルは periodStart / periodEnd を使い、週を再計算しない", () => {
    const weekRow = row({
      groupBy: "week",
      key: "2026-W35",
      label: "should-not-use-this-as-week-calc",
      periodStart: "2026-08-24",
      periodEnd: "2026-08-30"
    });
    expect(formatDataLabLineChartXLabel(weekRow, "week", false)).toBe("8/24〜8/30");
    const points = toDataLabLineChartPoints([weekRow], "week", "accuracy");
    expect(points[0]?.tooltipPeriod).toBe("2026/08/24〜2026/08/30");
  });

  it("月ラベルは 2026/06 形式にする", () => {
    const monthRow = row({
      groupBy: "month",
      key: "2026-06",
      periodStart: "2026-06-01",
      periodEnd: "2026-06-30"
    });
    expect(formatDataLabLineChartXLabel(monthRow, "month", false)).toBe("2026/06");
  });

  it("点は間引かず、X軸 tick 間隔だけ広げる", () => {
    const rows = Array.from({ length: 20 }, (_, index) => {
      const day = String(index + 1).padStart(2, "0");
      return row({
        key: `2026-08-${day}`,
        periodStart: `2026-08-${day}`,
        periodEnd: `2026-08-${day}`
      });
    });
    const points = toDataLabLineChartPoints(rows, "day", "attemptCount");
    expect(points).toHaveLength(20);
    expect(getDataLabLineChartXTickInterval(20)).toBeGreaterThan(0);
    expect(getDataLabLineChartXTickInterval(4)).toBe(0);
  });
});
