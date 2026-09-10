import { describe, expect, it } from "vitest";
import { DEFAULT_DATA_LAB_FILTERS } from "../dataLab/filterDataLabLogs";
import { buildDataLabAnalysisSnapshot } from "../dataLab/buildDataLabAnalysisSnapshot";
import { formatResearchAnalysisSnapshotView } from "./formatResearchAnalysisSnapshot";

describe("formatResearchAnalysisSnapshotView", () => {
  it("現在の Concept / Deck lookup なしで保存時の名称を表示する", () => {
    const snapshot = buildDataLabAnalysisSnapshot(
      {
        filters: {
          ...DEFAULT_DATA_LAB_FILTERS,
          conceptIds: ["deleted-concept"],
          deckIds: ["deleted-deck"]
        },
        filterChips: [
          { id: "concept", label: "Concept: 保存時の概念名" },
          { id: "deck", label: "Deck: 保存時のデッキ名" }
        ],
        groupBy: "concept",
        metric: "accuracy",
        scatterXMetric: "averageResponseTimeMs",
        scatterYMetric: "mastery",
        displayMode: "scatter",
        filteredLogCount: 4,
        aggregatedRows: [
          {
            groupBy: "concept",
            key: "deleted-concept",
            label: "保存時の概念名",
            attemptCount: 4,
            correctCount: 2,
            incorrectCount: 2,
            accuracy: 0.5,
            masteryProbability: 0.3,
            averageResponseTimeMs: 900,
            firstAttemptAt: null,
            lastAttemptAt: null,
            conceptId: "deleted-concept"
          }
        ]
      },
      { now: "2026-09-09T12:00:00.000Z" }
    );

    const view = formatResearchAnalysisSnapshotView(snapshot);
    expect(view.filterLabels).toEqual(["Concept: 保存時の概念名", "Deck: 保存時のデッキ名"]);
    expect(view.rowLabels).toEqual(["保存時の概念名"]);
    expect(view.scatterXLabel).toBe("平均回答時間");
    expect(view.scatterYLabel).toBe("BKT 理解度");
    expect(view.groupByLabel).toBe("Concept");
    expect(view.metricLabel).toBe("正答率");
    expect(view.displayModeLabel).toBe("散布図");
    expect(view.sourceLogCount).toBe(4);
  });

  it("切り捨て時は保存行数を明示する", () => {
    const snapshot = buildDataLabAnalysisSnapshot(
      {
        filters: DEFAULT_DATA_LAB_FILTERS,
        filterChips: [],
        groupBy: "concept",
        metric: "accuracy",
        displayMode: "table",
        filteredLogCount: 1,
        aggregatedRows: Array.from({ length: 3 }, (_, index) => ({
          groupBy: "concept" as const,
          key: `c-${index}`,
          label: `概念${index}`,
          attemptCount: 1,
          correctCount: 1,
          incorrectCount: 0,
          accuracy: 1,
          masteryProbability: null,
          averageResponseTimeMs: null,
          firstAttemptAt: null,
          lastAttemptAt: null,
          conceptId: `c-${index}`
        }))
      },
      { maxRows: 2 }
    );

    const view = formatResearchAnalysisSnapshotView(snapshot);
    expect(view.truncationLabel).toBe("2 / 3 行を保存");
  });
});
