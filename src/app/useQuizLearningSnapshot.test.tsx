import { render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { QuizAttemptLog, QuizQuestion } from "../types/quiz";
import { QUIZ_ATTEMPT_LOG_SCHEMA_VERSION, QUIZ_QUESTION_SCHEMA_VERSION } from "../types/quiz";
import { noteQuizLearningRevision } from "../storage/quizLearningRevision";

const { getQuizAttemptLogs, getQuizQuestions } = vi.hoisted(() => ({
  getQuizAttemptLogs: vi.fn(),
  getQuizQuestions: vi.fn()
}));

vi.mock("../storage", () => ({
  getStorage: () => ({
    getQuizAttemptLogs,
    getQuizQuestions
  })
}));

import { useQuizLearningSnapshot } from "./useQuizLearningSnapshot";

const log = (id: string, conceptId: string): QuizAttemptLog => ({
  id,
  questionId: "q1",
  questionType: "multiple-choice",
  questionPromptSnapshot: "問い",
  selectedChoiceId: "c1",
  selectedChoiceTextSnapshot: "選択",
  correctChoiceId: "c1",
  correctChoiceTextSnapshot: "正解",
  correct: true,
  startedAt: "2026-01-01T00:00:00.000Z",
  answeredAt: "2026-01-01T00:00:01.000Z",
  timeMs: 1000,
  schemaVersion: QUIZ_ATTEMPT_LOG_SCHEMA_VERSION,
  questionConceptId: conceptId
});

const question = (id: string, conceptId: string): QuizQuestion => ({
  id,
  conceptId,
  prompt: "問い",
  choices: [],
  correctChoiceId: "c1",
  visibility: "private",
  schemaVersion: QUIZ_QUESTION_SCHEMA_VERSION,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
});

const Probe = ({ conceptIds }: { conceptIds: string[] }) => {
  const snapshot = useQuizLearningSnapshot(conceptIds);
  return (
    <div>
      <p data-testid="logs-status">{snapshot.logsStatus}</p>
      <p data-testid="questions-status">{snapshot.questionsStatus}</p>
      <p data-testid="log-ids">{(snapshot.logs ?? []).map((item) => item.id).join(",")}</p>
      <p data-testid="question-concepts">
        {snapshot.quizQuestionConceptIds
          ? [...snapshot.quizQuestionConceptIds].sort().join(",")
          : "unloaded"}
      </p>
      <button type="button" onClick={() => void snapshot.reloadLogs()}>
        reload-logs
      </button>
    </div>
  );
};

const Host = () => {
  const [conceptIds, setConceptIds] = useState(["b", "a"]);
  return (
    <>
      <button type="button" onClick={() => setConceptIds(["a", "b"])}>
        reorder
      </button>
      <button type="button" onClick={() => setConceptIds(["a", "b", "c"])}>
        add-id
      </button>
      <Probe conceptIds={conceptIds} />
    </>
  );
};

describe("useQuizLearningSnapshot", () => {
  beforeEach(() => {
    getQuizAttemptLogs.mockReset();
    getQuizQuestions.mockReset();
    getQuizAttemptLogs.mockResolvedValue([log("log-1", "a")]);
    getQuizQuestions.mockResolvedValue([question("q1", "a")]);
  });

  it("初回だけ取得し、ID の並び替えでは再取得せず、ID 追加では対応だけ更新する", async () => {
    const { getByRole } = render(<Host />);
    await waitFor(() => {
      expect(screen.getByTestId("logs-status")).toHaveTextContent("ready");
      expect(screen.getByTestId("question-concepts")).toHaveTextContent("a");
    });
    expect(getQuizAttemptLogs).toHaveBeenCalledTimes(1);
    expect(getQuizQuestions).toHaveBeenCalledTimes(1);

    getByRole("button", { name: "reorder" }).click();
    await waitFor(() => {
      expect(getQuizQuestions).toHaveBeenCalledTimes(1);
    });

    getByRole("button", { name: "add-id" }).click();
    await waitFor(() => {
      expect(screen.getByTestId("question-concepts")).toHaveTextContent("a");
    });
    expect(getQuizQuestions).toHaveBeenCalledTimes(1);
    expect(getQuizAttemptLogs).toHaveBeenCalledTimes(1);
  });

  it("ログ改訂ではログだけを再取得し、遅い応答は新しい結果を上書きしない", async () => {
    let resolveFirst: (value: QuizAttemptLog[]) => void = () => undefined;
    getQuizAttemptLogs.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        })
    );
    render(<Probe conceptIds={["a"]} />);
    await waitFor(() => {
      expect(getQuizAttemptLogs).toHaveBeenCalledTimes(1);
    });

    getQuizAttemptLogs.mockResolvedValueOnce([log("log-new", "a")]);
    noteQuizLearningRevision("logs");
    await waitFor(() => {
      expect(screen.getByTestId("log-ids")).toHaveTextContent("log-new");
    });
    resolveFirst([log("log-old", "a")]);
    await waitFor(() => {
      expect(screen.getByTestId("log-ids")).toHaveTextContent("log-new");
    });
    expect(getQuizQuestions).toHaveBeenCalledTimes(1);
  });

  it("取得失敗を空データと区別し、再試行で成功結果を載せる", async () => {
    getQuizAttemptLogs.mockRejectedValueOnce(new Error("fail"));
    render(<Probe conceptIds={["a"]} />);
    await waitFor(() => {
      expect(screen.getByTestId("logs-status")).toHaveTextContent("error");
    });
    expect(screen.getByTestId("log-ids")).toHaveTextContent("");
    expect(screen.getByTestId("question-concepts")).toHaveTextContent("a");

    getQuizAttemptLogs.mockResolvedValueOnce([]);
    screen.getByRole("button", { name: "reload-logs" }).click();
    await waitFor(() => {
      expect(screen.getByTestId("logs-status")).toHaveTextContent("ready");
    });
    expect(screen.getByTestId("log-ids")).toHaveTextContent("");
  });
});
