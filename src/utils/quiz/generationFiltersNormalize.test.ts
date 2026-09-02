import { describe, expect, it } from "vitest";
import type { QuizDeck } from "../../types/quiz";
import { QUIZ_DECK_SCHEMA_VERSION } from "../../types/quiz";
import { buildDomainTagGeneratedDeckFields } from "./buildDomainTagGeneratedDeckFields";
import { hydrateLegacyGenerationFilters } from "./hydrateLegacyGenerationFilters";
import { resolveDeckGenerationFilters } from "../syncQuizDeckFromFilters";

const baseDeck = (overrides: Partial<QuizDeck> = {}): QuizDeck => ({
  id: "deck_1",
  title: "テスト集",
  questionIds: ["q1"],
  visibility: "private",
  schemaVersion: QUIZ_DECK_SCHEMA_VERSION,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides
});

describe("buildDomainTagGeneratedDeckFields", () => {
  it("新規自動生成 Deck に sourceDomainTag を含めず generationFilters を保存する", () => {
    const fields = buildDomainTagGeneratedDeckFields({
      targetDomainTag: "心理学",
      includeDraftConcepts: true,
      generationMode: "auto",
      lastSyncedAt: "2026-09-02T00:00:00.000Z"
    });
    expect(fields).not.toHaveProperty("sourceDomainTag");
    expect(fields.sourceType).toBe("domain-tag");
    expect(fields.generationFilters).toEqual({
      targetDomainTag: "心理学",
      includeDraftConcepts: true,
      generationMode: "auto"
    });
  });
});

describe("hydrateLegacyGenerationFilters", () => {
  it("sourceDomainTag のみの旧 Deck から generationFilters を復元する", () => {
    const deck = baseDeck({
      sourceType: "domain-tag",
      sourceDomainTag: "情報理論"
    });
    const hydrated = hydrateLegacyGenerationFilters(deck);
    expect(hydrated.generationFilters).toEqual({
      targetDomainTag: "情報理論",
      includeDraftConcepts: false,
      generationMode: "auto"
    });
    expect(hydrated.sourceDomainTag).toBe("情報理論");
  });

  it("既存の generationFilters は上書きしない", () => {
    const deck = baseDeck({
      sourceType: "domain-tag",
      sourceDomainTag: "旧タグ",
      generationFilters: {
        targetDomainTag: "新タグ",
        includeDraftConcepts: true,
        generationMode: "concept-general"
      }
    });
    hydrateLegacyGenerationFilters(deck);
    expect(deck.generationFilters).toEqual({
      targetDomainTag: "新タグ",
      includeDraftConcepts: true,
      generationMode: "concept-general"
    });
  });
});

describe("resolveDeckGenerationFilters", () => {
  it("generationFilters.targetDomainTag を優先する", () => {
    const filters = resolveDeckGenerationFilters(
      baseDeck({
        sourceType: "domain-tag",
        sourceDomainTag: "旧",
        generationFilters: {
          targetDomainTag: "公式",
          includeDraftConcepts: true,
          generationMode: "context-definition"
        }
      })
    );
    expect(filters).toEqual({
      targetDomainTag: "公式",
      includeDraftConcepts: true,
      generationMode: "context-definition"
    });
  });

  it("generationFilters が無い旧 Deck は sourceDomainTag から復元する", () => {
    const filters = resolveDeckGenerationFilters(
      baseDeck({
        sourceType: "domain-tag",
        sourceDomainTag: "社会心理"
      })
    );
    expect(filters).toEqual({
      targetDomainTag: "社会心理",
      includeDraftConcepts: false,
      generationMode: "auto"
    });
  });

  it("sourceDomainTag も無い場合は domainTags 先頭へフォールバックする", () => {
    const filters = resolveDeckGenerationFilters(
      baseDeck({
        sourceType: "domain-tag",
        domainTags: ["教材A", "教材B"]
      })
    );
    expect(filters?.targetDomainTag).toBe("教材A");
  });
});
