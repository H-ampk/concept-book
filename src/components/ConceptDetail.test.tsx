import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createEmptyConceptInput, type Concept } from "../types/concept";
import type { ConceptMastery, ConceptMasteryPoint } from "../utils/mastery/types";
import { ConceptDetail } from "./ConceptDetail";

vi.mock("../storage", () => ({
  getStorage: () => ({
    getMediaBlob: async () => null
  })
}));

const concept = (overrides: Partial<Concept> = {}): Concept => ({
  ...createEmptyConceptInput(),
  id: "c1",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  title: "対象",
  definition: "定義",
  ...overrides
});

const mastery = (overrides: Partial<ConceptMastery> = {}): ConceptMastery => ({
  conceptId: "c1",
  masteryProbability: 0.68,
  masteryScore: 68,
  state: "developing",
  attemptCount: 5,
  correctCount: 4,
  incorrectCount: 1,
  accuracy: 0.8,
  confidence: "medium",
  lastAnsweredAt: "2026-09-10T14:32:00.000Z",
  freshness: "fresh",
  recentResults: [true, false, true],
  avgReactionTimeMs: 4200,
  ...overrides
});

const historyPoint = (overrides: Partial<ConceptMasteryPoint> = {}): ConceptMasteryPoint => ({
  conceptId: "c1",
  attemptIndex: 1,
  answeredAt: "2026-09-10T05:32:00.000Z",
  correct: true,
  masteryProbability: 0.5,
  masteryScore: 50,
  previousMasteryProbability: 0.2,
  previousMasteryScore: 20,
  masteryDelta: 30,
  quizAttemptLogId: "log-1",
  questionId: "q-1",
  questionPromptSnapshot: "○○とは何か？",
  timeMs: 4200,
  ...overrides
});

describe("ConceptDetail (#22)", () => {
  const baseProps = {
    concept: concept(),
    conceptMap: new Map<string, Concept>(),
    domainColorMap: {},
    onSelectRelated: vi.fn(),
    onRequestDelete: vi.fn(),
    deleting: false
  };

  it("onOpenGraphAnalysis が無いときは分析ボタンを出さない", () => {
    render(<ConceptDetail {...baseProps} />);
    expect(screen.queryByRole("button", { name: "この概念を分析" })).not.toBeInTheDocument();
  });

  it("onOpenGraphAnalysis があるとき Concept ID を渡す", async () => {
    const onOpen = vi.fn();
    render(<ConceptDetail {...baseProps} onOpenGraphAnalysis={onOpen} />);
    await userEvent.click(screen.getByRole("button", { name: "この概念を分析" }));
    expect(onOpen).toHaveBeenCalledWith("c1");
  });
});

describe("ConceptDetail mastery history (#57)", () => {
  const baseProps = {
    concept: concept(),
    conceptMap: new Map<string, Concept>(),
    domainColorMap: {},
    onSelectRelated: vi.fn(),
    onRequestDelete: vi.fn(),
    deleting: false
  };

  it("理解度の直後に推移セクションを置き、0件では empty state を出す", () => {
    render(
      <ConceptDetail
        {...baseProps}
        conceptMastery={mastery({ attemptCount: 0, confidence: "none", state: "unlearned" })}
        conceptMasteryHistory={[]}
      />
    );
    const headings = screen.getAllByRole("heading", { level: 3 }).map((el) => el.textContent);
    const masteryIndex = headings.indexOf("理解度");
    const historyIndex = headings.indexOf("理解度の推移");
    expect(masteryIndex).toBeGreaterThanOrEqual(0);
    expect(historyIndex).toBe(masteryIndex + 1);
    expect(screen.getByText("理解度の推移を表示する回答履歴がありません。")).toBeInTheDocument();
    expect(screen.queryByTestId("concept-mastery-history-chart")).not.toBeInTheDocument();
  });

  it("1〜2件かつ confidence low ではグラフと低信頼度表示を出す", () => {
    render(
      <ConceptDetail
        {...baseProps}
        conceptMastery={mastery({ attemptCount: 2, confidence: "low", state: "insufficient-data" })}
        conceptMasteryHistory={[
          historyPoint({ masteryScore: 0 }),
          historyPoint({ attemptIndex: 2, masteryScore: 100, correct: false, quizAttemptLogId: "log-2" })
        ]}
      />
    );
    expect(screen.getByTestId("concept-mastery-history-chart")).toBeInTheDocument();
    expect(screen.getByText("回答数が少ないため、この推定値の信頼度は低い状態です。")).toBeInTheDocument();
  });

  it("履歴があるときグラフ領域を表示する", () => {
    render(
      <ConceptDetail
        {...baseProps}
        conceptMastery={mastery()}
        conceptMasteryHistory={[
          historyPoint({ correct: true }),
          historyPoint({ attemptIndex: 2, correct: false, quizAttemptLogId: "log-2" }),
          historyPoint({ attemptIndex: 3, correct: true, masteryScore: 79, quizAttemptLogId: "log-3" })
        ]}
      />
    );
    expect(screen.getByTestId("concept-mastery-history-chart")).toBeInTheDocument();
    expect(screen.getByText("○ 正解")).toBeInTheDocument();
    expect(screen.getByText("× 誤答")).toBeInTheDocument();
    expect(screen.getByText(/全3回答/)).toBeInTheDocument();
    expect(screen.getByText(/最新理解度79/)).toBeInTheDocument();
  });

  it("Concept を変更すると別 Concept の履歴になる", () => {
    const { rerender } = render(
      <ConceptDetail
        {...baseProps}
        concept={concept({ id: "a", title: "概念A" })}
        conceptMastery={mastery({ conceptId: "a", attemptCount: 1, confidence: "low" })}
        conceptMasteryHistory={[historyPoint({ conceptId: "a", masteryScore: 41 })]}
      />
    );
    expect(screen.getByText(/最新理解度41/)).toBeInTheDocument();

    rerender(
      <ConceptDetail
        {...baseProps}
        concept={concept({ id: "b", title: "概念B" })}
        conceptMastery={mastery({ conceptId: "b", attemptCount: 2, confidence: "low" })}
        conceptMasteryHistory={[
          historyPoint({ conceptId: "b", masteryScore: 55, quizAttemptLogId: "b1" }),
          historyPoint({ conceptId: "b", attemptIndex: 2, masteryScore: 62, quizAttemptLogId: "b2" })
        ]}
      />
    );
    expect(screen.getByText("概念B")).toBeInTheDocument();
    expect(screen.getByText(/全2回答/)).toBeInTheDocument();
    expect(screen.getByText(/最新理解度62/)).toBeInTheDocument();
    expect(screen.queryByText(/最新理解度41/)).not.toBeInTheDocument();
  });
});

describe("ConceptDetail prerequisites (#118)", () => {
  const probability = concept({
    id: "prob",
    title: "確率",
    prerequisiteIds: []
  });
  const bayes = concept({
    id: "bayes",
    title: "ベイズの定理",
    prerequisiteIds: ["prob"]
  });
  const inference = concept({
    id: "inf",
    title: "ベイズ推論",
    prerequisiteIds: ["bayes"]
  });
  const all = [probability, bayes, inference];
  const conceptMap = new Map(all.map((item) => [item.id, item]));

  const baseProps = {
    conceptMap,
    domainColorMap: {},
    onSelectRelated: vi.fn(),
    onRequestDelete: vi.fn(),
    deleting: false
  };

  it("空の前提概念でも表示が崩れない", () => {
    render(<ConceptDetail {...baseProps} concept={probability} />);
    expect(screen.getByText("前提概念")).toBeInTheDocument();
    expect(screen.getByText("前提概念なし")).toBeInTheDocument();
    expect(screen.getByText("この概念を前提とする概念")).toBeInTheDocument();
  });

  it("前提概念と dependent Concept を表示する", async () => {
    const { buildConceptPrerequisiteIndex } = await import("../utils/conceptPrerequisites");
    const onSelectRelated = vi.fn();
    render(
      <ConceptDetail
        {...baseProps}
        concept={bayes}
        onSelectRelated={onSelectRelated}
        prerequisiteIndex={buildConceptPrerequisiteIndex(all)}
      />
    );
    expect(screen.getByRole("button", { name: "確率" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ベイズ推論" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "確率" }));
    expect(onSelectRelated).toHaveBeenCalledWith("prob");
  });
});
