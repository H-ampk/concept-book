import { describe, expect, it } from "vitest";
import { createEmptyConceptInput, type Concept } from "../types/concept";
import {
  QUIZ_DECK_SCHEMA_VERSION,
  QUIZ_QUESTION_SCHEMA_VERSION,
  type QuizDeck,
  type QuizQuestion
} from "../types/quiz";
import { collectConceptIdsInDeckPool, previewQuizDeckSync, syncQuizDeckFromFilters } from "./syncQuizDeckFromFilters";

const iso = "2026-01-01T00:00:00.000Z";

const concept = (id: string, extras: Partial<Concept> = {}): Concept => ({
  ...createEmptyConceptInput(),
  id,
  title: extras.title ?? id,
  createdAt: iso,
  updatedAt: iso,
  ...extras
});

const question = (overrides: Partial<QuizQuestion> = {}): QuizQuestion => ({
  id: "q-1",
  questionType: "multiple-choice",
  prompt: "問い",
  choices: [
    { id: "a", text: "A" },
    { id: "b", text: "B" }
  ],
  correctChoiceId: "a",
  visibility: "private",
  schemaVersion: QUIZ_QUESTION_SCHEMA_VERSION,
  createdAt: iso,
  updatedAt: iso,
  ...overrides
});

const deck = (overrides: Partial<QuizDeck> = {}): QuizDeck => ({
  id: "deck-1",
  title: "Deck",
  questionIds: ["q-dangling"],
  visibility: "private",
  schemaVersion: QUIZ_DECK_SCHEMA_VERSION,
  createdAt: iso,
  updatedAt: iso,
  sourceType: "domain-tag",
  generationFilters: { targetDomainTag: "心理学" },
  ...overrides
});

describe("collectConceptIdsInDeckPool live Concept 解決", () => {
  it("削除済み Concept の sourceConceptId だけが残る問題は pool Concept に数えない", () => {
    const dangling = question({
      id: "q-dangling",
      choices: [
        { id: "a", text: "A", sourceConceptId: "deleted-concept" },
        { id: "b", text: "B" }
      ]
    });
    const questionsById = new Map([[dangling.id, dangling]]);
    const validConceptIds = new Set(["live-b"]);
    const { conceptIds, withoutConceptId } = collectConceptIdsInDeckPool(
      deck(),
      questionsById,
      validConceptIds
    );
    expect(conceptIds.has("deleted-concept")).toBe(false);
    expect(conceptIds.size).toBe(0);
    expect(withoutConceptId).toBe(1);
  });

  it("previewQuizDeckSync でも current allConcepts に無い ID は pool Concept にしない", () => {
    const dangling = question({
      id: "q-dangling",
      choices: [
        { id: "a", text: "A", sourceConceptId: "deleted-concept" },
        { id: "b", text: "B" }
      ]
    });
    const preview = previewQuizDeckSync({
      deck: deck(),
      allConcepts: [concept("live-b", { domainTags: ["心理学"] })],
      allQuestions: [dangling]
    });
    expect(preview.questionsWithoutConceptId).toBe(1);
    expect(preview.skippedEntries.some((entry) => entry.conceptId === "deleted-concept")).toBe(
      false
    );
  });
});

describe("syncQuizDeckFromFilters concept-general", () => {
  const domainConcepts = (): Concept[] => [
    concept("a", {
      title: "概念A",
      definition: "Aの一般定義。十分な長さの定義文です。",
      domainTags: ["心理学"]
    }),
    concept("b", {
      title: "概念B",
      definition: "Bの別説明。十分な長さの定義文です。",
      domainTags: ["心理学"]
    }),
    concept("c", {
      title: "概念C",
      definition: "Cの別説明。十分な長さの定義文です。",
      domainTags: ["心理学"]
    }),
    concept("d", {
      title: "概念D",
      definition: "Dの別説明。十分な長さの定義文です。",
      domainTags: ["心理学"]
    })
  ];

  it("同一 Concept が Deck pool にあれば skip する", () => {
    const concepts = domainConcepts();
    const existing = question({
      id: "q-a",
      conceptId: "a"
    });
    const preview = previewQuizDeckSync({
      deck: deck({
        questionIds: ["q-a"],
        generationFilters: { targetDomainTag: "心理学", generationMode: "concept-general" }
      }),
      allConcepts: concepts,
      allQuestions: [existing]
    });
    expect(preview.skippedEntries.some((entry) => entry.conceptId === "a" && entry.reason === "already-in-pool")).toBe(
      true
    );
    expect(preview.addableConcepts.some((item) => item.id === "a")).toBe(false);
  });

  it("新規 sync の concept-general Question に conceptGeneral source が付く", () => {
    const concepts = domainConcepts();
    const result = syncQuizDeckFromFilters({
      deck: deck({
        questionIds: [],
        generationFilters: { targetDomainTag: "心理学", generationMode: "concept-general" }
      }),
      allConcepts: concepts,
      allContextCards: [],
      allQuestions: [],
      createQuestionId: (() => {
        let n = 0;
        return () => `q-new-${++n}`;
      })(),
      nowIso: iso
    });
    expect(result.addedQuestionCount).toBeGreaterThan(0);
    expect(result.newQuestions[0]?.source).toEqual({
      type: "conceptGeneral",
      sourceId: result.newQuestions[0]?.conceptId,
      sourceTitle: expect.any(String),
      fieldName: "心理学"
    });
  });
});
