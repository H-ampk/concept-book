import { describe, expect, it } from "vitest";
import {
  coerceDataLabMetricForGroupBy,
  sanitizeDataLabAnalysisMetrics
} from "./sanitizeDataLabMetrics";

describe("sanitizeDataLabAnalysisMetrics", () => {
  it("Concept では理解度を維持する", () => {
    expect(coerceDataLabMetricForGroupBy("mastery", "concept")).toBe("mastery");
  });

  it("Concept 以外では理解度を正答率へ戻す", () => {
    expect(coerceDataLabMetricForGroupBy("mastery", "day")).toBe("accuracy");
    expect(coerceDataLabMetricForGroupBy("mastery", "domain")).toBe("accuracy");
    expect(coerceDataLabMetricForGroupBy("attemptCount", "day")).toBe("attemptCount");
  });

  it("散布図で X が理解度のとき groupBy 変更後に X/Y が重複しない", () => {
    const next = sanitizeDataLabAnalysisMetrics({
      groupBy: "domain",
      metric: "mastery",
      scatterXMetric: "mastery",
      scatterYMetric: "accuracy"
    });
    expect(next.metric).toBe("accuracy");
    expect(next.scatterYMetric).toBe("accuracy");
    expect(next.scatterXMetric).not.toBe(next.scatterYMetric);
    expect(next.scatterXMetric).toBe("averageResponseTimeMs");
  });

  it("散布図で Y が理解度のとき groupBy 変更後に X/Y が重複しない", () => {
    const next = sanitizeDataLabAnalysisMetrics({
      groupBy: "deck",
      metric: "accuracy",
      scatterXMetric: "accuracy",
      scatterYMetric: "mastery"
    });
    expect(next.scatterXMetric).toBe("accuracy");
    expect(next.scatterYMetric).not.toBe("accuracy");
    expect(next.scatterYMetric).toBe("averageResponseTimeMs");
  });
});
