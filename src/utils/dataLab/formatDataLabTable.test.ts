import { describe, expect, it } from "vitest";
import { shortDateTime } from "../date";
import {
  formatDataLabAccuracy,
  formatDataLabAverageResponseTime,
  formatDataLabDateTime,
  formatDataLabDays,
  formatDataLabEvaluationScore,
  formatDataLabMastery,
  formatDataLabNullableCount
} from "./formatDataLabTable";

describe("formatDataLabTable", () => {
  it("正答率を必要最小限の小数でパーセント表示する", () => {
    expect(formatDataLabAccuracy(0.778)).toBe("77.8%");
    expect(formatDataLabAccuracy(1)).toBe("100%");
    expect(formatDataLabAccuracy(0.8)).toBe("80%");
  });

  it("理解度は Concept 詳細と同じ整数パーセントで、null は — にする", () => {
    expect(formatDataLabMastery(0.821)).toBe("82%");
    expect(formatDataLabMastery(0)).toBe("0%");
    expect(formatDataLabMastery(null)).toBe("—");
  });

  it("日数は 0 と null を区別する", () => {
    expect(formatDataLabDays(3.2)).toBe("3.2日");
    expect(formatDataLabDays(3)).toBe("3日");
    expect(formatDataLabDays(0)).toBe("0日");
    expect(formatDataLabDays(null)).toBe("—");
  });

  it("件数は 0 と null を区別する", () => {
    expect(formatDataLabNullableCount(0)).toBe("0");
    expect(formatDataLabNullableCount(4)).toBe("4");
    expect(formatDataLabNullableCount(null)).toBe("—");
  });

  it("評価スコアは 0 と null を区別する", () => {
    expect(formatDataLabEvaluationScore(0)).toBe("0");
    expect(formatDataLabEvaluationScore(null)).toBe("—");
    expect(formatDataLabEvaluationScore(0.12345)).toBe("0.1235");
  });

  it("正答率の欠損は — にする", () => {
    expect(formatDataLabAccuracy(null)).toBe("—");
  });

  it("平均回答時間を秒表示し、0 と null を区別する", () => {
    expect(formatDataLabAverageResponseTime(4200)).toBe("4.2秒");
    expect(formatDataLabAverageResponseTime(4000)).toBe("4秒");
    expect(formatDataLabAverageResponseTime(800)).toBe("0.8秒");
    expect(formatDataLabAverageResponseTime(0)).toBe("0秒");
    expect(formatDataLabAverageResponseTime(null)).toBe("—");
  });

  it("日時は shortDateTime を使い、欠損は — にする", () => {
    const iso = "2026-09-01T12:00:00.000Z";
    expect(formatDataLabDateTime(iso)).toBe(shortDateTime(iso));
    expect(formatDataLabDateTime(null)).toBe("—");
    expect(formatDataLabDateTime("not-a-date")).toBe("—");
  });
});
