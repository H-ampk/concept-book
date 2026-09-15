import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createEmptyConceptInput, type Concept } from "../types/concept";
import {
  DATA_LAB_ANALYSIS_SNAPSHOT_SCHEMA_VERSION,
  type ResearchReport
} from "../types/researchReport";
import {
  QUIZ_ATTEMPT_LOG_SCHEMA_VERSION,
  QUIZ_DECK_SCHEMA_VERSION,
  QUIZ_QUESTION_SCHEMA_VERSION,
  type QuizAttemptLog,
  type QuizDeck,
  type QuizQuestion
} from "../types/quiz";
import { DEFAULT_DATA_LAB_FILTERS } from "../utils/dataLab/filterDataLabLogs";
import { ContextCardIndexedDBStorage, IndexedDBStorage } from "./indexeddb";

const iso = "2026-01-01T00:00:00.000Z";
const CTX_DEF_A = "ctx_a_1";
const CTX_DEF_B = "ctx_b_1";

const concept = (id: string, extras: Partial<Concept> = {}): Concept => ({
  ...createEmptyConceptInput(),
  id,
  title: extras.title ?? id,
  createdAt: iso,
  updatedAt: iso,
  ...extras
});

const question = (overrides: Partial<QuizQuestion> = {}): QuizQuestion => ({
  id: "q-base",
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

const deleteDb = (): Promise<void> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase("concept-book-db");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });

describe("deleteConcept live reference cleanup", () => {
  let storage: IndexedDBStorage;
  let contextStorage: ContextCardIndexedDBStorage;

  beforeEach(async () => {
    await deleteDb();
    storage = new IndexedDBStorage();
    contextStorage = new ContextCardIndexedDBStorage();
  });

  afterEach(async () => {
    await deleteDb();
  });

  it("live reference だけ掃除し historical snapshot は保持する", async () => {
    await storage.importConcepts([concept("A"), concept("B")], "replace");

    const questionA = question({
      id: "q-a",
      conceptId: "A",
      prompt: "A の問い",
      source: {
        type: "contextualConceptCard",
        sourceId: `A:${CTX_DEF_A}`,
        sourceTitle: "A / 文脈"
      },
      choices: [
        {
          id: "a",
          text: "オペラント条件づけ",
          displayText: "○○条件づけ",
          linkedConceptId: "A",
          sourceConceptId: "A",
          contextDefinitionId: CTX_DEF_A,
          sourceStrategy: "same-context"
        },
        { id: "b", text: "誤答" }
      ]
    });
    const questionB = question({
      id: "q-b",
      conceptId: "B",
      prompt: "B の問い",
      source: {
        type: "contextualConceptCard",
        sourceId: `B:${CTX_DEF_B}`,
        sourceTitle: "B / 文脈"
      },
      choices: [
        {
          id: "a",
          text: "古典的条件づけ",
          displayText: "古典的",
          linkedConceptId: "B",
          sourceConceptId: "B",
          contextDefinitionId: CTX_DEF_B,
          sourceStrategy: "related-context"
        },
        { id: "b", text: "誤答B" }
      ]
    });
    const questionContextCardSource = question({
      id: "q-context-card",
      conceptId: "B",
      source: {
        type: "contextCard",
        sourceId: "context-card-1",
        sourceTitle: "文脈カード"
      }
    });
    await storage.saveQuizQuestion(questionA);
    await storage.saveQuizQuestion(questionB);
    await storage.saveQuizQuestion(questionContextCardSource);

    const createdCard = await contextStorage.createContextCard({
      title: "カード",
      domainTags: ["心理学"],
      centralQuestion: "Q",
      background: "",
      flow: "",
      keyConcepts: "",
      linkedConcepts: ["A", "B"]
    });

    const deck: QuizDeck = {
      id: "deck-1",
      title: "Deck",
      questionIds: ["q-a", "q-b"],
      visibility: "private",
      schemaVersion: QUIZ_DECK_SCHEMA_VERSION,
      createdAt: iso,
      updatedAt: iso
    };
    await storage.saveQuizDeck(deck);

    const attemptLog: QuizAttemptLog = {
      id: "log-a",
      conceptId: "A",
      questionId: "q-a",
      questionType: "multiple-choice",
      questionPromptSnapshot: "A の問い",
      questionConceptId: "A",
      selectedChoiceId: "a",
      selectedChoiceTextSnapshot: "オペラント条件づけ",
      selectedLinkedConceptId: "A",
      correctChoiceId: "a",
      correctChoiceTextSnapshot: "オペラント条件づけ",
      correctLinkedConceptId: "A",
      correct: true,
      startedAt: iso,
      answeredAt: iso,
      timeMs: 1000,
      schemaVersion: QUIZ_ATTEMPT_LOG_SCHEMA_VERSION
    };
    await storage.saveQuizAttemptLog(attemptLog);

    const report: ResearchReport = {
      id: "report-1",
      title: "分析",
      createdAt: iso,
      updatedAt: iso,
      blocks: [
        {
          id: "block-1",
          type: "data-lab-analysis",
          commentary: "note",
          snapshot: {
            schemaVersion: DATA_LAB_ANALYSIS_SNAPSHOT_SCHEMA_VERSION,
            createdAt: iso,
            source: "data-lab",
            filters: {
              ...DEFAULT_DATA_LAB_FILTERS,
              conceptIds: ["A", "B"],
              deckIds: ["deck-1"]
            },
            filterChips: [],
            filterLabels: [],
            groupBy: "concept",
            metric: "accuracy",
            displayMode: "table",
            sourceLogCount: 1,
            rows: [],
            totalRowCount: 0,
            savedRowCount: 0,
            truncated: false
          }
        }
      ]
    };
    await storage.saveResearchReport(report);

    const logBefore = (await storage.getQuizAttemptLogs()).find((item) => item.id === "log-a");
    const reportBefore = await storage.getResearchReport("report-1");

    await storage.deleteConcept("A");

    const remainingConcepts = await storage.getAllConcepts();
    expect(remainingConcepts.map((item) => item.id)).toEqual(["B"]);

    const questions = await storage.getQuizQuestions();
    const savedA = questions.find((item) => item.id === "q-a");
    const savedB = questions.find((item) => item.id === "q-b");
    const savedContextCardQ = questions.find((item) => item.id === "q-context-card");
    expect(savedA).toBeDefined();
    expect(savedA?.conceptId).toBeUndefined();
    expect(savedA?.source).toBeUndefined();
    const choiceA = savedA?.choices.find((item) => item.id === "a");
    expect(choiceA).not.toHaveProperty("linkedConceptId");
    expect(choiceA).not.toHaveProperty("sourceConceptId");
    expect(choiceA).not.toHaveProperty("contextDefinitionId");
    expect(choiceA?.id).toBe("a");
    expect(choiceA?.text).toBe("オペラント条件づけ");
    expect(choiceA?.displayText).toBe("○○条件づけ");
    expect(choiceA?.sourceStrategy).toBe("same-context");

    expect(savedB?.conceptId).toBe("B");
    expect(savedB?.source).toEqual({
      type: "contextualConceptCard",
      sourceId: `B:${CTX_DEF_B}`,
      sourceTitle: "B / 文脈"
    });
    const choiceB = savedB?.choices.find((item) => item.id === "a");
    expect(choiceB?.linkedConceptId).toBe("B");
    expect(choiceB?.sourceConceptId).toBe("B");
    expect(choiceB?.contextDefinitionId).toBe(CTX_DEF_B);
    expect(choiceB?.displayText).toBe("古典的");
    expect(choiceB?.sourceStrategy).toBe("related-context");

    expect(savedContextCardQ?.source).toEqual({
      type: "contextCard",
      sourceId: "context-card-1",
      sourceTitle: "文脈カード"
    });

    const cards = await contextStorage.getAllContextCards();
    const card = cards.find((item) => item.id === createdCard.id);
    expect(card).toBeDefined();
    expect(card?.linkedConcepts).toEqual(["B"]);

    const decks = await storage.getQuizDecks();
    const savedDeck = decks.find((item) => item.id === "deck-1");
    expect(savedDeck).toBeDefined();
    expect(savedDeck?.questionIds).toEqual(["q-a", "q-b"]);

    const logAfter = (await storage.getQuizAttemptLogs()).find((item) => item.id === "log-a");
    expect(logAfter).toEqual(logBefore);

    const reportAfter = await storage.getResearchReport("report-1");
    expect(reportAfter).toEqual(reportBefore);
    expect(reportAfter?.blocks[0]?.snapshot.filters.conceptIds).toEqual(["A", "B"]);
  });

  it("他 Concept の contextualConceptCard source は消さない", async () => {
    await storage.importConcepts([concept("A"), concept("B")], "replace");
    await storage.saveQuizQuestion(
      question({
        id: "q-other-source",
        source: {
          type: "contextualConceptCard",
          sourceId: "B:ctx",
          sourceTitle: "B 文脈"
        }
      })
    );
    await storage.deleteConcept("A");
    const saved = (await storage.getQuizQuestions()).find((item) => item.id === "q-other-source");
    expect(saved?.source).toEqual({
      type: "contextualConceptCard",
      sourceId: "B:ctx",
      sourceTitle: "B 文脈"
    });
  });
});
