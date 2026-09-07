import { useEffect, useMemo, useState } from "react";
import type { DataLabAggregateRow, DataLabGroupBy } from "../../utils/dataLab/aggregateDataLabLogs";
import { DATA_LAB_GROUP_BY_COLUMN_LABELS } from "../../utils/dataLab/dataLabGroupByLabels";
import {
  formatDataLabAccuracy,
  formatDataLabAverageResponseTime,
  formatDataLabDateTime
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

const COLUMNS: { key: DataLabTableSortKey; label: string }[] = [
  { key: "label", label: "集計対象" },
  { key: "attemptCount", label: "回答数" },
  { key: "correctCount", label: "正答数" },
  { key: "incorrectCount", label: "誤答数" },
  { key: "accuracy", label: "正答率" },
  { key: "averageResponseTimeMs", label: "平均回答時間" },
  { key: "lastAttemptAt", label: "最終学習日時" }
];

const UNSORTED: DataLabTableSortState = { key: null, direction: "asc" };

export const DataLabTable = ({ rows, groupBy }: Props) => {
  const [sort, setSort] = useState<DataLabTableSortState>(UNSORTED);

  useEffect(() => {
    setSort(UNSORTED);
  }, [groupBy]);

  const sortedRows = useMemo(() => sortDataLabTableRows(rows, sort), [rows, sort]);
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
      <table className="w-full min-w-[52rem] border-collapse text-left text-sm" data-testid="data-lab-table">
        <thead>
          <tr className="border-b border-celestial-border/50 text-xs tracking-wide text-celestial-textSub">
            {COLUMNS.map((column) => {
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
              <th scope="row" className="max-w-[16rem] px-4 py-3 font-normal text-celestial-textMain">
                <span className="break-words text-celestial-softGold">{row.label}</span>
              </th>
              <td className="whitespace-nowrap px-4 py-3 tabular-nums text-celestial-textMain">{row.attemptCount}</td>
              <td className="whitespace-nowrap px-4 py-3 tabular-nums text-celestial-textMain">{row.correctCount}</td>
              <td className="whitespace-nowrap px-4 py-3 tabular-nums text-celestial-textMain">{row.incorrectCount}</td>
              <td className="whitespace-nowrap px-4 py-3 tabular-nums text-celestial-textMain">
                {formatDataLabAccuracy(row.accuracy)}
              </td>
              <td className="whitespace-nowrap px-4 py-3 tabular-nums text-celestial-textMain">
                {formatDataLabAverageResponseTime(row.averageResponseTimeMs)}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-celestial-textMain">
                {row.lastAttemptAt ? (
                  <time dateTime={row.lastAttemptAt}>{formatDataLabDateTime(row.lastAttemptAt)}</time>
                ) : (
                  formatDataLabDateTime(row.lastAttemptAt)
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
