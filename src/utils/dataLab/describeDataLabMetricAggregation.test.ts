import { describe, expect, it } from "vitest";
import {
  DATA_LAB_HISTOGRAM_AGGREGATION_DESCRIPTION,
  describeDataLabMetricAggregation
} from "./describeDataLabMetricAggregation";

describe("describeDataLabMetricAggregation", () => {
  it("指標ごとの集計方法を返す", () => {
    expect(describeDataLabMetricAggregation("attemptCount")).toBe("現在の集計単位に含まれる回答ログ件数");
    expect(describeDataLabMetricAggregation("correctCount")).toBe("現在の集計単位に含まれる正答ログ件数");
    expect(describeDataLabMetricAggregation("incorrectCount")).toBe("回答数 − 正答数");
    expect(describeDataLabMetricAggregation("accuracy")).toBe("正答数 ÷ 回答数");
    expect(describeDataLabMetricAggregation("averageResponseTimeMs")).toBe(
      "有効な回答時間を持つログの回答時間の算術平均"
    );
    expect(describeDataLabMetricAggregation("mastery")).toBe(
      "Concept 単位のみ。現在の全学習履歴から算出した理解度"
    );
  });

  it("ヒストグラムの集計方法説明を持つ", () => {
    expect(DATA_LAB_HISTOGRAM_AGGREGATION_DESCRIPTION).toBe(
      "現在の集計軸で算出した各集計値を範囲ごとに分類し、その件数を表示します。"
    );
  });
});
