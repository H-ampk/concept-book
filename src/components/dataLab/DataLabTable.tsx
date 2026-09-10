import { useEffect, useMemo, useState } from "react";
import type { DataLabAggregateRow, DataLabGroupBy } from "../../utils/dataLab/aggregateDataLabLogs";
import { DATA_LAB_GROUP_BY_COLUMN_LABELS } from "../../utils/dataLab/dataLabGroupByLabels";
import {
  formatDataLabAccuracy,
  formatDataLabAverageResponseTime,
  formatDataLabDateTime,
  formatDataLabDays,
  formatDataLabMastery,
  formatDataLabNullableCount
} from "../../utils/dataLab/formatDataLabTable";
import {
  sortDataLabTableRows,
  type DataLabTableSortKey,
  type DataLabTableSortState
} from "../../utils/dataLab/sortDataLabTableRows";

type Props = {
  rows: DataLabAggregateRow[];
  groupBy: DataLabGroupBy;
};

const BASE_COLUMNS: { key: DataLabTableSortKey; label: string }[] = [
  { key: "label", label: "集計対象" },
  { key: "attemptCount", label: "回答数" },
  { key: "correctCount", label: "正答数" },
  { key: "incorrectCount", label: "誤答数" },
  { key: "accuracy", label: "正答率" },
  { key: "averageResponseTimeMs", label: "平均回答時間" },
  { key: "lastAttemptAt", label: "最終学習日時" }
];

const CONCEPT_MODEL_COLUMNS: { key: DataLabTableSortKey; label: string }[] = [
  { key: "mastery", label: "BKT 理解度" },
  { key: "pfaNextCorrectProbability", label: "PFA 次回正答確率" },
  { key: "pfaSuccessCount", label: "PFA 成功数" },
  { key: "pfaFailureCount", label: "PFA 失敗数" },
  { key: "hlrRetentionProbability", label: "HLR 記憶保持率" },
  { key: "hlrHalfLifeDays", label: "HLR 半減期" },
  { key: "hlrElapsedDays", label: "HLR 経過日数" }
];

const columnsForGroupBy = (groupBy: DataLabGroupBy): { key: DataLabTableSortKey; label: string }[] => {
  if (groupBy !== "concept") {
    return BASE_COLUMNS;
  }
  const accuracyIndex = BASE_COLUMNS.findIndex((column) => column.key === "accuracy");
  return [
    ...BASE_COLUMNS.slice(0, accuracyIndex + 1),
    ...CONCEPT_MODEL_COLUMNS,
    ...BASE_COLUMNS.slice(accuracyIndex + 1)
  ];
};

const UNSORTED: DataLabTableSortState = { key: null, direction: "asc" };

const formatCell = (row: DataLabAggregateRow, key: DataLabTableSortKey): string => {
  switch (key) {
    case "label":
      return row.label;
    case "attemptCount":
      return String(row.attemptCount);
    case "correctCount":
      return String(row.correctCount);
    case "incorrectCount":
      return String(row.incorrectCount);
    case "accuracy":
      return formatDataLabAccuracy(row.accuracy);
    case "mastery":
      return formatDataLabMastery(row.masteryProbability ?? null);
    case "pfaNextCorrectProbability":
      return formatDataLabAccuracy(row.pfaNextCorrectProbability ?? null);
    case "pfaSuccessCount":
      return formatDataLabNullableCount(row.pfaSuccessCount ?? null);
    case "pfaFailureCount":
      return formatDataLabNullableCount(row.pfaFailureCount ?? null);
    case "hlrRetentionProbability":
      return formatDataLabAccuracy(row.hlrRetentionProbability ?? null);
    case "hlrHalfLifeDays":
      return formatDataLabDays(row.hlrHalfLifeDays ?? null);
    case "hlrElapsedDays":
      return formatDataLabDays(row.hlrElapsedDays ?? null);
    case "averageResponseTimeMs":
      return formatDataLabAverageResponseTime(row.averageResponseTimeMs);
    case "lastAttemptAt":
      return formatDataLabDateTime(row.lastAttemptAt);
  }
};

export const DataLabTable = ({ rows, groupBy }: Props) => {
  const [sort, setSort] = useState<DataLabTableSortState>(UNSORTED);

  useEffect(() => {
    setSort(UNSORTED);
  }, [groupBy]);

  const sortedRows = useMemo(() => sortDataLabTableRows(rows, sort), [rows, sort]);
  const columns = columnsForGroupBy(groupBy);
  const labelColumn = DATA_LAB_GROUP_BY_COLUMN_LABELS[groupBy];

  const handleSort = (key: DataLabTableSortKey) => {
    setSort((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  };

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-auto rounded-xl border border-celestial-border/70 bg-nordic-navy/35">
      <table className="w-full min-w-[72rem] border-collapse text-left text-sm" data-testid="data-lab-table">
        <thead>
          <tr className="border-b border-celestial-border/50 text-xs tracking-wide text-celestial-textSub">
            {columns.map((column) => {
              const heading = column.key === "label" ? labelColumn : column.label;
              const active = sort.key === column.key;
              const ariaSort = active ? (sort.direction === "asc" ? "ascending" : "descending") : "none";
              const marker = active ? (sort.direction === "asc" ? " ↑" : " ↓") : "";
              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={ariaSort}
                  className="sticky top-0 z-[1] bg-nordic-navy px-4 py-3 font-medium"
                >
                  <button
                    type="button"
                    onClick={() => handleSort(column.key)}
                    className="inline-flex items-center whitespace-nowrap rounded-sm text-left hover:text-celestial-softGold focus:outline-none focus-visible:ring-2 focus-visible:ring-celestial-gold/55"
                    aria-label={`${heading}で並べ替え`}
                  >
                    {heading}
                    {marker}
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row) => (
            <tr key={row.key} className="border-b border-celestial-border/30 last:border-0">
              {columns.map((column, index) => {
                const content = formatCell(row, column.key);
                const className =
                  column.key === "label"
                    ? "max-w-[16rem] px-4 py-3 font-normal text-celestial-textMain"
                    : "whitespace-nowrap px-4 py-3 tabular-nums text-celestial-textMain";
                if (index === 0) {
                  return (
                    <th key={column.key} scope="row" className={className}>
                      <span className="break-words text-celestial-softGold">{content}</span>
                    </th>
                  );
                }
                if (column.key === "lastAttemptAt" && row.lastAttemptAt) {
                  return (
                    <td key={column.key} className="whitespace-nowrap px-4 py-3 text-celestial-textMain">
                      <time dateTime={row.lastAttemptAt}>{content}</time>
                    </td>
                  );
                }
                return (
                  <td key={column.key} className={className}>
                    {content}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
