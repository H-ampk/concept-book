import type { QuizAttemptLog } from "../../types/quiz";
import { resolveConceptIdFromLog } from "../quiz/resolveConceptIdFromLog";
import { calculateBktMastery, calculateBktMasteryAfterEvidence } from "./bkt";
import { DEFAULT_BKT_PARAMETERS, DEFAULT_FREE_RESPONSE_BKT_EVIDENCE } from "./constants";
import { toConceptMasteryScore } from "./formatConceptMastery";
import { resolveBktEvidence } from "./resolveBktEvidence";
import type { BktParameters, ConceptMasteryPoint, FreeResponseBktEvidenceParameters } from "./types";

export type GetConceptMasteryHistoryOptions = {
  parameters?: BktParameters;
  evidenceParameters?: FreeResponseBktEvidenceParameters;
};

/**
 * 指定 Concept の BKT mastery 履歴を QuizAttemptLog から 1 回の時系列走査で再構成する。
 * resolveConceptIdFromLog() で帰属し、answeredAt 昇順で処理する。入力配列は破壊しない。
 * 時間経過だけでは減衰させない。回答が存在した時点だけ点を作る。
 */
export const getConceptMasteryHistory = (
  logs: QuizAttemptLog[],
  conceptId: string,
  options?: GetConceptMasteryHistoryOptions
): ConceptMasteryPoint[] => {
  const parameters = options?.parameters ?? DEFAULT_BKT_PARAMETERS;
  const evidenceParameters = options?.evidenceParameters ?? DEFAULT_FREE_RESPONSE_BKT_EVIDENCE;
  const conceptLogs = logs.filter((log) => resolveConceptIdFromLog(log) === conceptId);
  const ordered = [...conceptLogs].sort((a, b) => a.answeredAt.localeCompare(b.answeredAt));

  let mastery = calculateBktMastery([], parameters, evidenceParameters);
  const points: ConceptMasteryPoint[] = [];

  for (let index = 0; index < ordered.length; index += 1) {
    const log = ordered[index];
    const previousMasteryProbability = mastery;
    const previousMasteryScore = toConceptMasteryScore(previousMasteryProbability);
    const evidence = resolveBktEvidence(log, { parameters, evidenceParameters });
    mastery = calculateBktMasteryAfterEvidence(mastery, evidence.likelihood, parameters.learnProbability);
    const masteryScore = toConceptMasteryScore(mastery);

    const point: ConceptMasteryPoint = {
      conceptId,
      attemptIndex: index + 1,
      answeredAt: log.answeredAt,
      correct: log.correct,
      masteryProbability: mastery,
      masteryScore,
      previousMasteryProbability,
      previousMasteryScore,
      masteryDelta: masteryScore - previousMasteryScore,
      quizAttemptLogId: log.id,
      questionId: log.questionId,
      questionPromptSnapshot: log.questionPromptSnapshot,
      timeMs: log.timeMs,
      questionType: evidence.questionType,
      evidenceKind: evidence.kind,
      observationOutcome: evidence.outcome
    };
    if (log.sessionId) {
      point.sessionId = log.sessionId;
    }
    if (evidence.selfEvaluation) {
      point.selfEvaluation = evidence.selfEvaluation;
    }
    points.push(point);
  }

  return points;
};
