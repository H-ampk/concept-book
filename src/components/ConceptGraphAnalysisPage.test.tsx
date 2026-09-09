import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyConceptInput, type Concept } from "../types/concept";
import { QUIZ_ATTEMPT_LOG_SCHEMA_VERSION, type QuizAttemptLog } from "../types/quiz";
const { getQuizAttemptLogs, getAllConcepts } = vi.hoisted(() => ({
  getQuizAttemptLogs: vi.fn(),
  getAllConcepts: vi.fn()
}));

vi.mock("../storage", () => ({
  getStorage: () => ({
    getQuizAttemptLogs,
    getAllConcepts
  })
}));

import { ConceptGraphAnalysisPage } from "./ConceptGraphAnalysisPage";

const concept = (overrides: Partial<Concept> = {}): Concept => ({
  ...createEmptyConceptInput(),
  id: "concept-a",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  title: "概念A",
  ...overrides
});

const log = (overrides: Partial<QuizAttemptLog> = {}): QuizAttemptLog => ({
  id: "log-1",
  questionId: "q1",
  questionPromptSnapshot: "問い",
  selectedChoiceId: "c1",
  selectedChoiceTextSnapshot: "選択",
  correctChoiceId: "c2",
  correctChoiceTextSnapshot: "正解",
  correct: false,
  startedAt: "2026-08-15T03:00:00.000Z",
  answeredAt: "2026-08-15T03:00:01.000Z",
  timeMs: 10,
  schemaVersion: QUIZ_ATTEMPT_LOG_SCHEMA_VERSION,
  selectedLinkedConceptId: "concept-a",
  correctLinkedConceptId: "concept-b",
  ...overrides
});

describe("ConceptGraphAnalysisPage (#22)", () => {
  beforeEach(() => {
    getQuizAttemptLogs.mockReset();
    getAllConcepts.mockReset();
  });

  it("実在 Concept には「グラフで見る」があり、クリックで Concept ID を渡す", async () => {
    getQuizAttemptLogs.mockResolvedValue([
      log({
        selectedLinkedConceptId: "concept-a",
        correctLinkedConceptId: "concept-b"
      })
    ]);
    getAllConcepts.mockResolvedValue([
      concept({ id: "concept-a", title: "概念A" }),
      concept({ id: "concept-b", title: "概念B" })
    ]);
    const onOpen = vi.fn();
    render(
      <ConceptGraphAnalysisPage onBack={vi.fn()} onOpenConceptInGraph={onOpen} />
    );

    const buttons = await screen.findAllByRole("button", { name: "グラフで見る" });
    expect(buttons.length).toBeGreaterThan(0);
    await userEvent.click(buttons[0]);
    expect(onOpen).toHaveBeenCalledWith("concept-a");
  });

  it("未分類と削除済み Concept には「グラフで見る」を出さない", async () => {
    getQuizAttemptLogs.mockResolvedValue([
      log({
        id: "u",
        selectedLinkedConceptId: "",
        correctLinkedConceptId: "deleted-id"
      })
    ]);
    getAllConcepts.mockResolvedValue([concept({ id: "concept-a", title: "概念A" })]);
    render(
      <ConceptGraphAnalysisPage onBack={vi.fn()} onOpenConceptInGraph={vi.fn()} />
    );

    await screen.findAllByText("未分類");
    expect(screen.getAllByText("削除済みConcept").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "グラフで見る" })).not.toBeInTheDocument();
  });

  it("focusConceptId のカードを強調し、データが無くてもエラーにしない", async () => {
    getQuizAttemptLogs.mockResolvedValue([
      log({
        selectedLinkedConceptId: "concept-a",
        correctLinkedConceptId: "concept-b"
      })
    ]);
    getAllConcepts.mockResolvedValue([
      concept({ id: "concept-a", title: "概念A" }),
      concept({ id: "concept-b", title: "概念B" }),
      concept({ id: "concept-c", title: "概念C" })
    ]);
    render(
      <ConceptGraphAnalysisPage
        onBack={vi.fn()}
        onOpenConceptInGraph={vi.fn()}
        focusConceptId="concept-c"
      />
    );

    await waitFor(() => {
      expect(screen.getByText("このConceptに関連する混同データはまだありません。")).toBeInTheDocument();
    });
    expect(screen.getByRole("heading", { name: "概念グラフ分析" })).toBeInTheDocument();
  });

  it("focusConceptId に混同データがあるとき対象カードを強調する", async () => {
    getQuizAttemptLogs.mockResolvedValue([
      log({
        selectedLinkedConceptId: "concept-a",
        correctLinkedConceptId: "concept-b"
      })
    ]);
    getAllConcepts.mockResolvedValue([
      concept({ id: "concept-a", title: "概念A" }),
      concept({ id: "concept-b", title: "概念B" })
    ]);
    const { container } = render(
      <ConceptGraphAnalysisPage
        onBack={vi.fn()}
        onOpenConceptInGraph={vi.fn()}
        focusConceptId="concept-a"
      />
    );

    await waitFor(() => {
      expect(container.querySelector("#concept-graph-analysis-card-concept-a")).toBeTruthy();
    });
    const card = container.querySelector("#concept-graph-analysis-card-concept-a");
    expect(card?.className).toContain("border-celestial-softGold");
  });
});
