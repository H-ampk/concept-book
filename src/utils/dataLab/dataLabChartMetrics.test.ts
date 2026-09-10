import { describe, expect, it } from "vitest";
import type { DataLabAggregateRow } from "./aggregateDataLabLogs";
import {
  DATA_LAB_METRIC_LABELS,
  formatDataLabMetricValue,
  getDataLabMetricAxisDomain,
  getDataLabMetricAxisLabel,
  getDataLabMetricOptions,
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
    expect(formatDataLabMetricValue("mastery", 0.821)).toBe("82%");
    expect(formatDataLabMetricValue("averageResponseTimeMs", 4200)).toBe("4.2秒");
  });

  it("BKT 理解度 metric の raw value / label / domain を返す", () => {
    expect(DATA_LAB_METRIC_LABELS.mastery).toBe("BKT 理解度");
    expect(getDataLabMetricValue(row({ masteryProbability: 0.821 }), "mastery")).toBe(0.821);
    expect(getDataLabMetricYDomain("mastery")).toEqual([0, 1]);
    expect(getDataLabMetricAxisDomain("mastery")).toEqual([0, 1]);
    expect(getDataLabMetricAxisLabel("mastery")).toBe("BKT 理解度（%）");
    expect(getDataLabMetricOptions("concept").some((option) => option.value === "mastery")).toBe(true);
    expect(getDataLabMetricOptions("day").some((option) => option.value === "mastery")).toBe(false);
  });

  it("PFA / HLR 確率の domain は [0,1]、半減期・経過日数は [0,auto] である", () => {
    expect(DATA_LAB_METRIC_LABELS.pfaNextCorrectProbability).toBe("PFA 次回正答確率");
    expect(DATA_LAB_METRIC_LABELS.hlrRetentionProbability).toBe("HLR 記憶保持率");
    expect(getDataLabMetricYDomain("pfaNextCorrectProbability")).toEqual([0, 1]);
    expect(getDataLabMetricYDomain("hlrRetentionProbability")).toEqual([0, 1]);
    expect(getDataLabMetricAxisDomain("hlrHalfLifeDays")).toEqual([0, "auto"]);
    expect(getDataLabMetricAxisDomain("hlrElapsedDays")).toEqual([0, "auto"]);
    expect(getDataLabMetricAxisLabel("pfaNextCorrectProbability")).toBe("PFA 次回正答確率（%）");
    expect(getDataLabMetricAxisLabel("hlrHalfLifeDays")).toBe("HLR 半減期（日）");
    expect(getDataLabMetricValue(row({ pfaNextCorrectProbability: 0.4 }), "pfaNextCorrectProbability")).toBe(0.4);
    expect(getDataLabMetricValue(row({ hlrHalfLifeDays: 3.2 }), "hlrHalfLifeDays")).toBe(3.2);
    expect(getDataLabMetricOptions("concept").some((option) => option.value === "pfaNextCorrectProbability")).toBe(true);
    expect(getDataLabMetricOptions("concept").some((option) => option.value === "hlrElapsedDays")).toBe(true);
    expect(getDataLabMetricOptions("domain").some((option) => option.value === "pfaNextCorrectProbability")).toBe(false);
    expect(getDataLabMetricOptions("week").some((option) => option.value === "hlrHalfLifeDays")).toBe(false);
  });

  it("欠損値は 0 にせず — にする", () => {
    expect(formatDataLabMetricValue("accuracy", null)).toBe("—");
    expect(formatDataLabMetricValue("mastery", null)).toBe("—");
    expect(formatDataLabMetricValue("averageResponseTimeMs", null)).toBe("—");
    expect(getDataLabMetricValue(row({ averageResponseTimeMs: null }), "averageResponseTimeMs")).toBeNull();
    expect(getDataLabMetricValue(row({ accuracy: null }), "accuracy")).toBeNull();
    expect(getDataLabMetricValue(row({ masteryProbability: null }), "mastery")).toBeNull();
    expect(formatDataLabMetricValue("mastery", 0)).toBe("0%");
    expect(formatDataLabMetricValue("pfaNextCorrectProbability", null)).toBe("—");
    expect(formatDataLabMetricValue("pfaNextCorrectProbability", 0)).toBe("0%");
    expect(formatDataLabMetricValue("hlrRetentionProbability", 0)).toBe("0%");
    expect(formatDataLabMetricValue("hlrHalfLifeDays", null)).toBe("—");
    expect(formatDataLabMetricValue("hlrHalfLifeDays", 0)).toBe("0日");
    expect(formatDataLabMetricValue("hlrElapsedDays", 0)).toBe("0日");
    expect(getDataLabMetricValue(row({ pfaNextCorrectProbability: null }), "pfaNextCorrectProbability")).toBeNull();
    expect(getDataLabMetricValue(row({ hlrElapsedDays: 0 }), "hlrElapsedDays")).toBe(0);
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
