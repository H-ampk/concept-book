import { describe, expect, it } from "vitest";
import { createEmptyConceptInput, type Concept } from "../../types/concept";
import {
  DEFAULT_DATA_LAB_CONCEPT_FILTERS,
  filterDataLabConcepts,
  isDataLabConceptFiltersDefault
} from "./filterDataLabConcepts";

const concept = (overrides: Partial<Concept> = {}): Concept => ({
  ...createEmptyConceptInput(),
  id: "concept-a",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  title: "人工知能",
  domainTags: ["情報科学"],
  status: "active",
  ...overrides
});

const ids = (rows: Concept[]): string[] => rows.map((row) => row.id);

describe("isDataLabConceptFiltersDefault", () => {
  it("デフォルト判定できる", () => {
    expect(isDataLabConceptFiltersDefault(DEFAULT_DATA_LAB_CONCEPT_FILTERS)).toBe(true);
    expect(
      isDataLabConceptFiltersDefault({
        ...DEFAULT_DATA_LAB_CONCEPT_FILTERS,
        favorite: "favorite"
      })
    ).toBe(false);
  });
});

describe("filterDataLabConcepts", () => {
  const concepts: Concept[] = [
    concept({
      id: "a",
      title: "人工知能",
      domainTags: ["情報科学", "哲学"],
      researchTags: ["論文"],
      status: "active",
      favorite: true
    }),
    concept({
      id: "b",
      title: "現象学",
      domainTags: ["哲学"],
      researchTags: ["読書"],
      status: "draft",
      favorite: false
    }),
    concept({
      id: "c",
      title: "線形代数",
      domainTags: ["数学"],
      researchTags: [],
      status: "researching",
      favorite: false
    }),
    concept({
      id: "d",
      title: "未分類",
      domainTags: [],
      researchTags: [],
      status: "archived",
      favorite: true
    })
  ];

  it("default 条件では全 Concept が残る", () => {
    expect(ids(filterDataLabConcepts(concepts, DEFAULT_DATA_LAB_CONCEPT_FILTERS))).toEqual([
      "a",
      "b",
      "c",
      "d"
    ]);
  });

  it("title 検索が動く", () => {
    expect(
      ids(filterDataLabConcepts(concepts, { ...DEFAULT_DATA_LAB_CONCEPT_FILTERS, query: "現象" }))
    ).toEqual(["b"]);
  });

  it("id 検索が動く", () => {
    expect(
      ids(filterDataLabConcepts(concepts, { ...DEFAULT_DATA_LAB_CONCEPT_FILTERS, query: "concept-c" }))
    ).toEqual([]);
    expect(
      ids(filterDataLabConcepts(concepts, { ...DEFAULT_DATA_LAB_CONCEPT_FILTERS, query: "c" }))
    ).toContain("c");
  });

  it("分野フィルタが動く", () => {
    expect(
      ids(
        filterDataLabConcepts(concepts, {
          ...DEFAULT_DATA_LAB_CONCEPT_FILTERS,
          domainTags: ["数学"]
        })
      )
    ).toEqual(["c"]);
  });

  it("複数分野指定が OR", () => {
    expect(
      ids(
        filterDataLabConcepts(concepts, {
          ...DEFAULT_DATA_LAB_CONCEPT_FILTERS,
          domainTags: ["情報科学", "数学"]
        })
      ).sort()
    ).toEqual(["a", "c"]);
  });

  it("status フィルタが動く", () => {
    expect(
      ids(
        filterDataLabConcepts(concepts, {
          ...DEFAULT_DATA_LAB_CONCEPT_FILTERS,
          statuses: ["draft"]
        })
      )
    ).toEqual(["b"]);
  });

  it("favorite フィルタが動く", () => {
    expect(
      ids(
        filterDataLabConcepts(concepts, {
          ...DEFAULT_DATA_LAB_CONCEPT_FILTERS,
          favorite: "favorite"
        })
      ).sort()
    ).toEqual(["a", "d"]);
    expect(
      ids(
        filterDataLabConcepts(concepts, {
          ...DEFAULT_DATA_LAB_CONCEPT_FILTERS,
          favorite: "notFavorite"
        })
      ).sort()
    ).toEqual(["b", "c"]);
  });

  it("異なる条件同士が AND", () => {
    expect(
      ids(
        filterDataLabConcepts(concepts, {
          ...DEFAULT_DATA_LAB_CONCEPT_FILTERS,
          domainTags: ["哲学"],
          favorite: "favorite"
        })
      )
    ).toEqual(["a"]);
  });

  it("研究タグフィルタが OR", () => {
    expect(
      ids(
        filterDataLabConcepts(concepts, {
          ...DEFAULT_DATA_LAB_CONCEPT_FILTERS,
          researchTags: ["論文", "読書"]
        })
      ).sort()
    ).toEqual(["a", "b"]);
  });

  it("0件を安全に処理", () => {
    expect(filterDataLabConcepts([], DEFAULT_DATA_LAB_CONCEPT_FILTERS)).toEqual([]);
    expect(
      filterDataLabConcepts(concepts, {
        ...DEFAULT_DATA_LAB_CONCEPT_FILTERS,
        query: "存在しないタイトルxyz"
      })
    ).toEqual([]);
  });

  it("入力 Concept を mutate しない", () => {
    const snapshot = structuredClone(concepts);
    filterDataLabConcepts(concepts, {
      ...DEFAULT_DATA_LAB_CONCEPT_FILTERS,
      domainTags: ["哲学"],
      statuses: ["active"],
      favorite: "favorite",
      query: "人工"
    });
    expect(concepts).toEqual(snapshot);
  });
});
