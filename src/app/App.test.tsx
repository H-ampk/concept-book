import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyConceptInput, type Concept } from "../types/concept";
import { QUIZ_ATTEMPT_LOG_SCHEMA_VERSION, type QuizAttemptLog } from "../types/quiz";
import type { ConceptMastery } from "../utils/mastery/types";

const { getAllConcepts, getQuizAttemptLogs, getQuizQuestions, capturedGraph } = vi.hoisted(() => ({
  getAllConcepts: vi.fn(),
  getQuizAttemptLogs: vi.fn(),
  getQuizQuestions: vi.fn(),
  capturedGraph: {
    conceptMasteryMap: undefined as Map<string, ConceptMastery> | undefined,
    conceptIds: [] as string[]
  }
}));

vi.mock("../storage", () => {
  const methods: Record<string, unknown> = {
    getAllConcepts,
    getQuizAttemptLogs,
    getQuizQuestions,
    updateConcept: vi.fn(async () => undefined),
    getMediaBlob: vi.fn(async () => undefined),
    getAllContextCards: vi.fn(async () => [])
  };
  const storage = new Proxy(methods, {
    get(target, prop) {
      if (prop in target) {
        return target[prop as string];
      }
      return vi.fn(async () => []);
    }
  });
  return {
    getStorage: () => storage,
    getContextStorage: () => storage
  };
});

vi.mock("../components/ConceptGraphView", () => ({
  ConceptGraphView: (props: {
    conceptMasteryMap?: Map<string, ConceptMastery>;
    concepts: { id: string }[];
  }) => {
    capturedGraph.conceptMasteryMap = props.conceptMasteryMap;
    capturedGraph.conceptIds = props.concepts.map((concept) => concept.id);
    return <div data-testid="concept-graph-view">graph</div>;
  }
}));

import { noteQuizLearningRevision } from "../storage/quizLearningRevision";
import * as masteryModule from "../utils/mastery/getConceptMastery";
import { App } from "./App";

const concept = (overrides: Partial<Concept> = {}): Concept => ({
  ...createEmptyConceptInput(),
  id: "concept-a",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  title: "概念A",
  definition: "定義",
  status: "active",
  ...overrides
});

const log = (overrides: Partial<QuizAttemptLog> = {}): QuizAttemptLog => ({
  id: "log-1",
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
  questionConceptId: "concept-thin",
  ...overrides
});

describe("App mastery overview (#56)", () => {
  beforeEach(() => {
    getAllConcepts.mockReset();
    getQuizAttemptLogs.mockReset();
    getQuizQuestions.mockReset();
    getQuizQuestions.mockResolvedValue([]);
    capturedGraph.conceptMasteryMap = undefined;
    capturedGraph.conceptIds = [];
    getAllConcepts.mockResolvedValue([
      concept({ id: "concept-unlearned", title: "未学習の概念" }),
      concept({ id: "concept-thin", title: "データ不足の概念" })
    ]);
    getQuizAttemptLogs.mockResolvedValue([
      log({ id: "thin-1", questionConceptId: "concept-thin", correct: true })
    ]);
  });

  it("理解度フィルタが表示され、未学習で絞り、mastery Map が一覧とグラフへ渡る", async () => {
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId("concept-list-item-concept-unlearned")).toBeInTheDocument();
    });

    const filter = screen.getByTestId("mastery-overview-filter");
    expect(within(filter).getByText("理解度:")).toBeInTheDocument();
    expect(within(filter).getByRole("button", { name: "すべて" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(within(filter).getByRole("button", { name: "未学習" })).toBeInTheDocument();
    expect(within(filter).getByRole("button", { name: "データ不足" })).toBeInTheDocument();

    expect(
      within(screen.getByTestId("concept-list-item-concept-unlearned")).getByText("未学習")
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId("concept-list-item-concept-thin")).getByText("データ不足")
    ).toBeInTheDocument();

    await user.click(within(filter).getByRole("button", { name: "未学習" }));
    expect(screen.getByTestId("concept-list-item-concept-unlearned")).toBeInTheDocument();
    expect(screen.queryByTestId("concept-list-item-concept-thin")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "グラフ表示" }));
    await waitFor(() => {
      expect(screen.getByTestId("concept-graph-view")).toBeInTheDocument();
    });
    expect(capturedGraph.conceptIds).toEqual(["concept-unlearned"]);
    expect(capturedGraph.conceptMasteryMap?.get("concept-unlearned")?.state).toBe("unlearned");
    expect(capturedGraph.conceptMasteryMap?.get("concept-thin")?.state).toBe("insufficient-data");
  });

  it("概念画面を離れて戻っても、学習ログと問題を再取得しない", async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => {
      expect(getQuizAttemptLogs).toHaveBeenCalledTimes(1);
      expect(getQuizQuestions).toHaveBeenCalledTimes(1);
    });

    await user.click(screen.getByRole("button", { name: "文脈" }));
    await user.click(screen.getByRole("button", { name: "概念" }));

    expect(getQuizAttemptLogs).toHaveBeenCalledTimes(1);
    expect(getQuizQuestions).toHaveBeenCalledTimes(1);
  });

  it("ログ再取得の失敗後も、取得済みの習熟度表示を残す", async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getAllByText("データ不足").length).toBeGreaterThan(0);
    });
    const reads = getQuizAttemptLogs.mock.calls.length;

    getQuizAttemptLogs.mockRejectedValueOnce(new Error("reload failed"));
    noteQuizLearningRevision("logs");

    await waitFor(() => {
      expect(screen.getByTestId("quiz-learning-reload-error")).toBeInTheDocument();
    });
    expect(screen.getAllByText("データ不足").length).toBeGreaterThan(0);
    expect(getQuizAttemptLogs.mock.calls.length).toBe(reads + 1);
    expect(getQuizQuestions.mock.calls.length).toBe(1);
  });

  it("ログ未取得のあいだは統計の未学習表示を出さない", async () => {
    const user = userEvent.setup();
    let resolveLogs: (logs: QuizAttemptLog[]) => void = () => undefined;
    getQuizAttemptLogs.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveLogs = resolve;
        })
    );
    render(<App />);
    await waitFor(() => {
      expect(screen.getByTestId("concept-list-item-concept-unlearned")).toBeInTheDocument();
    });
    await user.click(screen.getByTestId("concept-list-item-concept-unlearned"));
    expect(screen.queryByRole("heading", { name: "学習状況" })).not.toBeInTheDocument();

    resolveLogs([]);
    await waitFor(() => {
      expect(screen.queryByTestId("quiz-learning-loading")).not.toBeInTheDocument();
    });
    expect(screen.queryByRole("heading", { name: "学習状況" })).not.toBeInTheDocument();
  });

  it("概念画面へ戻ると freshness を更新し、ログ再取得と BKT 再計算はしない", async () => {
    const user = userEvent.setup();
    const bkt = vi.spyOn(masteryModule, "buildConceptMasteryMap");
    const freshness = vi.spyOn(masteryModule, "refreshConceptMasteryFreshness");
    render(<App />);
    await waitFor(() => {
      expect(bkt).toHaveBeenCalled();
    });
    const bktCalls = bkt.mock.calls.length;
    const reads = getQuizAttemptLogs.mock.calls.length;
    const freshnessCalls = freshness.mock.calls.length;

    await user.click(screen.getByRole("button", { name: "文脈" }));
    await user.click(screen.getByRole("button", { name: "概念" }));

    await waitFor(() => {
      expect(freshness.mock.calls.length).toBeGreaterThan(freshnessCalls);
    });
    expect(bkt.mock.calls.length).toBe(bktCalls);
    expect(getQuizAttemptLogs.mock.calls.length).toBe(reads);
    bkt.mockRestore();
    freshness.mockRestore();
  });
});
