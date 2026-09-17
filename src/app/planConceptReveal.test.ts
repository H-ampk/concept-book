import { describe, expect, it } from "vitest";
import { createEmptyConceptInput, type Concept } from "../types/concept";
import type { ConceptMastery } from "../utils/mastery/types";
import { planConceptReveal, type ConceptRevealState } from "./planConceptReveal";
import type { ConceptListFilterState } from "./revealConceptInGraphFilters";

const concept = (overrides: Partial<Concept> = {}): Concept => ({
  ...createEmptyConceptInput(),
  id: "c1",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  title: "対象概念A",
  definition: "定義本文",
  domainTags: ["AI"],
  researchTags: ["検定"],
  favorite: false,
  ...overrides
});

const openFilters = (): ConceptListFilterState => ({
  query: "",
  selectedDomainTags: [],
  selectedResearchTags: [],
  selectedStatuses: [],
  onlyFavorite: false
});

const state = (
  overrides: Partial<ConceptRevealState> & { filters?: Partial<ConceptListFilterState> } = {}
): ConceptRevealState => ({
  filters: { ...openFilters(), ...overrides.filters },
  masteryFilter: overrides.masteryFilter ?? "all"
});

const mastery = (overrides: Partial<ConceptMastery> = {}): ConceptMastery => ({
  conceptId: "c1",
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

describe("planConceptReveal", () => {
  it("全条件に一致するなら changed=false で全 filter を維持する", () => {
    const current = state({
      filters: {
        query: "対象",
        selectedDomainTags: ["AI"],
        onlyFavorite: false
      },
      masteryFilter: "unlearned"
    });
    const result = planConceptReveal(concept(), current, mastery({ state: "unlearned" }));
    expect(result.changed).toBe(false);
    expect(result.filtersChanged).toBe(false);
    expect(result.masteryFilterChanged).toBe(false);
    expect(result.nextFilters).toEqual(current.filters);
    expect(result.nextMasteryFilter).toBe("unlearned");
  });

  it("search mismatch なら query だけ空にする", () => {
    const current = state({
      filters: { query: "B", selectedDomainTags: ["AI"] }
    });
    const result = planConceptReveal(concept(), current, undefined);
    expect(result.changed).toBe(true);
    expect(result.nextFilters.query).toBe("");
    expect(result.nextFilters.selectedDomainTags).toEqual(["AI"]);
    expect(result.nextFilters.onlyFavorite).toBe(false);
    expect(result.nextMasteryFilter).toBe("all");
  });

  it("favorite mismatch なら onlyFavorite だけ false にする", () => {
    const current = state({ filters: { onlyFavorite: true } });
    const result = planConceptReveal(concept({ favorite: false }), current, undefined);
    expect(result.nextFilters.onlyFavorite).toBe(false);
    expect(result.nextFilters.query).toBe("");
    expect(result.nextFilters.selectedDomainTags).toEqual([]);
  });

  it("domain filter は必要な分だけ解除する", () => {
    const current = state({
      filters: { selectedDomainTags: ["AI", "HCI"] }
    });
    const result = planConceptReveal(concept({ domainTags: ["AI"] }), current, undefined);
    expect(result.nextFilters.selectedDomainTags).toEqual(["AI"]);
    expect(result.nextFilters.query).toBe("");
  });

  it("mastery mismatch なら masteryFilter を all にする", () => {
    const current = state({ masteryFilter: "mastered" });
    const result = planConceptReveal(
      concept(),
      current,
      mastery({ state: "unlearned" })
    );
    expect(result.masteryFilterChanged).toBe(true);
    expect(result.nextMasteryFilter).toBe("all");
    expect(result.filtersChanged).toBe(false);
  });

  it("mastery match なら unlearned 等でも mastery filter を維持する", () => {
    const current = state({ masteryFilter: "unlearned" });
    const result = planConceptReveal(
      concept(),
      current,
      mastery({ state: "unlearned" })
    );
    expect(result.changed).toBe(false);
    expect(result.nextMasteryFilter).toBe("unlearned");
  });
});
