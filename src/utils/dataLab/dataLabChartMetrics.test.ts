import { describe, expect, it } from "vitest";
import type { DataLabAggregateRow } from "./aggregateDataLabLogs";
import {
  formatDataLabMetricValue,
  getDataLabMetricAxisDomain,
  getDataLabMetricAxisLabel,
  getDataLabMetricValue,
  getDataLabMetricValueAxisDomain,
  getDataLabMetricYDomain
} from "./dataLabChartMetrics";

const row = (overrides: Partial<DataLabAggregateRow> = {}): DataLabAggregateRow => ({
  groupBy: "day",
  key: "2026-08-28",
  label: "2026-08-28",
  attemptCount: 12,
  correctCount: 8,
  incorrectCount: 4,
  accuracy: 0.784,
  averageResponseTimeMs: 4200,
  firstAttemptAt: null,
  lastAttemptAt: null,
  ...overrides
});

describe("dataLabChartMetrics", () => {
  it("指標値を整数・パーセント・秒として整形する", () => {
    expect(formatDataLabMetricValue("attemptCount", 12)).toBe("12");
    expect(formatDataLabMetricValue("correctCount", 8)).toBe("8");
    expect(formatDataLabMetricValue("incorrectCount", 4)).toBe("4");
    expect(formatDataLabMetricValue("accuracy", 0.784)).toBe("78.4%");
    expect(formatDataLabMetricValue("averageResponseTimeMs", 4200)).toBe("4.2秒");
  });

  it("欠損値は 0 にせず — にする", () => {
    expect(formatDataLabMetricValue("accuracy", null)).toBe("—");
    expect(formatDataLabMetricValue("averageResponseTimeMs", null)).toBe("—");
    expect(getDataLabMetricValue(row({ averageResponseTimeMs: null }), "averageResponseTimeMs")).toBeNull();
    expect(getDataLabMetricValue(row({ accuracy: null }), "accuracy")).toBeNull();
  });

  it("正答率の Y 軸 domain は 0〜1 固定である", () => {
    expect(getDataLabMetricYDomain("accuracy")).toEqual([0, 1]);
    expect(getDataLabMetricValueAxisDomain("accuracy")).toEqual([0, 1]);
    expect(getDataLabMetricAxisDomain("accuracy")).toEqual([0, 1]);
  });

  it("軸ラベルに単位を付ける", () => {
    expect(getDataLabMetricAxisLabel("accuracy")).toBe("正答率（%）");
    expect(getDataLabMetricAxisLabel("averageResponseTimeMs")).toBe("平均回答時間（秒）");
    expect(getDataLabMetricAxisLabel("attemptCount")).toBe("回答数");
  });
});
