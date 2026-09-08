import type { Concept } from "../../types/concept";
import type { QuizAttemptLog, QuizDeck } from "../../types/quiz";
import { buildCsv, localDateYmd, type CsvCellValue } from "../csv";
import type { DataLabAggregateRow, DataLabGroupBy } from "./aggregateDataLabLogs";
import { getDataLabLogConceptId } from "./filterDataLabLogs";

export const DATA_LAB_DOMAIN_TAGS_SEPARATOR = "|";

export const DATA_LAB_LOG_CSV_COLUMNS = [
  "logId",
  "answeredAt",
  "startedAt",
  "conceptId",
  "conceptName",
  "deckId",
  "deckName",
  "domainTags",
  "correct",
  "responseTimeMs"
] as const;

export const DATA_LAB_AGGREGATE_CSV_COLUMNS = [
  "groupBy",
  "groupKey",
  "groupLabel",
  "attemptCount",
  "correctCount",
  "incorrectCount",
  "accuracy",
  "masteryProbability",
  "averageResponseTimeMs",
  "firstAttemptAt",
  "lastAttemptAt",
  "conceptId",
  "domainTag",
  "deckId",
  "periodStart",
  "periodEnd"
] as const;

export type DataLabLogCsvColumn = (typeof DATA_LAB_LOG_CSV_COLUMNS)[number];
export type DataLabAggregateCsvColumn = (typeof DATA_LAB_AGGREGATE_CSV_COLUMNS)[number];

const dataLabConceptName = (conceptId: string | null, conceptById: Map<string, Concept>): string => {
  if (!conceptId) {
    return "Conceptなし";
  }
  const title = conceptById.get(conceptId)?.title?.trim();
  if (title) {
    return title;
  }
  return "削除済みConcept";
};

const dataLabDeckName = (
  deckId: string | null,
  log: QuizAttemptLog,
  deckById: Map<string, QuizDeck>
): string => {
  if (!deckId) {
    return "自由学習";
  }
  const liveTitle = deckById.get(deckId)?.title?.trim();
  if (liveTitle) {
    return liveTitle;
  }
  const snapshot = log.deckTitleSnapshot?.trim();
  if (snapshot) {
    return `${snapshot}（削除済み）`;
  }
  return "削除済みDeck";
};

const dataLabDomainTagsCell = (conceptId: string | null, conceptById: Map<string, Concept>): string => {
  if (!conceptId) {
    return "";
  }
  const concept = conceptById.get(conceptId);
  if (!concept) {
    return "";
  }
  const uniqueTags = [...new Set((concept.domainTags ?? []).map((tag) => tag.trim()).filter(Boolean))];
  return uniqueTags.join(DATA_LAB_DOMAIN_TAGS_SEPARATOR);
};

export const dataLabLogToCsvCells = (
  log: QuizAttemptLog,
  conceptById: Map<string, Concept>,
  deckById: Map<string, QuizDeck>
): Record<DataLabLogCsvColumn, CsvCellValue> => {
  const conceptId = getDataLabLogConceptId(log);
  const deckId = log.deckId?.trim() || null;
  return {
    logId: log.id,
    answeredAt: log.answeredAt,
    startedAt: log.startedAt,
    conceptId: conceptId ?? "",
    conceptName: dataLabConceptName(conceptId, conceptById),
    deckId: deckId ?? "",
    deckName: dataLabDeckName(deckId, log, deckById),
    domainTags: dataLabDomainTagsCell(conceptId, conceptById),
    correct: log.correct,
    responseTimeMs: log.timeMs
  };
};

export const buildDataLabLogCsv = (
  filteredLogs: QuizAttemptLog[],
  conceptById: Map<string, Concept>,
  deckById: Map<string, QuizDeck>
): string => {
  const rows = filteredLogs.map((log) => {
    const cells = dataLabLogToCsvCells(log, conceptById, deckById);
    return DATA_LAB_LOG_CSV_COLUMNS.map((column) => cells[column]);
  });
  return buildCsv(DATA_LAB_LOG_CSV_COLUMNS, rows);
};

export const dataLabAggregateToCsvCells = (
  row: DataLabAggregateRow
): Record<DataLabAggregateCsvColumn, CsvCellValue> => ({
  groupBy: row.groupBy,
  groupKey: row.key,
  groupLabel: row.label,
  attemptCount: row.attemptCount,
  correctCount: row.correctCount,
  incorrectCount: row.incorrectCount,
  accuracy: row.accuracy,
  masteryProbability: row.masteryProbability,
  averageResponseTimeMs: row.averageResponseTimeMs,
  firstAttemptAt: row.firstAttemptAt,
  lastAttemptAt: row.lastAttemptAt,
  conceptId: row.conceptId,
  domainTag: row.domainTag,
  deckId: row.deckId,
  periodStart: row.periodStart,
  periodEnd: row.periodEnd
});

export const buildDataLabAggregateCsv = (aggregatedRows: DataLabAggregateRow[]): string => {
  const rows = aggregatedRows.map((row) => {
    const cells = dataLabAggregateToCsvCells(row);
    return DATA_LAB_AGGREGATE_CSV_COLUMNS.map((column) => cells[column]);
  });
  return buildCsv(DATA_LAB_AGGREGATE_CSV_COLUMNS, rows);
};

export const dataLabLogCsvFilename = (now: Date): string =>
  `conceptbook-datalab-logs-${localDateYmd(now)}.csv`;

export const dataLabAggregateCsvFilename = (groupBy: DataLabGroupBy, now: Date): string =>
  `conceptbook-datalab-${groupBy}-${localDateYmd(now)}.csv`;
