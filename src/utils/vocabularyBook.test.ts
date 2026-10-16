import { describe, expect, it } from "vitest";
import { createEmptyConceptInput, type Concept } from "../types/concept";
import { createEmptyContextCardInput, type ContextCard } from "../types/contextCard";
import {
  UNASSIGNED_DOMAIN_LABEL,
  buildVocabularyDomainSummaries,
  buildVocabularyEntries,
  contextCardDomainKeys
} from "./vocabularyBook";

const concept = (id: string, domainTags: string[]): Concept => ({
  ...createEmptyConceptInput(),
  id,
  title: id,
  definition: `${id}の定義`,
  domainTags,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
});

const card = (id: string, overrides: Partial<ContextCard> = {}): ContextCard => ({
  ...createEmptyContextCardInput(),
  id,
  title: id,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides
});

describe("buildVocabularyDomainSummaries", () => {
  it("Concept の複数タグを分野ごとに1件ずつ数える", () => {
    const summaries = buildVocabularyDomainSummaries(
      [concept("c1", ["英語", "心理学"])],
      []
    );
    expect(summaries).toEqual([
      { domain: "英語", conceptCount: 1, contextCardCount: 0 },
      { domain: "心理学", conceptCount: 1, contextCardCount: 0 }
    ]);
  });

  it("文脈カードの複数タグを分野ごとに1件ずつ数える", () => {
    const summaries = buildVocabularyDomainSummaries(
      [],
      [card("k1", { domainTags: ["情報科学", "哲学"] })]
    );
    expect(summaries).toEqual([
      { domain: "情報科学", conceptCount: 0, contextCardCount: 1 },
      { domain: "哲学", conceptCount: 0, contextCardCount: 1 }
    ]);
  });

  it("有効な domainTags が無い文脈カードは domain に分類する", () => {
    expect(contextCardDomainKeys(card("k1", { domainTags: ["  "], domain: "デンマーク語" }))).toEqual([
      "デンマーク語"
    ]);
    const summaries = buildVocabularyDomainSummaries(
      [],
      [card("k1", { domainTags: [], domain: "デンマーク語" })]
    );
    expect(summaries).toEqual([
      { domain: "デンマーク語", conceptCount: 0, contextCardCount: 1 }
    ]);
  });

  it("分野が無いデータは未設定に残す", () => {
    const summaries = buildVocabularyDomainSummaries(
      [concept("c1", [])],
      [card("k1", { domainTags: [], domain: "   " })]
    );
    expect(summaries).toEqual([
      { domain: UNASSIGNED_DOMAIN_LABEL, conceptCount: 1, contextCardCount: 1 }
    ]);
  });

  it("同一カード内の重複タグは1回だけ数える", () => {
    const summaries = buildVocabularyDomainSummaries(
      [concept("c1", ["英語", "英語", " 英語 "])],
      [card("k1", { domainTags: ["哲学", "哲学"] })]
    );
    expect(summaries).toEqual([
      { domain: "英語", conceptCount: 1, contextCardCount: 0 },
      { domain: "哲学", conceptCount: 0, contextCardCount: 1 }
    ]);
  });

  it("同じ ID が配列に二度あっても分野件数は1のまま", () => {
    const duplicated = concept("c1", ["英語"]);
    const summaries = buildVocabularyDomainSummaries([duplicated, duplicated], []);
    expect(summaries).toEqual([{ domain: "英語", conceptCount: 1, contextCardCount: 0 }]);
    expect(buildVocabularyEntries("英語", [duplicated, duplicated], [], "all")).toHaveLength(1);
  });
});
