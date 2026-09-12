import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createEmptyConceptInput, type Concept } from "../types/concept";
import type { ContextCard } from "../types/contextCard";
import {
  QUIZ_QUESTION_SCHEMA_VERSION,
  type QuizAttemptLog,
  type QuizChoice,
  type QuizDeck,
  type QuizQuestion
} from "../types/quiz";
import { IndexedDBStorage } from "./indexeddb";

const iso = "2026-01-01T00:00:00.000Z";

const concept = (id: string, extras: Partial<Concept> = {}): Concept => ({
  ...createEmptyConceptInput(),
  id,
  title: extras.title ?? id,
  createdAt: iso,
  updatedAt: iso,
  ...extras
});

const metadataChoice = (overrides: Partial<QuizChoice> = {}): QuizChoice => ({
  id: "a",
  text: "オペラント条件づけ",
  displayText: "○○条件づけ",
  linkedConceptId: "c_operant",
  sourceConceptId: "c_source",
  contextDefinitionId: "ctx_1",
  sourceStrategy: "same-context",
  ...overrides
});

const question = (overrides: Partial<QuizQuestion> = {}): QuizQuestion => ({
  id: "q_meta",
  prompt: "問い",
  choices: [metadataChoice(), { id: "b", text: "古典的条件づけ" }],
  correctChoiceId: "a",
  visibility: "private",
  schemaVersion: QUIZ_QUESTION_SCHEMA_VERSION,
  createdAt: iso,
  updatedAt: iso,
  ...overrides
});

const emptyImportExtras = {
  contextCards: [] as ContextCard[],
  quizDecks: [] as QuizDeck[],
  quizAttemptLogs: [] as QuizAttemptLog[],
  quizQuestionParseSkipped: 0,
  quizDeckParseSkipped: 0,
  quizAttemptLogParseSkipped: 0
};

const expectChoiceMetadata = (choice: QuizChoice | undefined) => {
  expect(choice?.displayText).toBe("○○条件づけ");
  expect(choice?.sourceConceptId).toBe("c_source");
  expect(choice?.contextDefinitionId).toBe("ctx_1");
  expect(choice?.sourceStrategy).toBe("same-context");
};

const deleteDb = (): Promise<void> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase("concept-book-db");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });

describe("importBackupData QuizChoice metadata", () => {
  let storage: IndexedDBStorage;

  beforeEach(async () => {
    await deleteDb();
    storage = new IndexedDBStorage();
  });

  afterEach(async () => {
    await deleteDb();
  });

  it("replace で有効な linkedConceptId と Choice metadata を保持する", async () => {
    await storage.importBackupData(
      {
        concepts: [concept("c_operant", { title: "オペラント条件づけ" }), concept("c_source")],
        quizQuestions: [question()],
        ...emptyImportExtras
      },
      "replace"
    );

    const imported = (await storage.getQuizQuestions()).find((q) => q.id === "q_meta");
    const choice = imported?.choices.find((c) => c.id === "a");
    expect(choice?.linkedConceptId).toBe("c_operant");
    expectChoiceMetadata(choice);
  });

  it("replace で無効な linkedConceptId だけを除去し、他 metadata は残す", async () => {
    await storage.importBackupData(
      {
        concepts: [concept("c_source")],
        quizQuestions: [question({ choices: [metadataChoice({ linkedConceptId: "missing" }), { id: "b", text: "B" }] })],
        ...emptyImportExtras
      },
      "replace"
    );

    const imported = (await storage.getQuizQuestions()).find((q) => q.id === "q_meta");
    const choice = imported?.choices.find((c) => c.id === "a");
    expect(choice).not.toHaveProperty("linkedConceptId");
    expect(choice?.id).toBe("a");
    expect(choice?.text).toBe("オペラント条件づけ");
    expectChoiceMetadata(choice);
  });

  it("merge でも Choice metadata が劣化しない", async () => {
    await storage.importBackupData(
      {
        concepts: [concept("c_operant"), concept("c_source")],
        quizQuestions: [
          question({
            id: "q_existing",
            updatedAt: "2026-01-01T00:00:00.000Z",
            choices: [
              { id: "a", text: "旧本文" },
              { id: "b", text: "B" }
            ]
          })
        ],
        ...emptyImportExtras
      },
      "replace"
    );

    await storage.importBackupData(
      {
        concepts: [concept("c_operant"), concept("c_source")],
        quizQuestions: [
          question({
            id: "q_existing",
            updatedAt: "2026-02-01T00:00:00.000Z"
          }),
          question({ id: "q_new" })
        ],
        ...emptyImportExtras
      },
      "merge"
    );

    const all = await storage.getQuizQuestions();
    const existing = all.find((q) => q.id === "q_existing");
    const created = all.find((q) => q.id === "q_new");
    expectChoiceMetadata(existing?.choices.find((c) => c.id === "a"));
    expect(existing?.choices.find((c) => c.id === "a")?.linkedConceptId).toBe("c_operant");
    expectChoiceMetadata(created?.choices.find((c) => c.id === "a"));
    expect(created?.choices.find((c) => c.id === "a")?.linkedConceptId).toBe("c_operant");
  });

  it("saveQuizQuestion でも Choice metadata を保持する", async () => {
    await storage.importConcepts(
      [concept("c_operant", { title: "オペラント条件づけ" }), concept("c_source")],
      "replace"
    );
    await storage.saveQuizQuestion(question());
    const saved = (await storage.getQuizQuestions()).find((q) => q.id === "q_meta");
    const choice = saved?.choices.find((c) => c.id === "a");
    expect(choice?.linkedConceptId).toBe("c_operant");
    expectChoiceMetadata(choice);
  });
});
