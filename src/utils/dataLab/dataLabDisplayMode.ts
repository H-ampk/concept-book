export type DataLabDisplayMode = "table" | "line" | "bar" | "scatter" | "histogram";

export const DATA_LAB_DISPLAY_MODE_OPTIONS: { value: DataLabDisplayMode; label: string }[] = [
  { value: "table", label: "テーブル" },
  { value: "line", label: "折れ線グラフ" },
  { value: "bar", label: "棒グラフ" },
  { value: "scatter", label: "散布図" },
  { value: "histogram", label: "ヒストグラム" }
];
