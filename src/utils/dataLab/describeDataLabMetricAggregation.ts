import type { DataLabMetric } from "./dataLabChartMetrics";

export const DATA_LAB_METRIC_AGGREGATION_DESCRIPTIONS: Record<DataLabMetric, string> = {
  attemptCount: "現在の集計単位に含まれる回答ログ件数",
  correctCount: "現在の集計単位に含まれる正答ログ件数",
  incorrectCount: "回答数 − 正答数",
  accuracy: "正答数 ÷ 回答数",
  averageResponseTimeMs: "有効な回答時間を持つログの回答時間の算術平均",
  mastery: "Concept 単位のみ。現在の全学習履歴から算出した理解度"
};

export const DATA_LAB_HISTOGRAM_AGGREGATION_DESCRIPTION =
  "現在の集計軸で算出した各集計値を範囲ごとに分類し、その件数を表示します。";

export const describeDataLabMetricAggregation = (metric: DataLabMetric): string =>
  DATA_LAB_METRIC_AGGREGATION_DESCRIPTIONS[metric];
