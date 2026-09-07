import type { DataLabGroupBy } from "./aggregateDataLabLogs";

export const DATA_LAB_GROUP_BY_CONTROL_LABELS: Record<DataLabGroupBy, string> = {
  concept: "Concept",
  domain: "分野",
  deck: "Deck",
  day: "日",
  week: "週",
  month: "月"
};

export const DATA_LAB_GROUP_BY_COLUMN_LABELS: Record<DataLabGroupBy, string> = {
  concept: "Concept",
  domain: "分野",
  deck: "Deck",
  day: "日付",
  week: "週",
  month: "月"
};

export const DATA_LAB_GROUP_BY_OPTIONS: { value: DataLabGroupBy; label: string }[] = [
  { value: "concept", label: "Concept" },
  { value: "domain", label: "分野" },
  { value: "deck", label: "Deck" },
  { value: "day", label: "日" },
  { value: "week", label: "週" },
  { value: "month", label: "月" }
];
