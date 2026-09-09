import { describe, expect, it } from "vitest";
import { createEmptyConceptInput, type Concept } from "../types/concept";
import { planFiltersToRevealConcept, type ConceptListFilterState } from "./revealConceptInGraphFilters";

const concept = (overrides: Partial<Concept> = {}): Concept => ({
  ...createEmptyConceptInput(),
  id: "c1",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  title: "対象概念",
  definition: "定義本文",
  domainTags: ["心理学"],
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

describe("planFiltersToRevealConcept", () => {
  it("visible ならフィルタを維持する", () => {
    const filters = {
      ...openFilters(),
      query: "対象",
      selectedDomainTags: ["心理学"]
    };
    const result = planFiltersToRevealConcept(concept(), filters);
    expect(result.filtersChanged).toBe(false);
    expect(result.nextFilters).toEqual(filters);
  });

  it("検索が除外しているときだけ検索を空にする", () => {
    const filters = { ...openFilters(), query: "存在しない語" };
    const result = planFiltersToRevealConcept(concept(), filters);
    expect(result.filtersChanged).toBe(true);
    expect(result.nextFilters.query).toBe("");
    expect(result.nextFilters.selectedDomainTags).toEqual([]);
  });

  it("分野タグの AND が除外しているとき、Concept が持たないタグだけ外す", () => {
    const filters = {
      ...openFilters(),
      selectedDomainTags: ["心理学", "哲学"]
    };
    const result = planFiltersToRevealConcept(concept(), filters);
    expect(result.filtersChanged).toBe(true);
    expect(result.nextFilters.selectedDomainTags).toEqual(["心理学"]);
    expect(result.nextFilters.query).toBe("");
  });

  it("研究テーマタグの AND が除外しているとき、Concept が持たないタグだけ外す", () => {
    const filters = {
      ...openFilters(),
      selectedResearchTags: ["検定", "別テーマ"]
    };
    const result = planFiltersToRevealConcept(concept(), filters);
    expect(result.nextFilters.selectedResearchTags).toEqual(["検定"]);
  });

  it("Status フィルタが除外しているとき Status フィルタを解除する", () => {
    const filters = {
      ...openFilters(),
      selectedStatuses: ["archived" as const]
    };
    const result = planFiltersToRevealConcept(concept({ definition: "定義あり" }), filters);
    expect(result.nextFilters.selectedStatuses).toEqual([]);
  });

  it("お気に入りのみが除外しているときだけお気に入りフィルタを外す", () => {
    const filters = { ...openFilters(), onlyFavorite: true };
    const result = planFiltersToRevealConcept(concept({ favorite: false }), filters);
    expect(result.nextFilters.onlyFavorite).toBe(false);
  });

  it("お気に入りのみでも対象がお気に入りなら維持する", () => {
    const filters = { ...openFilters(), onlyFavorite: true };
    const result = planFiltersToRevealConcept(concept({ favorite: true }), filters);
    expect(result.filtersChanged).toBe(false);
    expect(result.nextFilters.onlyFavorite).toBe(true);
  });
});
