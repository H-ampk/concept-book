import type { DataLabAggregateRow, DataLabGroupBy } from "../../utils/dataLab/aggregateDataLabLogs";
import { DATA_LAB_GROUP_BY_COLUMN_LABELS } from "../../utils/dataLab/dataLabGroupByLabels";
import {
  formatDataLabAccuracy,
  formatDataLabAverageResponseTime,
  formatDataLabDateTime,
  formatDataLabDays,
  formatDataLabMastery
} from "../../utils/dataLab/formatDataLabTable";

type Props = {
  rows: DataLabAggregateRow[];
  groupBy: DataLabGroupBy;
};

export const ResearchAnalysisSnapshotTable = ({ rows, groupBy }: Props) => {
  const showModelMetrics = groupBy === "concept";
  const labelColumn = DATA_LAB_GROUP_BY_COLUMN_LABELS[groupBy];

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-auto rounded-xl border border-celestial-border/70 bg-nordic-navy/35">
      <table
        className="w-full min-w-[64rem] border-collapse text-left text-sm"
        data-testid="research-analysis-snapshot-table"
      >
        <thead>
          <tr className="border-b border-celestial-border/50 text-xs tracking-wide text-celestial-textSub">
            <th className="px-4 py-3 font-medium">{labelColumn}</th>
            <th className="px-4 py-3 font-medium">回答数</th>
            <th className="px-4 py-3 font-medium">正答数</th>
            <th className="px-4 py-3 font-medium">誤答数</th>
            <th className="px-4 py-3 font-medium">正答率</th>
            {showModelMetrics ? (
              <>
                <th className="px-4 py-3 font-medium">BKT 理解度</th>
                <th className="px-4 py-3 font-medium">PFA 次回正答確率</th>
                <th className="px-4 py-3 font-medium">HLR 記憶保持率</th>
                <th className="px-4 py-3 font-medium">HLR 半減期</th>
              </>
            ) : null}
            <th className="px-4 py-3 font-medium">平均回答時間</th>
            <th className="px-4 py-3 font-medium">最終学習日時</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-b border-celestial-border/30 text-celestial-textMain">
              <td className="px-4 py-2">{row.label}</td>
              <td className="px-4 py-2 tabular-nums">{row.attemptCount}</td>
              <td className="px-4 py-2 tabular-nums">{row.correctCount}</td>
              <td className="px-4 py-2 tabular-nums">{row.incorrectCount}</td>
              <td className="px-4 py-2 tabular-nums">{formatDataLabAccuracy(row.accuracy)}</td>
              {showModelMetrics ? (
                <>
                  <td className="px-4 py-2 tabular-nums">{formatDataLabMastery(row.masteryProbability)}</td>
                  <td className="px-4 py-2 tabular-nums">
                    {formatDataLabAccuracy(row.pfaNextCorrectProbability ?? null)}
                  </td>
                  <td className="px-4 py-2 tabular-nums">
                    {formatDataLabAccuracy(row.hlrRetentionProbability ?? null)}
                  </td>
                  <td className="px-4 py-2 tabular-nums">{formatDataLabDays(row.hlrHalfLifeDays ?? null)}</td>
                </>
              ) : null}
              <td className="px-4 py-2 tabular-nums">
                {formatDataLabAverageResponseTime(row.averageResponseTimeMs)}
              </td>
              <td className="px-4 py-2">{formatDataLabDateTime(row.lastAttemptAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
