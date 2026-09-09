import { describe, expect, it } from "vitest";
import { createEmptyConceptInput, type Concept } from "../../types/concept";
import {
  aggregateDataLabConcepts,
  countValidContextDefinitions,
  DATA_LAB_CONCEPT_DOMAIN_NONE_KEY,
  isMissingConceptSource
} from "./aggregateDataLabConcepts";

const concept = (overrides: Partial<Concept> = {}): Concept => ({
  ...createEmptyConceptInput(),
  id: "concept-a",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  title: "人工知能",
  definition: "定義",
  domainTags: ["情報科学"],
  status: "active",
  ...overrides
});

describe("countValidContextDefinitions / isMissingConceptSource", () => {
  it("空の context / definition を有効データとして数えない", () => {
    expect(
      countValidContextDefinitions(
        concept({
          contextDefinitions: [
            { id: "1", context: "哲学", definition: "定義A" },
            { id: "2", context: "", definition: "定義B" },
            { id: "3", context: "心理", definition: "  " },
            { id: "4", context: "  ", definition: "  " }
          ]
        })
      )
    ).toBe(1);
  });

  it("出典は book / page / author がすべて空のときだけ未登録", () => {
    expect(isMissingConceptSource(concept({ source: { book: "", page: "", author: null } }))).toBe(
      true
    );
    expect(isMissingConceptSource(concept({ source: { book: "本", page: "", author: null } }))).toBe(
      false
    );
    expect(
      isMissingConceptSource(concept({ source: { book: "", page: "", author: "著者" } }))
    ).toBe(false);
  });
});

describe("aggregateDataLabConcepts", () => {
  it("0件でもエラーにならない", () => {
    const result = aggregateDataLabConcepts({ concepts: [], allConcepts: [] });
    expect(result.totalConceptCount).toBe(0);
    expect(result.relationSummary.average).toBeNull();
    expect(result.relationSummary.minimum).toBeNull();
    expect(result.relationSummary.maximum).toBeNull();
    expect(result.contextSummary.averageContextDefinitionCount).toBeNull();
    expect(result.conceptRows).toEqual([]);
  });

  it("1件でも正しく集計できる", () => {
    const only = concept({
      id: "solo",
      title: "単独",
      favorite: true,
      status: "draft",
      definition: "",
      domainTags: [],
      relatedIds: [],
      contextDefinitions: []
    });
    const result = aggregateDataLabConcepts({ concepts: [only], allConcepts: [only] });
    expect(result.totalConceptCount).toBe(1);
    expect(result.favoriteCount).toBe(1);
    expect(result.statusRows.find((row) => row.status === "draft")?.conceptCount).toBe(1);
    expect(result.domainRows).toEqual([
      {
        key: DATA_LAB_CONCEPT_DOMAIN_NONE_KEY,
        domainTag: null,
        conceptCount: 1,
        contextDefinitionCount: 0
      }
    ]);
    expect(result.relationSummary).toEqual({
      average: 0,
      minimum: 0,
      maximum: 0,
      zeroRelationConceptCount: 1
    });
    expect(result.completeness.missingDefinitionCount).toBe(1);
    expect(result.completeness.missingRelationCount).toBe(1);
    expect(result.completeness.missingContextDefinitionCount).toBe(1);
  });

  it("favorite / status / 分野別 / 複数分野の重複計上", () => {
    const a = concept({
      id: "a",
      title: "人工知能",
      favorite: true,
      status: "active",
      domainTags: ["情報科学", "哲学"],
      contextDefinitions: [
        { id: "c1", context: "情報", definition: "定義1" },
        { id: "c2", context: "哲学", definition: "定義2" }
      ]
    });
    const b = concept({
      id: "b",
      title: "現象学",
      favorite: false,
      status: "draft",
      domainTags: ["哲学"],
      contextDefinitions: [{ id: "c3", context: "現象", definition: "定義3" }]
    });
    const c = concept({
      id: "c",
      title: "未分類",
      favorite: false,
      status: "active",
      domainTags: [],
      contextDefinitions: []
    });

    const result = aggregateDataLabConcepts({ concepts: [a, b, c], allConcepts: [a, b, c] });
    expect(result.favoriteCount).toBe(1);
    expect(result.statusRows.find((row) => row.status === "active")?.conceptCount).toBe(2);
    expect(result.statusRows.find((row) => row.status === "draft")?.conceptCount).toBe(1);

    const info = result.domainRows.find((row) => row.domainTag === "情報科学");
    const philo = result.domainRows.find((row) => row.domainTag === "哲学");
    const none = result.domainRows.find((row) => row.domainTag === null);
    expect(info).toEqual({
      key: "情報科学",
      domainTag: "情報科学",
      conceptCount: 1,
      contextDefinitionCount: 2
    });
    expect(philo).toEqual({
      key: "哲学",
      domainTag: "哲学",
      conceptCount: 2,
      contextDefinitionCount: 3
    });
    expect(none).toEqual({
      key: DATA_LAB_CONCEPT_DOMAIN_NONE_KEY,
      domainTag: null,
      conceptCount: 1,
      contextDefinitionCount: 0
    });
    const domainConceptSum = result.domainRows.reduce((sum, row) => sum + row.conceptCount, 0);
    expect(domainConceptSum).toBeGreaterThan(result.totalConceptCount);
  });

  it("関連数: 無向・重複・自己参照・削除済みID・フィルタ外との関係", () => {
    const a = concept({
      id: "a",
      title: "A",
      domainTags: ["情報科学"],
      relatedIds: ["b", "b", "a", "deleted", "", "c"]
    });
    const b = concept({
      id: "b",
      title: "B",
      domainTags: ["哲学"],
      relatedIds: ["a"]
    });
    const c = concept({
      id: "c",
      title: "C",
      domainTags: ["数学"],
      relatedIds: []
    });
    const all = [a, b, c];

    const full = aggregateDataLabConcepts({ concepts: all, allConcepts: all });
    expect(full.conceptRows.find((row) => row.conceptId === "a")?.relationCount).toBe(2);
    expect(full.conceptRows.find((row) => row.conceptId === "b")?.relationCount).toBe(1);
    expect(full.conceptRows.find((row) => row.conceptId === "c")?.relationCount).toBe(1);
    expect(full.relationSummary.zeroRelationConceptCount).toBe(0);
    expect(full.relationSummary.minimum).toBe(1);
    expect(full.relationSummary.maximum).toBe(2);
    expect(full.relationSummary.average).toBeCloseTo(4 / 3);

    // 分野フィルタ相当: A のみ対象でも、B/C との関係は残る
    const filtered = aggregateDataLabConcepts({ concepts: [a], allConcepts: all });
    expect(filtered.totalConceptCount).toBe(1);
    expect(filtered.conceptRows[0]?.relationCount).toBe(2);
    expect(filtered.relationSummary.average).toBe(2);
    expect(filtered.relationSummary.zeroRelationConceptCount).toBe(0);
  });

  it("A→B のみでも無向関係として1本扱う", () => {
    const a = concept({ id: "a", title: "A", relatedIds: ["b"] });
    const b = concept({ id: "b", title: "B", relatedIds: [] });
    const result = aggregateDataLabConcepts({ concepts: [a, b], allConcepts: [a, b] });
    expect(result.conceptRows.find((row) => row.conceptId === "a")?.relationCount).toBe(1);
    expect(result.conceptRows.find((row) => row.conceptId === "b")?.relationCount).toBe(1);
  });

  it("文脈集計と充足状況", () => {
    const a = concept({
      id: "a",
      title: "A",
      definition: "定義あり",
      source: { book: "本", page: "1", author: null },
      relatedIds: ["b"],
      contextDefinitions: [
        { id: "1", context: "文脈", definition: "定義" },
        { id: "2", context: "", definition: "無効" }
      ]
    });
    const b = concept({
      id: "b",
      title: "B",
      definition: "  ",
      source: { book: "", page: "", author: null },
      relatedIds: ["a"],
      contextDefinitions: []
    });
    const result = aggregateDataLabConcepts({ concepts: [a, b], allConcepts: [a, b] });
    expect(result.contextSummary.totalContextDefinitionCount).toBe(1);
    expect(result.contextSummary.conceptsWithContextDefinitions).toBe(1);
    expect(result.contextSummary.conceptsWithoutContextDefinitions).toBe(1);
    expect(result.contextSummary.averageContextDefinitionCount).toBe(0.5);
    expect(result.completeness).toEqual({
      missingDefinitionCount: 1,
      missingSourceCount: 1,
      missingRelationCount: 0,
      missingContextDefinitionCount: 1
    });
  });

  it("関連数が多い Concept の並びが安定している", () => {
    const a = concept({ id: "a", title: "ベータ", relatedIds: ["c"] });
    const b = concept({ id: "b", title: "アルファ", relatedIds: ["c"] });
    const c = concept({ id: "c", title: "ガンマ", relatedIds: ["a", "b"] });
    const result = aggregateDataLabConcepts({ concepts: [a, b, c], allConcepts: [a, b, c] });
    expect(result.conceptRows.map((row) => row.conceptId)).toEqual(["c", "b", "a"]);
  });

  it("入力 Concept を mutate しない", () => {
    const a = concept({
      id: "a",
      title: "A",
      domainTags: ["哲学", "情報科学"],
      relatedIds: ["b", "b"],
      contextDefinitions: [{ id: "1", context: "文脈", definition: "定義" }]
    });
    const b = concept({ id: "b", title: "B", relatedIds: ["a"] });
    const concepts = [a, b];
    const snapshot = structuredClone(concepts);
    aggregateDataLabConcepts({ concepts, allConcepts: concepts });
    expect(concepts).toEqual(snapshot);
  });
});
