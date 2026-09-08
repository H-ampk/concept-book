import type { QuizAttemptLog } from "../../types/quiz";
import { buildCsv, escapeCsvCell, localDateYmd } from "../csv";

export { escapeCsvCell };

export const LEARNING_LOG_CSV_COLUMNS = [
  "logId",
  "sessionId",
  "startedAt",
  "answeredAt",
  "timeMs",
  "timeSeconds",
  "correct",
  "conceptId",
  "conceptTitleCurrent",
  "questionId",
  "questionPrompt",
  "questionConceptId",
  "questionConceptTitleCurrent",
  "selectedChoiceId",
  "selectedChoiceText",
  "selectedLinkedConceptId",
  "selectedLinkedConceptTitleCurrent",
  "correctChoiceId",
  "correctChoiceText",
  "correctLinkedConceptId",
  "correctLinkedConceptTitleCurrent",
  "deckId",
  "deckTitle",
  "schemaVersion"
] as const;

export type LearningLogCsvColumn = (typeof LEARNING_LOG_CSV_COLUMNS)[number];

const optionalText = (value: string | undefined): string => value ?? "";

const currentTitle = (id: string | undefined, titles: Map<string, string>): string => {
  if (!id) {
    return "";
  }
  return titles.get(id) ?? "";
};

export const learningLogToCsvRow = (
  log: QuizAttemptLog,
  conceptTitles: Map<string, string>
): Record<LearningLogCsvColumn, string | number | boolean> => ({
  logId: log.id,
  sessionId: optionalText(log.sessionId),
  startedAt: log.startedAt,
  answeredAt: log.answeredAt,
  timeMs: log.timeMs,
  timeSeconds: log.timeMs / 1000,
  correct: log.correct,
  conceptId: optionalText(log.conceptId),
  conceptTitleCurrent: currentTitle(log.conceptId, conceptTitles),
  questionId: log.questionId,
  questionPrompt: log.questionPromptSnapshot,
  questionConceptId: optionalText(log.questionConceptId),
  questionConceptTitleCurrent: currentTitle(log.questionConceptId, conceptTitles),
  selectedChoiceId: log.selectedChoiceId,
  selectedChoiceText: log.selectedChoiceTextSnapshot,
  selectedLinkedConceptId: optionalText(log.selectedLinkedConceptId),
  selectedLinkedConceptTitleCurrent: currentTitle(log.selectedLinkedConceptId, conceptTitles),
  correctChoiceId: log.correctChoiceId,
  correctChoiceText: log.correctChoiceTextSnapshot,
  correctLinkedConceptId: optionalText(log.correctLinkedConceptId),
  correctLinkedConceptTitleCurrent: currentTitle(log.correctLinkedConceptId, conceptTitles),
  deckId: optionalText(log.deckId),
  deckTitle: optionalText(log.deckTitleSnapshot),
  schemaVersion: log.schemaVersion
});

export const buildLearningLogCsv = (
  logs: QuizAttemptLog[],
  conceptTitles: Map<string, string>
): string => {
  const rows = logs.map((log) => {
    const row = learningLogToCsvRow(log, conceptTitles);
    return LEARNING_LOG_CSV_COLUMNS.map((column) => row[column]);
  });
  return buildCsv(LEARNING_LOG_CSV_COLUMNS, rows);
};

export const learningLogCsvFilename = (now: Date): string =>
  `conceptbook-learning-logs-${localDateYmd(now)}.csv`;
