import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { createEmptyConceptInput, type Concept } from "../../types/concept";
import {
  groupLearningModelPredictionMetricsByModel,
  summarizeLearningModelPredictionMetrics
} from "../../utils/learningModelEvaluation/metrics";
import {
  BKT_LEARNING_MODEL_ID,
  PFA_LEARNING_MODEL_ID
} from "../../utils/learningModelEvaluation/predictors";
import type { LearningModelPredictionPoint } from "../../utils/learningModelEvaluation/types";
import { DataLabLearningModelEvaluationPanel } from "./DataLabLearningModelEvaluationPanel";

const concept = (overrides: Partial<Concept> = {}): Concept => ({
  ...createEmptyConceptInput(),
  id: "concept-a",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  title: "人工知能",
  ...overrides
});

const point = (
  overrides: Partial<LearningModelPredictionPoint> = {}
): LearningModelPredictionPoint => ({
  conceptId: "concept-a",
  attemptId: "attempt-1",
  answeredAt: "2026-01-03T00:00:00.000Z",
  predictedCorrectProbability: 0.6,
  actualCorrect: true,
  model: BKT_LEARNING_MODEL_ID,
  historyCount: 2,
  ...overrides
});

describe("DataLabLearningModelEvaluationPanel", () => {
  it("BKT / PFA の Brier score と Log loss を表示し、HLR は出さない", () => {
    const points = [
      point({ model: BKT_LEARNING_MODEL_ID, predictedCorrectProbability: 0.8, actualCorrect: true }),
      point({
        model: PFA_LEARNING_MODEL_ID,
        attemptId: "attempt-1",
        predictedCorrectProbability: 0.2,
        actualCorrect: false
      })
    ];
    render(
      <DataLabLearningModelEvaluationPanel
        points={points}
        conceptById={new Map([["concept-a", concept()]])}
      />
    );
    const summary = screen.getByTestId("data-lab-learning-model-summary");
    expect(summary).toHaveTextContent("BKT");
    expect(summary).toHaveTextContent("PFA");
    expect(summary).not.toHaveTextContent("HLR");
    const byModel = groupLearningModelPredictionMetricsByModel(points);
    const bkt = byModel.get(BKT_LEARNING_MODEL_ID);
    expect(summary.textContent).toContain(String(bkt?.brierScore?.toFixed(4)));
    expect(screen.getByTestId("data-lab-learning-model-evaluation-note")).toHaveTextContent(
      "Brier score / Log loss は小さいほど予測誤差が小さい"
    );
    expect(screen.getByTestId("data-lab-learning-model-evaluation-note")).toHaveTextContent(
      "HLR の記憶保持率は次回正答確率ではない"
    );
    expect(screen.queryByRole("option", { name: "HLR" })).not.toBeInTheDocument();
  });

  it("prediction 0 件では count=0、Brier / Log loss は — にする", () => {
    render(<DataLabLearningModelEvaluationPanel points={[]} conceptById={new Map()} />);
    const summary = screen.getByTestId("data-lab-learning-model-summary");
    const rows = within(summary).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row).toHaveTextContent("0");
      expect(row).toHaveTextContent("—");
    }
    expect(screen.getByTestId("data-lab-learning-model-predicted-vs-actual-empty")).toBeInTheDocument();
    expect(screen.getByTestId("data-lab-learning-model-concept-empty")).toBeInTheDocument();
  });

  it("Concept ごとの Brier / Log loss を表示する", () => {
    const points = [
      point({ attemptId: "1", predictedCorrectProbability: 0.9, actualCorrect: true }),
      point({
        attemptId: "2",
        conceptId: "concept-b",
        predictedCorrectProbability: 0.1,
        actualCorrect: false
      })
    ];
    render(
      <DataLabLearningModelEvaluationPanel
        points={points}
        conceptById={
          new Map([
            ["concept-a", concept()],
            ["concept-b", concept({ id: "concept-b", title: "現象学" })]
          ])
        }
      />
    );
    const table = screen.getByTestId("data-lab-learning-model-concept-metrics");
    expect(table).toHaveTextContent("人工知能");
    expect(table).toHaveTextContent("現象学");
    const a = summarizeLearningModelPredictionMetrics(points, {
      model: BKT_LEARNING_MODEL_ID,
      conceptId: "concept-a"
    });
    expect(table.textContent).toContain(a.brierScore?.toFixed(4));
  });

  it("選択モデルを切り替えると Concept 表が対象モデルになる", async () => {
    const user = userEvent.setup();
    const points = [
      point({ model: BKT_LEARNING_MODEL_ID, predictedCorrectProbability: 0.9, actualCorrect: true }),
      point({
        model: PFA_LEARNING_MODEL_ID,
        predictedCorrectProbability: 0.1,
        actualCorrect: false
      })
    ];
    render(
      <DataLabLearningModelEvaluationPanel
        points={points}
        conceptById={new Map([["concept-a", concept()]])}
      />
    );
    await user.selectOptions(screen.getByLabelText("表示モデル"), PFA_LEARNING_MODEL_ID);
    const pfa = summarizeLearningModelPredictionMetrics(points, { model: PFA_LEARNING_MODEL_ID });
    expect(screen.getByTestId("data-lab-learning-model-concept-metrics").textContent).toContain(
      pfa.brierScore?.toFixed(4)
    );
  });
});
