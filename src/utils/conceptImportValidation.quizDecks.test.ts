import { describe, expect, it } from "vitest";
import { QUIZ_DECK_SCHEMA_VERSION } from "../types/quiz";
import { normalizeQuizDecksForBackupImport, validateBackupImportPayload } from "./conceptImportValidation";
import { resolveDeckGenerationFilters } from "./syncQuizDeckFromFilters";

describe("legacy QuizDeck backup import", () => {
  it("sourceDomainTag を含む旧バックアップを受理し再同期条件を失わない", () => {
    const { decks, skipped } = normalizeQuizDecksForBackupImport([
      {
        id: "deck_legacy",
        title: "旧自動生成",
        questionIds: ["q1"],
        visibility: "private",
        schemaVersion: QUIZ_DECK_SCHEMA_VERSION,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        sourceType: "domain-tag",
        sourceDomainTag: "心理学検定"
      }
    ]);
    expect(skipped).toBe(0);
    expect(decks).toHaveLength(1);
    expect(decks[0].sourceDomainTag).toBe("心理学検定");
    expect(decks[0].generationFilters?.targetDomainTag).toBe("心理学検定");
    expect(resolveDeckGenerationFilters(decks[0])?.targetDomainTag).toBe("心理学検定");
  });

  it("generationFilters がある Deck は sourceDomainTag があっても上書きしない", () => {
    const { decks } = normalizeQuizDecksForBackupImport([
      {
        id: "deck_current",
        title: "現行形式",
        questionIds: [],
        visibility: "private",
        schemaVersion: QUIZ_DECK_SCHEMA_VERSION,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        sourceType: "domain-tag",
        sourceDomainTag: "旧",
        generationFilters: {
          targetDomainTag: "公式",
          includeDraftConcepts: true,
          generationMode: "auto"
        }
      }
    ]);
    expect(decks[0].generationFilters?.targetDomainTag).toBe("公式");
    expect(decks[0].generationFilters?.includeDraftConcepts).toBe(true);
  });

  it("旧バックアップ全体の validation が成功する", () => {
    const result = validateBackupImportPayload({
      concepts: [],
      contextCards: [],
      quizQuestions: [],
      quizDecks: [
        {
          id: "deck_legacy",
          title: "旧自動生成",
          questionIds: [],
          visibility: "private",
          schemaVersion: QUIZ_DECK_SCHEMA_VERSION,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          sourceType: "domain-tag",
          sourceDomainTag: "情報理論"
        }
      ]
    });
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.quizDecks[0].generationFilters?.targetDomainTag).toBe("情報理論");
  });
});
