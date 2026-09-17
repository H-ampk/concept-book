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

const t1 = "2026-01-01T00:00:00.000Z";
const t2 = "2026-02-01T00:00:00.000Z";

const concept = (id: string, extras: Partial<Concept> = {}): Concept => ({
  ...createEmptyConceptInput(),
  id,
  title: extras.title ?? id,
  createdAt: extras.createdAt ?? t1,
  updatedAt: extras.updatedAt ?? t1,
  ...extras
});

const emptyImportExtras = {
  contextCards: [] as ContextCard[],
  quizDecks: [] as QuizDeck[],
  quizAttemptLogs: [] as QuizAttemptLog[],
  quizQuestionParseSkipped: 0,
  quizDeckParseSkipped: 0,
  quizAttemptLogParseSkipped: 0
};

const questionWithContextChoice = (
  conceptId: string,
  contextDefinitionId: string
): QuizQuestion => ({
  id: "q_ctx",
  questionType: "multiple-choice",
  prompt: "問い",
  choices: [
    {
      id: "a",
      text: "D2 定義",
      sourceConceptId: conceptId,
      contextDefinitionId
    } satisfies QuizChoice,
    { id: "b", text: "他" }
  ],
  correctChoiceId: "a",
  visibility: "private",
  schemaVersion: QUIZ_QUESTION_SCHEMA_VERSION,
  createdAt: t1,
  updatedAt: t1
});

const deleteDb = (): Promise<void> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase("concept-book-db");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });

describe("importBackupData contextDefinitions merge", () => {
  let storage: IndexedDBStorage;

  beforeEach(async () => {
    await deleteDb();
    storage = new IndexedDBStorage();
  });

  afterEach(async () => {
    await deleteDb();
  });

  it("newer import でも local-only definition を保持する", async () => {
    await storage.importBackupData(
      {
        concepts: [
          concept("A", {
            title: "local",
            updatedAt: t1,
            contextDefinitions: [
              { id: "D1", context: "local", definition: "local D1" },
              { id: "D2", context: "local", definition: "local D2" }
            ]
          })
        ],
        quizQuestions: [],
        ...emptyImportExtras
      },
      "replace"
    );

    await storage.importBackupData(
      {
        concepts: [
          concept("A", {
            title: "import",
            updatedAt: t2,
            contextDefinitions: [{ id: "D1", context: "import", definition: "import D1" }]
          })
        ],
        quizQuestions: [],
        ...emptyImportExtras
      },
      "merge"
    );

    const merged = (await storage.getAllConcepts()).find((item) => item.id === "A");
    expect(merged?.title).toBe("import");
    expect(merged?.updatedAt).toBe(t2);
    expect(merged?.contextDefinitions?.map((item) => item.id)).toEqual(["D1", "D2"]);
    expect(merged?.contextDefinitions?.find((item) => item.id === "D1")).toEqual({
      id: "D1",
      context: "import",
      definition: "import D1"
    });
    expect(merged?.contextDefinitions?.find((item) => item.id === "D2")).toEqual({
      id: "D2",
      context: "local",
      definition: "local D2"
    });
  });

  it("import-only definition を追加する", async () => {
    await storage.importBackupData(
      {
        concepts: [
          concept("A", {
            updatedAt: t1,
            contextDefinitions: [{ id: "D1", context: "local", definition: "local D1" }]
          })
        ],
        quizQuestions: [],
        ...emptyImportExtras
      },
      "replace"
    );

    await storage.importBackupData(
      {
        concepts: [
          concept("A", {
            updatedAt: t2,
            contextDefinitions: [
              { id: "D1", context: "import", definition: "import D1" },
              { id: "D2", context: "import", definition: "import D2" }
            ]
          })
        ],
        quizQuestions: [],
        ...emptyImportExtras
      },
      "merge"
    );

    const merged = (await storage.getAllConcepts()).find((item) => item.id === "A");
    expect(merged?.contextDefinitions?.map((item) => item.id)).toEqual(["D1", "D2"]);
  });

  it("双方で別々に追加した定義を両方残す", async () => {
    await storage.importBackupData(
      {
        concepts: [
          concept("A", {
            updatedAt: t1,
            contextDefinitions: [
              { id: "D1", context: "shared", definition: "local D1" },
              { id: "D2", context: "local", definition: "local D2" }
            ]
          })
        ],
        quizQuestions: [],
        ...emptyImportExtras
      },
      "replace"
    );

    await storage.importBackupData(
      {
        concepts: [
          concept("A", {
            updatedAt: t2,
            contextDefinitions: [
              { id: "D1", context: "import", definition: "import D1" },
              { id: "D3", context: "import", definition: "import D3" }
            ]
          })
        ],
        quizQuestions: [],
        ...emptyImportExtras
      },
      "merge"
    );

    const merged = (await storage.getAllConcepts()).find((item) => item.id === "A");
    expect(merged?.contextDefinitions?.map((item) => item.id)).toEqual(["D1", "D3", "D2"]);
  });

  it("Quiz の contextDefinitionId を dangling にしない", async () => {
    await storage.importBackupData(
      {
        concepts: [
          concept("A", {
            updatedAt: t1,
            contextDefinitions: [
              { id: "D1", context: "local", definition: "local D1" },
              { id: "D2", context: "local", definition: "local D2" }
            ]
          })
        ],
        quizQuestions: [questionWithContextChoice("A", "D2")],
        ...emptyImportExtras
      },
      "replace"
    );

    await storage.importBackupData(
      {
        concepts: [
          concept("A", {
            updatedAt: t2,
            contextDefinitions: [{ id: "D1", context: "import", definition: "import D1" }]
          })
        ],
        quizQuestions: [],
        ...emptyImportExtras
      },
      "merge"
    );

    const merged = (await storage.getAllConcepts()).find((item) => item.id === "A");
    const quiz = (await storage.getQuizQuestions()).find((item) => item.id === "q_ctx");
    const choice = quiz?.choices.find((item) => item.id === "a");
    expect(merged?.contextDefinitions?.some((item) => item.id === "D2")).toBe(true);
    expect(choice?.sourceConceptId).toBe("A");
    expect(choice?.contextDefinitionId).toBe("D2");
    expect(merged?.contextDefinitions?.some((item) => item.id === choice?.contextDefinitionId)).toBe(
      true
    );
  });

  it("replace import は contextDefinitions を union しない", async () => {
    await storage.importBackupData(
      {
        concepts: [
          concept("A", {
            updatedAt: t1,
            contextDefinitions: [
              { id: "D1", context: "local", definition: "local D1" },
              { id: "D2", context: "local", definition: "local D2" }
            ]
          })
        ],
        quizQuestions: [],
        ...emptyImportExtras
      },
      "replace"
    );

    await storage.importBackupData(
      {
        concepts: [
          concept("A", {
            updatedAt: t2,
            contextDefinitions: [{ id: "D1", context: "import", definition: "import D1" }]
          })
        ],
        quizQuestions: [],
        ...emptyImportExtras
      },
      "replace"
    );

    const replaced = (await storage.getAllConcepts()).find((item) => item.id === "A");
    expect(replaced?.contextDefinitions).toEqual([
      { id: "D1", context: "import", definition: "import D1" }
    ]);
  });
});
