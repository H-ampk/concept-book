import { describe, expect, it } from "vitest";
import type { DataLabAggregateRow } from "./aggregateDataLabLogs";
import { DEFAULT_DATA_LAB_FILTERS, type DataLabFilters } from "./filterDataLabLogs";
import { buildDataLabAnalysisSnapshot } from "./buildDataLabAnalysisSnapshot";
import { MAX_RESEARCH_ANALYSIS_ROWS } from "../../types/researchReport";

const row = (overrides: Partial<DataLabAggregateRow> = {}): DataLabAggregateRow => ({
  groupBy: "concept",
  key: "concept-a",
  label: "人工知能",
  attemptCount: 2,
  correctCount: 1,
  incorrectCount: 1,
  accuracy: 0.5,
  masteryProbability: 0.42,
  averageResponseTimeMs: 1200,
  firstAttemptAt: "2026-08-01T00:00:00.000Z",
  lastAttemptAt: "2026-08-02T00:00:00.000Z",
  conceptId: "concept-a",
  ...overrides
});

const filters: DataLabFilters = {
  ...DEFAULT_DATA_LAB_FILTERS,
  dateFrom: "2026-08-01",
  dateTo: "2026-08-31",
  conceptIds: ["concept-a"],
  domainTags: ["心理学"],
  deckIds: ["deck-1"],
  correctness: "incorrect"
};

describe("buildDataLabAnalysisSnapshot", () => {
  it("Data Lab の現在値から Snapshot を作る", () => {
    const snapshot = buildDataLabAnalysisSnapshot(
      {
        filters,
        filterChips: [
          { id: "period", label: "期間: 2026/08/01〜2026/08/31" },
          { id: "concept", label: "Concept: 人工知能" },
          { id: "domain", label: "分野: 心理学" },
          { id: "deck", label: "Deck: 心理学検定" },
          { id: "correctness", label: "誤答のみ" }
        ],
        groupBy: "concept",
        metric: "accuracy",
        scatterXMetric: "averageResponseTimeMs",
        scatterYMetric: "mastery",
        displayMode: "table",
        barSort: "valueDesc",
        barLimit: 10,
        filteredLogCount: 248,
        aggregatedRows: [row()]
      },
      { now: "2026-09-09T12:00:00.000Z" }
    );

    expect(snapshot.schemaVersion).toBe(1);
    expect(snapshot.source).toBe("data-lab");
    expect(snapshot.createdAt).toBe("2026-09-09T12:00:00.000Z");
    expect(snapshot.filters).toEqual(filters);
    expect(snapshot.filterLabels).toEqual([
      "期間: 2026/08/01〜2026/08/31",
      "Concept: 人工知能",
      "分野: 心理学",
      "Deck: 心理学検定",
      "誤答のみ"
    ]);
    expect(snapshot.filterChips.map((chip) => chip.label)).toEqual(snapshot.filterLabels);
    expect(snapshot.groupBy).toBe("concept");
    expect(snapshot.metric).toBe("accuracy");
    expect(snapshot.displayMode).toBe("table");
    expect(snapshot.sourceLogCount).toBe(248);
    expect(snapshot.rows).toEqual([row()]);
    expect(snapshot.scatterXMetric).toBeUndefined();
    expect(snapshot.scatterYMetric).toBeUndefined();
  });

  it("散布図では X/Y 指標を保存する", () => {
    const snapshot = buildDataLabAnalysisSnapshot({
      filters: DEFAULT_DATA_LAB_FILTERS,
      filterChips: [],
      groupBy: "concept",
      metric: "accuracy",
      scatterXMetric: "averageResponseTimeMs",
      scatterYMetric: "mastery",
      displayMode: "scatter",
      filteredLogCount: 3,
      aggregatedRows: [row()]
    });

    expect(snapshot.scatterXMetric).toBe("averageResponseTimeMs");
    expect(snapshot.scatterYMetric).toBe("mastery");
  });

  it("棒グラフでは barSort / barLimit を保存する", () => {
    const snapshot = buildDataLabAnalysisSnapshot({
      filters: DEFAULT_DATA_LAB_FILTERS,
      filterChips: [],
      groupBy: "concept",
      metric: "accuracy",
      displayMode: "bar",
      barSort: "name",
      barLimit: 20,
      filteredLogCount: 3,
      aggregatedRows: [row()]
    });

    expect(snapshot.barSort).toBe("name");
    expect(snapshot.barLimit).toBe(20);
  });

  it("masteryProbability を再計算せずそのまま保存する", () => {
    const snapshot = buildDataLabAnalysisSnapshot({
      filters: DEFAULT_DATA_LAB_FILTERS,
      filterChips: [],
      groupBy: "concept",
      metric: "mastery",
      displayMode: "table",
      filteredLogCount: 1,
      aggregatedRows: [row({ masteryProbability: 0.81 })]
    });

    expect(snapshot.rows[0]?.masteryProbability).toBe(0.81);
  });

  it("元の filters / aggregatedRows を書き換えても Snapshot は変わらない", () => {
    const mutableFilters: DataLabFilters = {
      ...DEFAULT_DATA_LAB_FILTERS,
      conceptIds: ["concept-a"],
      domainTags: ["心理学"]
    };
    const mutableRows = [row({ label: "保存時の名前", masteryProbability: 0.2 })];
    const chips = [{ id: "concept", label: "Concept: 保存時の名前" }];

    const snapshot = buildDataLabAnalysisSnapshot({
      filters: mutableFilters,
      filterChips: chips,
      groupBy: "concept",
      metric: "accuracy",
      displayMode: "table",
      filteredLogCount: 1,
      aggregatedRows: mutableRows
    });

    mutableFilters.conceptIds.push("concept-b");
    mutableFilters.domainTags[0] = "改名後";
    mutableRows[0]!.label = "改名後";
    mutableRows[0]!.masteryProbability = 0.99;
    chips[0]!.label = "Concept: 改名後";

    expect(snapshot.filters.conceptIds).toEqual(["concept-a"]);
    expect(snapshot.filters.domainTags).toEqual(["心理学"]);
    expect(snapshot.rows[0]?.label).toBe("保存時の名前");
    expect(snapshot.rows[0]?.masteryProbability).toBe(0.2);
    expect(snapshot.filterLabels).toEqual(["Concept: 保存時の名前"]);
  });

  it("上限を超えた行は truncated メタデータ付きで切り詰める", () => {
    const aggregatedRows = Array.from({ length: MAX_RESEARCH_ANALYSIS_ROWS + 12 }, (_, index) =>
      row({ key: `c-${index}`, label: `概念${index}`, conceptId: `c-${index}` })
    );

    const snapshot = buildDataLabAnalysisSnapshot({
      filters: DEFAULT_DATA_LAB_FILTERS,
      filterChips: [],
      groupBy: "concept",
      metric: "accuracy",
      displayMode: "table",
      filteredLogCount: 5000,
      aggregatedRows
    });

    expect(snapshot.totalRowCount).toBe(MAX_RESEARCH_ANALYSIS_ROWS + 12);
    expect(snapshot.savedRowCount).toBe(MAX_RESEARCH_ANALYSIS_ROWS);
    expect(snapshot.rows).toHaveLength(MAX_RESEARCH_ANALYSIS_ROWS);
    expect(snapshot.truncated).toBe(true);
  });
});
