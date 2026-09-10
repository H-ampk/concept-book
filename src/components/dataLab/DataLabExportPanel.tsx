import { useMemo, useState } from "react";
import type { Concept } from "../../types/concept";
import type { QuizAttemptLog, QuizDeck } from "../../types/quiz";
import type { DataLabAggregateRow, DataLabGroupBy } from "../../utils/dataLab/aggregateDataLabLogs";
import {
  buildDataLabAggregateCsv,
  buildDataLabLogCsv,
  buildDataLabPredictionCsv,
  dataLabAggregateCsvFilename,
  dataLabLogCsvFilename,
  dataLabPredictionCsvFilename
} from "../../utils/dataLab/dataLabCsvExport";
import { DATA_LAB_GROUP_BY_CONTROL_LABELS } from "../../utils/dataLab/dataLabGroupByLabels";
import { downloadBlob } from "../../utils/downloadFile";
import type { LearningModelPredictionPoint } from "../../utils/learningModelEvaluation/types";

export type DataLabExportTarget = "logs" | "aggregate" | "predictions";

type Props = {
  filteredLogs: QuizAttemptLog[];
  aggregatedRows: DataLabAggregateRow[];
  predictionPoints: LearningModelPredictionPoint[];
  groupBy: DataLabGroupBy;
  conceptById: Map<string, Concept>;
  deckById: Map<string, QuizDeck>;
};

const inputClass =
  "w-full rounded-md border border-celestial-border/60 bg-nordic-navy/50 px-3 py-2 text-sm text-celestial-textMain focus:outline-none focus-visible:ring-2 focus-visible:ring-celestial-gold/55";

export const DataLabExportPanel = ({
  filteredLogs,
  aggregatedRows,
  predictionPoints,
  groupBy,
  conceptById,
  deckById
}: Props) => {
  const [target, setTarget] = useState<DataLabExportTarget>("aggregate");

  const rowCount =
    target === "logs"
      ? filteredLogs.length
      : target === "predictions"
        ? predictionPoints.length
        : aggregatedRows.length;
  const canExport = rowCount > 0;

  const summary = useMemo(() => {
    if (target === "logs") {
      return { targetLabel: "フィルタ済みログ", count: filteredLogs.length };
    }
    if (target === "predictions") {
      return { targetLabel: "予測評価データ", count: predictionPoints.length };
    }
    return {
      targetLabel: "集計結果",
      groupByLabel: DATA_LAB_GROUP_BY_CONTROL_LABELS[groupBy],
      count: aggregatedRows.length
    };
  }, [aggregatedRows.length, filteredLogs.length, groupBy, predictionPoints.length, target]);

  const handleSave = () => {
    if (!canExport) {
      return;
    }
    if (target === "logs") {
      const csv = buildDataLabLogCsv(filteredLogs, conceptById, deckById);
      downloadBlob(
        dataLabLogCsvFilename(new Date()),
        new Blob([csv], { type: "text/csv;charset=utf-8" })
      );
      return;
    }
    if (target === "predictions") {
      const csv = buildDataLabPredictionCsv(predictionPoints);
      downloadBlob(
        dataLabPredictionCsvFilename(new Date()),
        new Blob([csv], { type: "text/csv;charset=utf-8" })
      );
      return;
    }
    const csv = buildDataLabAggregateCsv(aggregatedRows);
    downloadBlob(
      dataLabAggregateCsvFilename(groupBy, new Date()),
      new Blob([csv], { type: "text/csv;charset=utf-8" })
    );
  };

  return (
    <section
      className="relative min-w-0 max-w-full rounded-3xl border border-celestial-border bg-celestial-panel/90 p-5 shadow-celestial backdrop-blur-md decorated-card sm:p-6"
      aria-labelledby="data-lab-export-title"
    >
      <div className="relative z-[1] space-y-4">
        <div className="space-y-1">
          <h2 id="data-lab-export-title" className="text-sm font-semibold text-celestial-softGold">
            CSV エクスポート
          </h2>
          <p className="text-xs text-celestial-textSub">
            画面で使っているフィルタ済みログ、集計結果、または予測評価データを、そのまま CSV として保存します。
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="min-w-0 space-y-1.5">
            <span className="text-xs font-medium text-celestial-textSub">対象</span>
            <select
              className={inputClass}
              aria-label="CSVエクスポート対象"
              value={target}
              onChange={(event) => setTarget(event.target.value as DataLabExportTarget)}
            >
              <option value="aggregate">集計結果</option>
              <option value="logs">フィルタ済みログ</option>
              <option value="predictions">予測評価データ</option>
            </select>
          </label>
        </div>

        <div
          className="rounded-xl border border-celestial-border/60 bg-nordic-navy/40 px-4 py-3 text-sm text-celestial-textMain"
          data-testid="data-lab-export-summary"
        >
          <p>出力対象: {summary.targetLabel}</p>
          {target === "aggregate" ? <p>集計軸: {summary.groupByLabel}</p> : null}
          <p>件数: {summary.count}</p>
        </div>

        {!canExport ? (
          <p className="text-sm text-celestial-textSub" data-testid="data-lab-export-empty">
            エクスポートできるデータがありません。
          </p>
        ) : null}

        <button
          type="button"
          onClick={handleSave}
          disabled={!canExport}
          className="rounded-md border border-celestial-gold/50 bg-transparent px-3 py-2 text-sm text-celestial-softGold hover:bg-celestial-gold/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-celestial-gold/55 disabled:cursor-not-allowed disabled:opacity-40"
        >
          CSVを保存
        </button>
      </div>
    </section>
  );
};
