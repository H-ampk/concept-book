import { describe, expect, it } from "vitest";
import { createEmptyConceptInput, type Concept } from "../../types/concept";
import { filterConcepts } from "./conceptFilters";
import {
  collectConceptSearchMatches,
  conceptMatchesQuery,
  getPrimaryConceptSearchMatch,
  getSearchSnippetText,
  shouldShowSearchSnippet
} from "./conceptSearch";

const concept = (overrides: Partial<Concept> = {}): Concept => ({
  ...createEmptyConceptInput(),
  id: "c1",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  title: "権威主義的パーソナリティ",
  definition: "通常の定義本文です。",
  myInterpretation: "自分の解釈です。",
  domainTags: ["心理学"],
  researchTags: ["検定"],
  notes: "メモ本文です。",
  ...overrides
});

const filterByQuery = (items: Concept[], query: string) =>
  filterConcepts(items, query, [], [], [], false);

describe("concept search", () => {
  it("文脈別定義だけに存在する語で検索できる", () => {
    const item = concept({
      contextDefinitions: [
        {
          id: "ctx-1",
          context: "社会心理学",
          definition: "人は強い権威への服従を示すことがある。"
        }
      ]
    });
    expect(filterByQuery([item], "服従")).toEqual([item]);
    const match = getPrimaryConceptSearchMatch(item, "服従");
    expect(match?.type).toBe("contextDefinition");
    expect(match?.label).toBe("文脈別定義：社会心理学");
    expect(match?.contextLabel).toBe("社会心理学");
    expect(getSearchSnippetText(match!, "服従")).toBe("人は強い権威への服従を示すことがある。");
  });

  it("複数の文脈別定義の2件目でも検索できる", () => {
    const item = concept({
      contextDefinitions: [
        { id: "ctx-1", context: "臨床", definition: "別の説明です。" },
        { id: "ctx-2", context: "社会心理学", definition: "服従実験に関する説明です。" }
      ]
    });
    expect(conceptMatchesQuery(item, "服従実験")).toBe(true);
    const match = getPrimaryConceptSearchMatch(item, "服従実験");
    expect(match?.type).toBe("contextDefinition");
    expect(match?.contextLabel).toBe("社会心理学");
  });

  it("contextDefinitions が undefined でも壊れない", () => {
    const item = concept({ contextDefinitions: undefined });
    expect(() => filterByQuery([item], "定義本文")).not.toThrow();
    expect(filterByQuery([item], "定義本文")).toEqual([item]);
    expect(filterByQuery([item], "存在しない語")).toEqual([]);
  });

  it("contextDefinitions が空配列でも壊れない", () => {
    const item = concept({ contextDefinitions: [] });
    expect(() => collectConceptSearchMatches(item, "定義")).not.toThrow();
    expect(filterByQuery([item], "定義本文")).toEqual([item]);
  });

  it("既存検索対象を維持する", () => {
    const item = concept({
      title: "タイトル語",
      definition: "定義語",
      myInterpretation: "解釈語",
      domainTags: ["分野タグ語"],
      researchTags: ["研究タグ語"],
      notes: "メモ語"
    });
    expect(filterByQuery([item], "タイトル語")).toHaveLength(1);
    expect(filterByQuery([item], "定義語")).toHaveLength(1);
    expect(filterByQuery([item], "解釈語")).toHaveLength(1);
    expect(filterByQuery([item], "分野タグ語")).toHaveLength(1);
    expect(filterByQuery([item], "研究タグ語")).toHaveLength(1);
    expect(filterByQuery([item], "メモ語")).toHaveLength(1);
  });

  it("文脈名そのものでは検索しない", () => {
    const item = concept({
      contextDefinitions: [{ id: "ctx-1", context: "社会心理学", definition: "別内容です。" }]
    });
    expect(filterByQuery([item], "社会心理学")).toEqual([]);
  });

  it("検索語を含む一文だけを取得する", () => {
    const item = concept({
      definition: "最初の文です。ここには検索語があります。最後の文です。"
    });
    const match = getPrimaryConceptSearchMatch(item, "検索語");
    expect(match?.type).toBe("definition");
    expect(getSearchSnippetText(match!, "検索語")).toBe("ここには検索語があります。");
  });

  it("空検索では一致スニペットを表示しない", () => {
    const item = concept();
    const match = getPrimaryConceptSearchMatch(item, "   ");
    expect(match).toBeUndefined();
    expect(shouldShowSearchSnippet(match)).toBe(false);
    expect(filterByQuery([item], "")).toEqual([item]);
  });

  it("正規化検索を壊さない", () => {
    const item = concept({ definition: "ＡＢＣ定義" });
    expect(filterByQuery([item], "abc")).toEqual([item]);
    expect(filterByQuery([item], "ABC")).toEqual([item]);
  });

  it("複数箇所一致時は優先順位どおり代表一致を選ぶ", () => {
    const item = concept({
      title: "権威",
      definition: "権威についての定義。",
      notes: "権威のメモ。"
    });
    expect(getPrimaryConceptSearchMatch(item, "権威")?.type).toBe("title");
  });
});
