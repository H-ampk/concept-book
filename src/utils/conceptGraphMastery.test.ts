import { describe, expect, it } from "vitest";
import {
  getConceptGraphMasteryFill,
  getConceptGraphMasteryLabel,
  GRAPH_MASTERY_FILL_DEVELOPING,
  GRAPH_MASTERY_FILL_INSUFFICIENT,
  GRAPH_MASTERY_FILL_LEARNING,
  GRAPH_MASTERY_FILL_MASTERED,
  GRAPH_MASTERY_FILL_UNLEARNED,
  GRAPH_MASTERY_LEGEND_ITEMS
} from "./conceptGraphMastery";
import type { ConceptMastery } from "./mastery/types";

const mastery = (overrides: Partial<ConceptMastery>): ConceptMastery => ({
  conceptId: "c",
  masteryProbability: 0.2,
  masteryScore: 20,
  state: "unlearned",
  attemptCount: 0,
  correctCount: 0,
  incorrectCount: 0,
  accuracy: null,
  confidence: "none",
  lastAnsweredAt: null,
  freshness: "never",
  recentResults: [],
  avgReactionTimeMs: null,
  ...overrides
});

describe("getConceptGraphMasteryFill", () => {
  it("未学習・データ不足・学習中・理解が進んでいる・おおむね理解で塗り色が異なる", () => {
    const fills = [
      getConceptGraphMasteryFill(mastery({ state: "unlearned" })),
      getConceptGraphMasteryFill(mastery({ state: "insufficient-data", masteryScore: 28 })),
      getConceptGraphMasteryFill(mastery({ state: "learning", masteryScore: 42 })),
      getConceptGraphMasteryFill(mastery({ state: "developing", masteryScore: 67 })),
      getConceptGraphMasteryFill(mastery({ state: "mastered", masteryScore: 86 }))
    ];
    expect(fills).toEqual([
      GRAPH_MASTERY_FILL_UNLEARNED,
      GRAPH_MASTERY_FILL_INSUFFICIENT,
      GRAPH_MASTERY_FILL_LEARNING,
      GRAPH_MASTERY_FILL_DEVELOPING,
      GRAPH_MASTERY_FILL_MASTERED
    ]);
    expect(new Set(fills).size).toBe(5);
  });

  it("mastery 欠損は未学習と同じ塗り色になる", () => {
    expect(getConceptGraphMasteryFill(undefined)).toBe(GRAPH_MASTERY_FILL_UNLEARNED);
  });

  it("freshness で塗り色を変えない", () => {
    const base = mastery({ state: "developing", masteryScore: 67, freshness: "fresh" });
    const stale = mastery({ state: "developing", masteryScore: 67, freshness: "stale" });
    expect(getConceptGraphMasteryFill(base)).toBe(getConceptGraphMasteryFill(stale));
  });
});

describe("getConceptGraphMasteryLabel", () => {
  it("未学習とデータ不足は数値を出さず、学習済みは理解度と状態を出す", () => {
    expect(getConceptGraphMasteryLabel(mastery({ state: "unlearned", masteryScore: 20 }))).toBe(
      "未学習"
    );
    expect(
      getConceptGraphMasteryLabel(mastery({ state: "insufficient-data", masteryScore: 28 }))
    ).toBe("データ不足");
    expect(getConceptGraphMasteryLabel(mastery({ state: "learning", masteryScore: 42 }))).toBe(
      "理解度 42 · 学習中"
    );
    expect(getConceptGraphMasteryLabel(mastery({ state: "developing", masteryScore: 67 }))).toBe(
      "理解度 67 · 理解が進んでいる"
    );
    expect(getConceptGraphMasteryLabel(mastery({ state: "mastered", masteryScore: 86 }))).toBe(
      "理解度 86 · おおむね理解"
    );
  });
});

describe("GRAPH_MASTERY_LEGEND_ITEMS", () => {
  it("凡例の色とラベルが state と対応する", () => {
    expect(GRAPH_MASTERY_LEGEND_ITEMS.map((item) => item.label)).toEqual([
      "未学習",
      "データ不足",
      "学習中",
      "理解が進んでいる",
      "おおむね理解"
    ]);
    expect(GRAPH_MASTERY_LEGEND_ITEMS.map((item) => item.fill)).toEqual([
      GRAPH_MASTERY_FILL_UNLEARNED,
      GRAPH_MASTERY_FILL_INSUFFICIENT,
      GRAPH_MASTERY_FILL_LEARNING,
      GRAPH_MASTERY_FILL_DEVELOPING,
      GRAPH_MASTERY_FILL_MASTERED
    ]);
  });
});
