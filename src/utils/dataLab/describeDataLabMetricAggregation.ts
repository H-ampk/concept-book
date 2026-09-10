import type { DataLabMetric } from "./dataLabChartMetrics";

export const DATA_LAB_METRIC_AGGREGATION_DESCRIPTIONS: Record<DataLabMetric, string> = {
  attemptCount: "現在の集計単位に含まれる回答ログ件数",
  correctCount: "現在の集計単位に含まれる正答ログ件数",
  incorrectCount: "回答数 − 正答数",
  accuracy: "正答数 ÷ 回答数",
  averageResponseTimeMs: "有効な回答時間を持つログの回答時間の算術平均",
  mastery: "Concept 単位のみ。全学習履歴から算出した BKT 理解度（学習済みである確率）",
  pfaNextCorrectProbability: "Concept 単位のみ。全学習履歴から算出した PFA 次回正答確率",
  hlrRetentionProbability: "Concept 単位のみ。全学習履歴から算出した HLR 記憶保持率（現時点で記憶が保持されている推定確率）",
  hlrHalfLifeDays: "Concept 単位のみ。全学習履歴から算出した HLR 半減期（日）",
  hlrElapsedDays: "Concept 単位のみ。全学習履歴の最終学習から算出した HLR 経過日数"
};

export const DATA_LAB_HISTOGRAM_AGGREGATION_DESCRIPTION =
  "現在の集計軸で算出した各集計値を範囲ごとに分類し、その件数を表示します。";

export const DATA_LAB_LEARNING_MODEL_CURRENT_METRICS_NOTE =
  "BKT: 学習済みである確率。PFA: 次回回答が正解する確率。HLR: 現時点で記憶が保持されている推定確率。いずれも全学習履歴から算出した現在値であり、同じ理解度ではありません。期間フィルタでは学習履歴を切りません。";

export const DATA_LAB_LEARNING_MODEL_EVALUATION_NOTE =
  "Brier score / Log loss は小さいほど予測誤差が小さい。評価対象は BKT と PFA の次回正答確率予測です。HLR の記憶保持率は次回正答確率ではないため、この比較には含めていません。予測は全学習履歴から生成し、画面のフィルタは評価対象の回答だけに適用します。";

export const describeDataLabMetricAggregation = (metric: DataLabMetric): string =>
  DATA_LAB_METRIC_AGGREGATION_DESCRIPTIONS[metric];
