import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getStorage } from "../storage";
import type { QuizAttemptLog, QuizQuestion } from "../types/quiz";
import { subscribeQuizLearningRevision } from "../storage/quizLearningRevision";
import { buildQuizQuestionConceptIdSet } from "../utils/review/buildQuizQuestionConceptIdSet";

export type QuizLearningLoadStatus = "loading" | "ready" | "error";

const storage = getStorage();

/** 並びと配列参照を除いた Concept ID 集合のキー。ID 内の文字は分割しない。 */
export const conceptIdSetKey = (ids: Iterable<string>): string => JSON.stringify([...ids].sort());

export const idsFromKey = (key: string): string[] => {
  if (key.length === 0) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(key);
    if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "string")) {
      return [];
    }
    return parsed;
  } catch {
    return [];
  }
};

export type QuizLearningSnapshot = {
  logs: QuizAttemptLog[] | null;
  logsStatus: QuizLearningLoadStatus;
  questions: QuizQuestion[] | null;
  questionsStatus: QuizLearningLoadStatus;
  quizQuestionConceptIds: ReadonlySet<string> | null;
  reloadLogs: () => Promise<void>;
  reloadQuestions: () => Promise<void>;
};

/**
 * クイズ問題と学習ログを、改訂が入るまで再取得しない。
 * 概念 ID 集合の変化は、保持している問題からの絞り込みだけを更新する。
 */
export const useQuizLearningSnapshot = (conceptIds: readonly string[]): QuizLearningSnapshot => {
  const [logs, setLogs] = useState<QuizAttemptLog[] | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);
  const [logsStatus, setLogsStatus] = useState<QuizLearningLoadStatus>("loading");
  const [questionsStatus, setQuestionsStatus] = useState<QuizLearningLoadStatus>("loading");
  const logsGeneration = useRef(0);
  const questionsGeneration = useRef(0);
  const conceptKey = conceptIdSetKey(conceptIds);

  const reloadLogs = useCallback(async () => {
    const generation = ++logsGeneration.current;
    setLogsStatus((current) => (current === "ready" ? current : "loading"));
    try {
      const next = await storage.getQuizAttemptLogs();
      if (generation !== logsGeneration.current) {
        return;
      }
      setLogs(next);
      setLogsStatus("ready");
    } catch {
      if (generation !== logsGeneration.current) {
        return;
      }
      setLogsStatus("error");
    }
  }, []);

  const reloadQuestions = useCallback(async () => {
    const generation = ++questionsGeneration.current;
    setQuestionsStatus((current) => (current === "ready" ? current : "loading"));
    try {
      const next = await storage.getQuizQuestions();
      if (generation !== questionsGeneration.current) {
        return;
      }
      setQuestions(next);
      setQuestionsStatus("ready");
    } catch {
      if (generation !== questionsGeneration.current) {
        return;
      }
      setQuestionsStatus("error");
    }
  }, []);

  useEffect(() => {
    void reloadLogs();
    void reloadQuestions();
    return subscribeQuizLearningRevision((change) => {
      if (change.logs) {
        void reloadLogs();
      }
      if (change.questions) {
        void reloadQuestions();
      }
    });
  }, [reloadLogs, reloadQuestions]);

  const validConceptIds = useMemo(() => new Set(idsFromKey(conceptKey)), [conceptKey]);

  const quizQuestionConceptIds = useMemo(() => {
    if (!questions) {
      return null;
    }
    return buildQuizQuestionConceptIdSet(questions, validConceptIds);
  }, [questions, validConceptIds]);

  return {
    logs,
    logsStatus,
    questions,
    questionsStatus,
    quizQuestionConceptIds,
    reloadLogs,
    reloadQuestions
  };
};
