import { describe, expect, it } from "vitest";
import {
  conceptMatchesMasteryOverviewFilter,
  getConceptMasteryAccessibleLabel,
  getConceptMasteryOverviewLabel
} from "./masteryPresentation";
import type { ConceptMastery } from "./types";

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

describe("getConceptMasteryOverviewLabel", () => {
  it("unlearned は未学習と表示し、数値 0 にしない", () => {
    expect(getConceptMasteryOverviewLabel(mastery({ state: "unlearned", masteryScore: 20 }))).toBe(
      "未学習"
    );
  });

  it("insufficient-data はデータ不足と表示し、数値 0 にしない", () => {
    expect(
      getConceptMasteryOverviewLabel(
        mastery({
          state: "insufficient-data",
          masteryScore: 28,
          attemptCount: 1,
          confidence: "low",
          freshness: "fresh"
        })
      )
    ).toBe("データ不足");
  });

  it("learning は理解度と状態を出す", () => {
    expect(
      getConceptMasteryOverviewLabel(
        mastery({
          state: "learning",
          masteryScore: 42,
          attemptCount: 4,
          confidence: "medium",
          freshness: "fresh"
        })
      )
    ).toBe("理解度 42 · 学習中");
  });

  it("developing は理解度と状態を出す", () => {
    expect(
      getConceptMasteryOverviewLabel(
        mastery({
          state: "developing",
          masteryScore: 67,
          attemptCount: 6,
          confidence: "high",
          freshness: "fresh"
        })
      )
    ).toBe("理解度 67 · 理解が進んでいる");
  });

  it("mastered は理解度と状態を出す", () => {
    expect(
      getConceptMasteryOverviewLabel(
        mastery({
          state: "mastered",
          masteryScore: 86,
          attemptCount: 8,
          confidence: "high",
          freshness: "fresh"
        })
      )
    ).toBe("理解度 86 · おおむね理解");
  });

  it("stale の学習済みは要再確認を含む", () => {
    expect(
      getConceptMasteryOverviewLabel(
        mastery({
          state: "developing",
          masteryScore: 67,
          attemptCount: 6,
          confidence: "high",
          freshness: "stale"
        })
      )
    ).toBe("理解度 67 · 理解が進んでいる · 要再確認");
  });

  it("未学習とデータ不足は stale でも数値や要再確認を主表示しない", () => {
    expect(
      getConceptMasteryOverviewLabel(mastery({ state: "unlearned", freshness: "never" }))
    ).toBe("未学習");
    expect(
      getConceptMasteryOverviewLabel(
        mastery({
          state: "insufficient-data",
          masteryScore: 0,
          freshness: "stale",
          confidence: "low",
          attemptCount: 1
        })
      )
    ).toBe("データ不足");
  });
});

describe("getConceptMasteryAccessibleLabel", () => {
  it("信頼度と freshness を補助情報として含める", () => {
    const label = getConceptMasteryAccessibleLabel(
      mastery({
        state: "developing",
        masteryScore: 67,
        confidence: "medium",
        freshness: "fresh",
        attemptCount: 4
      })
    );
    expect(label).toContain("理解度 67 · 理解が進んでいる");
    expect(label).toContain("信頼度: 中");
    expect(label).toContain("最近確認");
  });
});

describe("conceptMatchesMasteryOverviewFilter", () => {
  it("all は常に一致する", () => {
    expect(conceptMatchesMasteryOverviewFilter(undefined, "all")).toBe(true);
    expect(conceptMatchesMasteryOverviewFilter(mastery({ state: "unlearned" }), "all")).toBe(true);
  });

  it("state フィルタと stale フィルタを区別する", () => {
    const staleLearning = mastery({ state: "learning", freshness: "stale", masteryScore: 40 });
    expect(conceptMatchesMasteryOverviewFilter(staleLearning, "learning")).toBe(true);
    expect(conceptMatchesMasteryOverviewFilter(staleLearning, "stale")).toBe(true);
    expect(conceptMatchesMasteryOverviewFilter(staleLearning, "unlearned")).toBe(false);
    expect(
      conceptMatchesMasteryOverviewFilter(mastery({ state: "learning", freshness: "fresh" }), "stale")
    ).toBe(false);
  });
});
