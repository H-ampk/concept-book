import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ConceptMasteryPoint } from "../../utils/mastery/types";
import { ConceptMasteryHistoryChart } from "./ConceptMasteryHistoryChart";

const point = (overrides: Partial<ConceptMasteryPoint> = {}): ConceptMasteryPoint => ({
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

describe("ConceptMasteryHistoryChart", () => {
  it("0件では empty state を出し、グラフ領域は描画しない", () => {
    render(<ConceptMasteryHistoryChart history={[]} />);
    expect(screen.getByText("理解度の推移")).toBeInTheDocument();
    expect(screen.getByText("理解度の推移を表示する回答履歴がありません。")).toBeInTheDocument();
    expect(screen.queryByTestId("concept-mastery-history-chart")).not.toBeInTheDocument();
  });

  it("1〜2件かつ confidence が low のとき低信頼度の注意を出す", () => {
    render(
      <ConceptMasteryHistoryChart
        history={[point({ masteryScore: 0 }), point({ attemptIndex: 2, masteryScore: 100, correct: false })]}
        confidence="low"
      />
    );
    expect(screen.getByTestId("concept-mastery-history-chart")).toBeInTheDocument();
    expect(screen.getByText("回答数が少ないため、この推定値の信頼度は低い状態です。")).toBeInTheDocument();
    expect(screen.getByText(/全2回答/)).toBeInTheDocument();
    expect(screen.getByText(/最新理解度100/)).toBeInTheDocument();
  });

  it("履歴があるときグラフ領域と正誤凡例を表示する", () => {
    render(
      <ConceptMasteryHistoryChart
        history={[
          point({ correct: true, masteryScore: 40 }),
          point({ attemptIndex: 2, correct: false, masteryScore: 36, quizAttemptLogId: "log-2" }),
          point({ attemptIndex: 3, correct: true, masteryScore: 79, quizAttemptLogId: "log-3" })
        ]}
        confidence="medium"
      />
    );
    expect(screen.getByTestId("concept-mastery-history-chart")).toBeInTheDocument();
    expect(screen.getByText("○ 正解")).toBeInTheDocument();
    expect(screen.getByText("× 誤答")).toBeInTheDocument();
    expect(screen.queryByText("回答数が少ないため、この推定値の信頼度は低い状態です。")).not.toBeInTheDocument();
    expect(screen.getByText(/全3回答/)).toBeInTheDocument();
    expect(screen.getByText(/最新理解度79/)).toBeInTheDocument();
  });

  it("Concept を変えると別履歴の要約になる", () => {
    const { rerender } = render(
      <ConceptMasteryHistoryChart history={[point({ conceptId: "a", masteryScore: 40 })]} confidence="low" />
    );
    expect(screen.getByText(/全1回答/)).toBeInTheDocument();
    expect(screen.getByText(/最新理解度40/)).toBeInTheDocument();

    rerender(
      <ConceptMasteryHistoryChart
        history={[
          point({ conceptId: "b", masteryScore: 55, quizAttemptLogId: "b1" }),
          point({ conceptId: "b", attemptIndex: 2, masteryScore: 62, quizAttemptLogId: "b2" }),
          point({ conceptId: "b", attemptIndex: 3, masteryScore: 70, quizAttemptLogId: "b3" })
        ]}
        confidence="medium"
      />
    );
    expect(screen.getByText(/全3回答/)).toBeInTheDocument();
    expect(screen.getByText(/最新理解度70/)).toBeInTheDocument();
    expect(screen.queryByText(/最新理解度40/)).not.toBeInTheDocument();
  });
});
