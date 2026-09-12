import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyConceptInput, type Concept } from "../types/concept";
import { QUIZ_ATTEMPT_LOG_SCHEMA_VERSION, type QuizAttemptLog } from "../types/quiz";

const { getQuizAttemptLogs, getAllConcepts, getQuizQuestions } = vi.hoisted(() => ({
  getQuizAttemptLogs: vi.fn(),
  getAllConcepts: vi.fn(),
  getQuizQuestions: vi.fn()
}));

vi.mock("../storage", () => ({
  getStorage: () => ({
    getQuizAttemptLogs,
    getAllConcepts,
    getQuizQuestions
  })
}));

import { QuizAnalysisDashboardPage } from "./QuizAnalysisDashboardPage";

const concept = (overrides: Partial<Concept> = {}): Concept => ({
  ...createEmptyConceptInput(),
  id: "concept-a",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  title: "古典的条件づけ",
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
  startedAt: "2026-09-05T03:00:00.000Z",
  answeredAt: "2026-09-05T03:00:01.000Z",
  timeMs: 10,
  schemaVersion: QUIZ_ATTEMPT_LOG_SCHEMA_VERSION,
  ...overrides
});

describe("QuizAnalysisDashboardPage 混同概念分析 (#26)", () => {
  beforeEach(() => {
    getQuizAttemptLogs.mockReset();
    getAllConcepts.mockReset();
    getQuizQuestions.mockReset();
    getQuizQuestions.mockResolvedValue([]);
  });

  it("A→B と B→A を別カードで表示し、回数・回答数・率を同時に出す", async () => {
    getQuizAttemptLogs.mockResolvedValue([
      log({
        id: "ab",
        correctLinkedConceptId: "concept-a",
        selectedLinkedConceptId: "concept-b",
        correct: false,
        answeredAt: "2026-09-01T00:00:00.000Z"
      }),
      log({
        id: "ba",
        correctLinkedConceptId: "concept-b",
        selectedLinkedConceptId: "concept-a",
        correct: false,
        answeredAt: "2026-09-02T00:00:00.000Z"
      }),
      log({
        id: "a-ok",
        correctLinkedConceptId: "concept-a",
        selectedLinkedConceptId: "concept-a",
        correct: true,
        answeredAt: "2026-09-03T00:00:00.000Z"
      })
    ]);
    getAllConcepts.mockResolvedValue([
      concept({ id: "concept-a", title: "古典的条件づけ" }),
      concept({ id: "concept-b", title: "オペラント条件づけ" })
    ]);

    render(
      <QuizAnalysisDashboardPage
        onBack={vi.fn()}
        onGoToQuizPlay={vi.fn()}
        onGoToLearningLogs={vi.fn()}
      />
    );

    expect(await screen.findByRole("heading", { name: "混同概念分析" })).toBeInTheDocument();
    const ab = await screen.findByTestId("confusion-pair-concept-a-concept-b");
    const ba = screen.getByTestId("confusion-pair-concept-b-concept-a");
    expect(ab).toHaveTextContent("古典的条件づけ");
    expect(ab).toHaveTextContent("→ オペラント条件づけ");
    expect(ab).toHaveTextContent("古典的条件づけ を オペラント条件づけ と誤答");
    expect(ab).toHaveTextContent("1回 / 2回答");
    expect(ab).toHaveTextContent("混同率 50.0%");
    expect(ba).toHaveTextContent("オペラント条件づけ を 古典的条件づけ と誤答");
    expect(ba).toHaveTextContent("1回 / 1回答");
    expect(screen.getByRole("heading", { name: "Concept ごとのよく混同する Concept" })).toBeInTheDocument();
    expect(screen.getByText("よく混同するConcept")).toBeInTheDocument();
  });

  it("削除済み Concept を安全に表示する", async () => {
    getQuizAttemptLogs.mockResolvedValue([
      log({
        id: "deleted",
        correctLinkedConceptId: "gone-correct",
        selectedLinkedConceptId: "gone-selected",
        correct: false
      })
    ]);
    getAllConcepts.mockResolvedValue([concept()]);

    render(
      <QuizAnalysisDashboardPage
        onBack={vi.fn()}
        onGoToQuizPlay={vi.fn()}
        onGoToLearningLogs={vi.fn()}
      />
    );

    const card = await screen.findByTestId("confusion-pair-gone-correct-gone-selected");
    expect(card).toHaveTextContent("削除済みConcept を 削除済みConcept と誤答");
  });

  it("期間フィルタ後のログだけで混同を再計算する", async () => {
    getQuizAttemptLogs.mockResolvedValue([
      log({
        id: "in-period",
        correctLinkedConceptId: "concept-a",
        selectedLinkedConceptId: "concept-b",
        correct: false,
        answeredAt: "2026-09-05T00:00:00.000Z"
      }),
      log({
        id: "out-period",
        correctLinkedConceptId: "concept-a",
        selectedLinkedConceptId: "concept-c",
        correct: false,
        answeredAt: "2026-08-01T00:00:00.000Z"
      })
    ]);
    getAllConcepts.mockResolvedValue([
      concept({ id: "concept-a", title: "古典的条件づけ" }),
      concept({ id: "concept-b", title: "オペラント条件づけ" }),
      concept({ id: "concept-c", title: "条件反射" })
    ]);

    render(
      <QuizAnalysisDashboardPage
        onBack={vi.fn()}
        onGoToQuizPlay={vi.fn()}
        onGoToLearningLogs={vi.fn()}
      />
    );

    expect(await screen.findByTestId("confusion-pair-concept-a-concept-b")).toBeInTheDocument();
    expect(screen.getByTestId("confusion-pair-concept-a-concept-c")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("開始日"), { target: { value: "2026-09-01" } });
    fireEvent.change(screen.getByLabelText("終了日"), { target: { value: "2026-09-30" } });

    await waitFor(() => {
      expect(screen.getByTestId("confusion-pair-concept-a-concept-b")).toBeInTheDocument();
      expect(screen.queryByTestId("confusion-pair-concept-a-concept-c")).not.toBeInTheDocument();
    });
  });
});

describe("QuizAnalysisDashboardPage 復習候補 (#58 Phase 1)", () => {
  beforeEach(() => {
    getQuizAttemptLogs.mockReset();
    getAllConcepts.mockReset();
    getQuizQuestions.mockReset();
    getQuizQuestions.mockResolvedValue([]);
  });

  it("苦手 Concept を理由つきで表示し、問題なしも残す", async () => {
    getQuizAttemptLogs.mockResolvedValue([
      log({
        id: "1",
        questionConceptId: "concept-a",
        correct: true,
        answeredAt: "2026-09-10T00:00:00.000Z"
      }),
      log({
        id: "2",
        questionConceptId: "concept-a",
        correct: false,
        answeredAt: "2026-09-11T00:00:00.000Z"
      }),
      log({
        id: "3",
        questionConceptId: "concept-a",
        correct: false,
        answeredAt: "2026-09-12T00:00:00.000Z"
      })
    ]);
    getAllConcepts.mockResolvedValue([concept({ id: "concept-a", title: "社会的手抜き" })]);

    render(
      <QuizAnalysisDashboardPage
        onBack={vi.fn()}
        onGoToQuizPlay={vi.fn()}
        onGoToLearningLogs={vi.fn()}
      />
    );

    const card = await screen.findByTestId("review-candidate-concept-a");
    expect(screen.getByRole("heading", { name: "今日の復習候補" })).toBeInTheDocument();
    expect(card).toHaveTextContent("社会的手抜き");
    expect(card).toHaveTextContent("優先度 高");
    expect(card).toHaveTextContent("安定して正答できていません");
    expect(card).toHaveTextContent("最近3回中2回誤答");
    expect(card).toHaveTextContent("復習が必要ですが、対応する問題がありません");
  });
});
