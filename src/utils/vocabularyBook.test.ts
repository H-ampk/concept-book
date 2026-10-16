import { describe, expect, it } from "vitest";
import { createEmptyConceptInput, type Concept } from "../types/concept";
import { createEmptyContextCardInput, type ContextCard } from "../types/contextCard";
import type { VocabularyBook } from "../types/vocabularyBook";
import {
  UNASSIGNED_DOMAIN_LABEL,
  buildVocabularyDomainSummaries,
  buildVocabularyEntries,
  contextCardDomainKeys,
  matchesVocabularyBookConcept,
  matchesVocabularyBookContextCard
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

const book = (
  domainTags: string[],
  includeUnassigned = false
): VocabularyBook => ({
  id: "vocab-1",
  name: "単語帳",
  domainTags,
  includeUnassigned,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
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

describe("VocabularyBook のタグ一致判定", () => {
  it("単一タグが一致する Concept を判定する", () => {
    expect(matchesVocabularyBookConcept(book(["英語"]), concept("c1", ["英語"]))).toBe(true);
  });

  it("複数タグのいずれかが一致すれば判定する", () => {
    expect(
      matchesVocabularyBookConcept(book(["英語", "心理学"]), concept("c1", ["数学", "心理学"]))
    ).toBe(true);
  });

  it("一致するタグがなく、大文字小文字だけが異なる場合も不一致にする", () => {
    expect(matchesVocabularyBookConcept(book(["English"]), concept("c1", ["english"]))).toBe(false);
  });

  it("前後空白を除去し、重複タグを無視して判定する", () => {
    expect(
      matchesVocabularyBookConcept(
        book([" 英語 ", "英語", "  "]),
        concept("c1", [" 英語 ", "英語"])
      )
    ).toBe(true);
  });

  it("分野未設定は includeUnassigned が true の場合だけ一致する", () => {
    const unassignedConcept = concept("c1", [" ", ""]);
    const unassignedCard = card("k1", { domainTags: [" "], domain: " " });
    expect(matchesVocabularyBookConcept(book([], false), unassignedConcept)).toBe(false);
    expect(matchesVocabularyBookConcept(book([], true), unassignedConcept)).toBe(true);
    expect(matchesVocabularyBookContextCard(book([], false), unassignedCard)).toBe(false);
    expect(matchesVocabularyBookContextCard(book([], true), unassignedCard)).toBe(true);
  });

  it("文字列タグ「未設定」と実際の分野未設定を区別する", () => {
    expect(
      matchesVocabularyBookConcept(book([UNASSIGNED_DOMAIN_LABEL]), concept("c1", []))
    ).toBe(false);
    expect(
      matchesVocabularyBookConcept(book([], true), concept("c1", [UNASSIGNED_DOMAIN_LABEL]))
    ).toBe(false);
    expect(
      matchesVocabularyBookConcept(
        book([UNASSIGNED_DOMAIN_LABEL]),
        concept("c1", [UNASSIGNED_DOMAIN_LABEL])
      )
    ).toBe(true);
    expect(
      matchesVocabularyBookContextCard(
        book([], true),
        card("k1", { domainTags: [], domain: UNASSIGNED_DOMAIN_LABEL })
      )
    ).toBe(false);
    expect(
      matchesVocabularyBookContextCard(
        book([UNASSIGNED_DOMAIN_LABEL]),
        card("k1", { domainTags: [], domain: UNASSIGNED_DOMAIN_LABEL })
      )
    ).toBe(true);
  });

  it("文脈カードは有効な domainTags が無ければ domain にフォールバックする", () => {
    expect(
      matchesVocabularyBookContextCard(
        book(["デンマーク語"]),
        card("k1", { domainTags: ["  "], domain: " デンマーク語 " })
      )
    ).toBe(true);
  });

  it("タグ0件かつ includeUnassigned=false の単語帳は常に不一致にする", () => {
    const emptyBook = book([], false);
    expect(matchesVocabularyBookConcept(emptyBook, concept("c1", ["英語"]))).toBe(false);
    expect(
      matchesVocabularyBookContextCard(
        emptyBook,
        card("k1", { domainTags: [], domain: undefined })
      )
    ).toBe(false);
  });

  it("判定時に単語帳・Concept・文脈カードを変更しない", () => {
    const inputBook = book([" 英語 ", "英語"]);
    const inputConcept = concept("c1", [" 英語 "]);
    const inputCard = card("k1", { domainTags: ["  "], domain: " 英語 " });
    const before = structuredClone({ inputBook, inputConcept, inputCard });

    matchesVocabularyBookConcept(inputBook, inputConcept);
    matchesVocabularyBookContextCard(inputBook, inputCard);

    expect({ inputBook, inputConcept, inputCard }).toEqual(before);
  });
});
