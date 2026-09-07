export type DataLabDisplayMode = "table" | "line";

export const DATA_LAB_DISPLAY_MODE_OPTIONS: { value: DataLabDisplayMode; label: string }[] = [
  { value: "table", label: "テーブル" },
  { value: "line", label: "折れ線グラフ" }
];
