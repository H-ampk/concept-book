import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyConceptInput, type Concept } from "../types/concept";
import { QUIZ_ATTEMPT_LOG_SCHEMA_VERSION, type QuizAttemptLog } from "../types/quiz";
import type { ConceptMastery } from "../utils/mastery/types";

const { getAllConcepts, getQuizAttemptLogs, capturedGraph } = vi.hoisted(() => ({
  getAllConcepts: vi.fn(),
  getQuizAttemptLogs: vi.fn(),
  capturedGraph: {
    conceptMasteryMap: undefined as Map<string, ConceptMastery> | undefined,
    conceptIds: [] as string[]
  }
}));

vi.mock("../storage", () => {
  const methods: Record<string, unknown> = {
    getAllConcepts,
    getQuizAttemptLogs,
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
});
