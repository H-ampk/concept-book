import type { QuizAttemptLog } from "../types/quiz";
import { QUIZ_ATTEMPT_LOG_SCHEMA_VERSION } from "../types/quiz";
import { nowIso } from "./date";

export const isValidImportedQuizAttemptLog = (log: QuizAttemptLog): boolean =>
  Boolean(
    log.id.trim() &&
      log.questionId.trim() &&
      log.selectedChoiceId.trim() &&
      log.correctChoiceId.trim()
  );

export const normalizeQuizAttemptLog = (raw: Partial<QuizAttemptLog>): QuizAttemptLog => {
  const timeMsRaw = raw.timeMs;
  const timeMs =
    typeof timeMsRaw === "number" && Number.isFinite(timeMsRaw) && timeMsRaw >= 0 ? timeMsRaw : 0;
  const schemaVersion =
    typeof raw.schemaVersion === "number" && Number.isFinite(raw.schemaVersion)
      ? raw.schemaVersion
      : QUIZ_ATTEMPT_LOG_SCHEMA_VERSION;

  const sid = raw.sessionId?.toString().trim();
  const cid = raw.conceptId?.toString().trim();
  const qcid = raw.questionConceptId?.toString().trim();
  const selLink = raw.selectedLinkedConceptId?.toString().trim();
  const corrLink = raw.correctLinkedConceptId?.toString().trim();
  const did = raw.deckId?.toString().trim();
  const dts = raw.deckTitleSnapshot?.toString().trim();

  return {
    id: raw.id?.toString() ?? "",
    ...(sid ? { sessionId: sid } : {}),
    ...(cid ? { conceptId: cid } : {}),
    questionId: raw.questionId?.toString() ?? "",
    questionPromptSnapshot: raw.questionPromptSnapshot?.toString() ?? "",
    ...(qcid ? { questionConceptId: qcid } : {}),
    selectedChoiceId: raw.selectedChoiceId?.toString() ?? "",
    selectedChoiceTextSnapshot: raw.selectedChoiceTextSnapshot?.toString() ?? "",
    ...(selLink ? { selectedLinkedConceptId: selLink } : {}),
    correctChoiceId: raw.correctChoiceId?.toString() ?? "",
    correctChoiceTextSnapshot: raw.correctChoiceTextSnapshot?.toString() ?? "",
    ...(corrLink ? { correctLinkedConceptId: corrLink } : {}),
    ...(did ? { deckId: did } : {}),
    ...(dts ? { deckTitleSnapshot: dts } : {}),
    correct: Boolean(raw.correct),
    startedAt: raw.startedAt?.toString() ?? nowIso(),
    answeredAt: raw.answeredAt?.toString() ?? nowIso(),
    timeMs,
    schemaVersion
  };
};

/** merge 時は既存 id を優先。バックアップ内の同一 id も保存しない。 */
export const planQuizAttemptLogImport = (
  logs: QuizAttemptLog[],
  existingIds: Set<string>,
  mode: "replace" | "merge"
): { toSave: QuizAttemptLog[]; skipped: number } => {
  const seen = new Set<string>(mode === "merge" ? existingIds : []);
  const toSave: QuizAttemptLog[] = [];
  let skipped = 0;

  for (const log of logs) {
    const normalized = normalizeQuizAttemptLog(log);
    if (!isValidImportedQuizAttemptLog(normalized)) {
      skipped += 1;
      continue;
    }
    if (seen.has(normalized.id)) {
      skipped += 1;
      continue;
    }
    seen.add(normalized.id);
    toSave.push(normalized);
  }

  return { toSave, skipped };
};
