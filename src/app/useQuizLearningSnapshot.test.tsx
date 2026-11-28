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

import { conceptIdSetKey, idsFromKey, useQuizLearningSnapshot } from "./useQuizLearningSnapshot";

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
  questionType: "multiple-choice",
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
      <button type="button" onClick={() => void snapshot.reloadQuestions()}>
        reload-questions
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

describe("conceptIdSetKey", () => {
  it("並びを無視して復元し、区切り文字や引用符を含む ID を分割しない", () => {
    expect(idsFromKey(conceptIdSetKey(["b", "a"]))).toEqual(["a", "b"]);
    expect(conceptIdSetKey(["b", "a"])).toBe(conceptIdSetKey(["a", "b"]));
    expect(conceptIdSetKey(["a", "b"])).not.toBe(conceptIdSetKey(["a\u0000b"]));
    expect(idsFromKey(conceptIdSetKey(["a\u0000b"]))).toEqual(["a\u0000b"]);
    expect(idsFromKey(conceptIdSetKey(['say "hi"', "a\\b", "日"]))).toEqual(["a\\b", 'say "hi"', "日"]);
    expect(idsFromKey(conceptIdSetKey([]))).toEqual([]);
    expect(conceptIdSetKey(["a"])).not.toBe(conceptIdSetKey(["a", "b"]));
    expect(conceptIdSetKey(["a", "b"])).not.toBe(conceptIdSetKey(["a"]));
  });
});

describe("useQuizLearningSnapshot", () => {
  beforeEach(() => {
    getQuizAttemptLogs.mockReset();
    getQuizQuestions.mockReset();
    getQuizAttemptLogs.mockResolvedValue([log("log-1", "a")]);
    getQuizQuestions.mockResolvedValue([question("q1", "a"), question("q-c", "c")]);
  });

  it("初回だけ取得し、ID の並び替えでは再取得せず、ID 追加では対応だけ更新する", async () => {
    const { getByRole } = render(<Host />);
    await waitFor(() => {
      expect(screen.getByTestId("logs-status")).toHaveTextContent("ready");
      expect(screen.getByTestId("question-concepts")).toHaveTextContent(/^a$/);
    });
    expect(getQuizAttemptLogs).toHaveBeenCalledTimes(1);
    expect(getQuizQuestions).toHaveBeenCalledTimes(1);

    getByRole("button", { name: "reorder" }).click();
    await waitFor(() => {
      expect(getQuizQuestions).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByTestId("question-concepts")).toHaveTextContent(/^a$/);
    expect(screen.getByTestId("question-concepts")).not.toHaveTextContent("c");

    getByRole("button", { name: "add-id" }).click();
    await waitFor(() => {
      expect(screen.getByTestId("question-concepts")).toHaveTextContent(/^a,c$/);
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
    expect(screen.getByTestId("question-concepts")).toHaveTextContent(/^a$/);

    getQuizAttemptLogs.mockResolvedValueOnce([]);
    screen.getByRole("button", { name: "reload-logs" }).click();
    await waitFor(() => {
      expect(screen.getByTestId("logs-status")).toHaveTextContent("ready");
    });
    expect(screen.getByTestId("log-ids")).toHaveTextContent("");
  });

  it("問題の再取得中も取得済みの概念集合を保持し、空配列は未取得と区別する", async () => {
    let resolveReload: (value: QuizQuestion[]) => void = () => undefined;
    getQuizQuestions.mockResolvedValueOnce([question("q1", "a")]);
    render(<Probe conceptIds={["a", "c"]} />);
    await waitFor(() => {
      expect(screen.getByTestId("question-concepts")).toHaveTextContent(/^a$/);
    });

    getQuizQuestions.mockRejectedValueOnce(new Error("fail"));
    screen.getByRole("button", { name: "reload-questions" }).click();
    await waitFor(() => {
      expect(screen.getByTestId("questions-status")).toHaveTextContent("error");
    });
    expect(screen.getByTestId("question-concepts")).toHaveTextContent(/^a$/);
    expect(screen.getByTestId("question-concepts")).not.toHaveTextContent("unloaded");

    getQuizQuestions.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveReload = resolve;
        })
    );
    screen.getByRole("button", { name: "reload-questions" }).click();
    await waitFor(() => {
      expect(screen.getByTestId("questions-status")).toHaveTextContent("loading");
    });
    expect(screen.getByTestId("question-concepts")).toHaveTextContent(/^a$/);

    resolveReload([]);
    await waitFor(() => {
      expect(screen.getByTestId("questions-status")).toHaveTextContent("ready");
    });
    expect(screen.getByTestId("question-concepts")).toHaveTextContent(/^$/);
  });

  it("初回の問題取得が終わるまでは未取得とする", async () => {
    let resolveQuestions: (value: QuizQuestion[]) => void = () => undefined;
    getQuizQuestions.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveQuestions = resolve;
        })
    );
    render(<Probe conceptIds={["a"]} />);
    await waitFor(() => {
      expect(screen.getByTestId("questions-status")).toHaveTextContent("loading");
    });
    expect(screen.getByTestId("question-concepts")).toHaveTextContent(/^unloaded$/);
    resolveQuestions([question("q1", "a")]);
    await waitFor(() => {
      expect(screen.getByTestId("question-concepts")).toHaveTextContent(/^a$/);
    });
  });

  it("NUL を含む概念 ID の問題を、別 ID の集合として投影する", async () => {
    getQuizQuestions.mockResolvedValue([question("q-nul", "a\u0000b")]);
    render(<Probe conceptIds={["a\u0000b"]} />);
    await waitFor(() => {
      expect(screen.getByTestId("question-concepts")).toHaveTextContent(/^a\u0000b$/);
    });
    expect(screen.getByTestId("question-concepts")).not.toHaveTextContent(/^a,b$/);
    expect(getQuizQuestions).toHaveBeenCalledTimes(1);
  });
});
