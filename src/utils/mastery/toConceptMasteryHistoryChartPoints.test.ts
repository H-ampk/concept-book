import { describe, expect, it } from "vitest";
import { shortDateTime } from "../date";
import type { ConceptMasteryPoint } from "./types";
import {
  formatConceptMasteryAttemptLabel,
  formatConceptMasteryDelta,
  getConceptMasteryHistoryXTickInterval,
  toConceptMasteryHistoryChartPoints,
  toConceptMasteryHistorySummaryView,
  toConceptMasteryHistoryTooltipView
} from "./toConceptMasteryHistoryChartPoints";

const point = (overrides: Partial<ConceptMasteryPoint> = {}): ConceptMasteryPoint => ({
  conceptId: "c1",
  attemptIndex: 1,
  answeredAt: "2026-09-10T05:32:00.000Z",
  correct: true,
  masteryProbability: 0.79,
  masteryScore: 79,
  previousMasteryProbability: 0.68,
  previousMasteryScore: 68,
  masteryDelta: 11,
  quizAttemptLogId: "log-1",
  questionId: "q-1",
  questionPromptSnapshot: "○○とは何か？",
  timeMs: 4200,
  ...overrides
});

describe("toConceptMasteryHistoryChartPoints", () => {
  it("回答回数ラベルと 0〜100 の masteryScore、正誤の形状を渡す", () => {
    const points = toConceptMasteryHistoryChartPoints([
      point({ attemptIndex: 1, masteryScore: 0, correct: false, masteryDelta: -20, previousMasteryScore: 20 }),
      point({
        attemptIndex: 2,
        masteryScore: 100,
        correct: true,
        quizAttemptLogId: "log-2"
      })
    ]);
    expect(points).toHaveLength(2);
    expect(points[0]).toMatchObject({
      attemptIndex: 1,
      xLabel: "1回目",
      masteryScore: 0,
      correct: false,
      resultShape: "cross",
      resultLabel: "誤答"
    });
    expect(points[1]).toMatchObject({
      attemptIndex: 2,
      xLabel: "2回目",
      masteryScore: 100,
      correct: true,
      resultShape: "circle",
      resultLabel: "正解"
    });
  });
});

describe("toConceptMasteryHistoryTooltipView", () => {
  it("回答回数・日時・正誤・前回と今回の理解度・変化量を返す", () => {
    const view = toConceptMasteryHistoryTooltipView(
      toConceptMasteryHistoryChartPoints([
        point({ attemptIndex: 3, timeMs: 4200, questionPromptSnapshot: "○○とは何か？" })
      ])[0]
    );
    expect(view.attemptLabel).toBe("3回目");
    expect(view.answeredAtText).toBe(shortDateTime("2026-09-10T05:32:00.000Z"));
    expect(view.resultLabel).toBe("正解");
    expect(view.previousMasteryScore).toBe(68);
    expect(view.masteryScore).toBe(79);
    expect(view.masteryDeltaText).toBe("+11");
    expect(view.timeText).toBe("4.20秒");
    expect(view.questionPrompt).toBe("○○とは何か？");
  });

  it("計測できない回答時間と空の問題文は省略する", () => {
    const view = toConceptMasteryHistoryTooltipView(
      toConceptMasteryHistoryChartPoints([
        point({ timeMs: 0, questionPromptSnapshot: "  ", masteryDelta: -5, correct: false })
      ])[0]
    );
    expect(view.timeText).toBeNull();
    expect(view.questionPrompt).toBeNull();
    expect(view.resultLabel).toBe("誤答");
    expect(view.masteryDeltaText).toBe("-5");
  });
});

describe("toConceptMasteryHistorySummaryView", () => {
  it("回答数と最新理解度のテキストを返す", () => {
    expect(toConceptMasteryHistorySummaryView([point(), point({ attemptIndex: 2, masteryScore: 79 })])).toEqual({
      attemptCountText: "全2回答",
      latestMasteryText: "最新理解度79"
    });
  });

  it("0件では最新理解度を出さない", () => {
    expect(toConceptMasteryHistorySummaryView([])).toEqual({
      attemptCountText: "全0回答",
      latestMasteryText: null
    });
  });
});

describe("formatConceptMasteryAttemptLabel / delta / tick interval", () => {
  it("1回目ラベルと符号付き変化量を返す", () => {
    expect(formatConceptMasteryAttemptLabel(1)).toBe("1回目");
    expect(formatConceptMasteryDelta(11)).toBe("+11");
    expect(formatConceptMasteryDelta(0)).toBe("0");
    expect(formatConceptMasteryDelta(-4)).toBe("-4");
  });

  it("点が多いときは X 軸 tick を間引く", () => {
    expect(getConceptMasteryHistoryXTickInterval(3)).toBe(0);
    expect(getConceptMasteryHistoryXTickInterval(8)).toBe(0);
    expect(getConceptMasteryHistoryXTickInterval(16)).toBeGreaterThan(0);
  });
});
