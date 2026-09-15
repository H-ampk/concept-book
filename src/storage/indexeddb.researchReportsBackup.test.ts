import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyConceptInput, type Concept } from "../types/concept";
import { createEmptyContextCardInput } from "../types/contextCard";
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
import { buildConceptBookZip } from "../utils/conceptBookZip";
import { DEFAULT_DATA_LAB_FILTERS } from "../utils/dataLab/filterDataLabLogs";
import { IndexedDBStorage } from "./indexeddb";

const iso = "2026-01-01T00:00:00.000Z";
const later = "2026-02-01T00:00:00.000Z";

const parseSkipped = {
  quizQuestionParseSkipped: 0,
  quizDeckParseSkipped: 0,
  quizAttemptLogParseSkipped: 0,
  researchReportParseSkipped: 0
};

const snapshot = {
  schemaVersion: DATA_LAB_ANALYSIS_SNAPSHOT_SCHEMA_VERSION,
  createdAt: iso,
  source: "data-lab" as const,
  filters: { ...DEFAULT_DATA_LAB_FILTERS },
  filterChips: [],
  filterLabels: [],
  groupBy: "concept" as const,
  metric: "accuracy" as const,
  displayMode: "table" as const,
  sourceLogCount: 0,
  rows: [],
  totalRowCount: 0,
  savedRowCount: 0,
  truncated: false
};

const report = (id: string, extras: Partial<ResearchReport> = {}): ResearchReport => ({
  id,
  title: extras.title ?? id,
  blocks: extras.blocks ?? [
    {
      id: `${id}-b1`,
      type: "data-lab-analysis",
      snapshot,
      commentary: extras.title ?? ""
    }
  ],
  createdAt: extras.createdAt ?? iso,
  updatedAt: extras.updatedAt ?? iso,
  ...extras
});

const concept = (id: string, extras: Partial<Concept> = {}): Concept => ({
  ...createEmptyConceptInput(),
  id,
  title: extras.title ?? id,
  createdAt: iso,
  updatedAt: iso,
  ...extras
});

const question = (id: string): QuizQuestion => ({
  id,
  questionType: "multiple-choice",
  prompt: id,
  choices: [
    { id: "a", text: "A" },
    { id: "b", text: "B" }
  ],
  correctChoiceId: "a",
  visibility: "private",
  schemaVersion: QUIZ_QUESTION_SCHEMA_VERSION,
  createdAt: iso,
  updatedAt: iso
});

const deck = (id: string, questionIds: string[]): QuizDeck => ({
  id,
  title: id,
  questionIds,
  visibility: "private",
  schemaVersion: QUIZ_DECK_SCHEMA_VERSION,
  createdAt: iso,
  updatedAt: iso
});

const log = (id: string, questionId: string): QuizAttemptLog => ({
  id,
  questionId,
  questionType: "multiple-choice",
  questionPromptSnapshot: "q",
  selectedChoiceId: "a",
  selectedChoiceTextSnapshot: "A",
  correctChoiceId: "a",
  correctChoiceTextSnapshot: "A",
  correct: true,
  startedAt: iso,
  answeredAt: iso,
  timeMs: 10,
  schemaVersion: QUIZ_ATTEMPT_LOG_SCHEMA_VERSION
});

const emptyEntities = {
  concepts: [] as Concept[],
  contextCards: [] as ReturnType<typeof createEmptyContextCardInput>[],
  quizQuestions: [] as QuizQuestion[],
  quizDecks: [] as QuizDeck[],
  quizAttemptLogs: [] as QuizAttemptLog[]
};

const zipFileFrom = (payload: Record<string, unknown>): File => {
  const zipped = buildConceptBookZip(JSON.stringify(payload), []);
  return new File([new Uint8Array(zipped)], "backup.zip", { type: "application/zip" });
};

const deleteDb = (): Promise<void> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase("concept-book-db");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });

describe("researchReports backup / merge / replace (#178)", () => {
  let storage: IndexedDBStorage;

  beforeEach(async () => {
    await deleteDb();
    storage = new IndexedDBStorage();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await deleteDb();
  });

  it("JSON export に researchReports が含まれ、学習ログ除外でも残る", async () => {
    await storage.saveResearchReport(report("rr1"));
    const full = await storage.exportBackupData();
    expect(full.researchReports.map((r) => r.id)).toEqual(["rr1"]);
    const withoutLogs = await storage.exportBackupData({ includeQuizAttemptLogs: false });
    expect(withoutLogs.quizAttemptLogs).toEqual([]);
    expect(withoutLogs.researchReports.map((r) => r.id)).toEqual(["rr1"]);
  });

  it("ZIP の concepts.json に researchReports が含まれる", async () => {
    await storage.saveResearchReport(report("rr-zip"));
    const blob = await storage.exportConceptBookPackage();
    const { unzipSync } = await import("fflate");
    const unzipped = unzipSync(new Uint8Array(await blob.arrayBuffer()));
    expect(Object.keys(unzipped).some((name) => name.startsWith("research"))).toBe(false);
    const json = JSON.parse(new TextDecoder().decode(unzipped["concepts.json"])) as {
      researchReports: { id: string }[];
    };
    expect(json.researchReports.map((r) => r.id)).toEqual(["rr-zip"]);
  });

  it("新形式 JSON replace は既存 ResearchReport を完全置換し、空配列なら0件になる", async () => {
    await storage.saveResearchReport(report("old_rr"));
    await storage.importBackupData(
      {
        ...emptyEntities,
        concepts: [concept("new_c")],
        researchReports: [report("new_rr")],
        ...parseSkipped
      },
      "replace"
    );
    expect((await storage.getResearchReports()).map((r) => r.id)).toEqual(["new_rr"]);

    await storage.importBackupData(
      {
        ...emptyEntities,
        researchReports: [],
        ...parseSkipped
      },
      "replace"
    );
    expect(await storage.getResearchReports()).toEqual([]);
  });

  it("新形式 ZIP replace も ResearchReport を置換する", async () => {
    await storage.saveResearchReport(report("old_zip"));
    const zip = zipFileFrom({
      concepts: [concept("new_c")],
      contextCards: [],
      quizQuestions: [],
      quizDecks: [],
      quizAttemptLogs: [],
      researchReports: [report("zip_rr")]
    });
    await storage.importConceptBookPackage(zip, "replace");
    expect((await storage.getResearchReports()).map((r) => r.id)).toEqual(["zip_rr"]);
  });

  it("旧形式 JSON / ZIP replace では既存 ResearchReport を保持する", async () => {
    await storage.saveResearchReport(report("keep_rr", { title: "残す" }));
    await storage.importBackupData(
      {
        concepts: [concept("c1")],
        contextCards: [],
        quizQuestions: [],
        quizDecks: [],
        quizAttemptLogs: [],
        ...parseSkipped
      },
      "replace"
    );
    expect((await storage.getResearchReport("keep_rr"))?.title).toBe("残す");

    const oldZip = zipFileFrom({
      concepts: [concept("c2")],
      contextCards: [],
      quizQuestions: [],
      quizDecks: [],
      quizAttemptLogs: []
    });
    await storage.importConceptBookPackage(oldZip, "replace");
    expect((await storage.getResearchReport("keep_rr"))?.title).toBe("残す");
    expect((await storage.getConceptById("c2"))?.title).toBe("c2");
  });

  it("merge は新規 ID を追加し、同一 ID は新しい updatedAt を残し、同時刻は existing を保持する", async () => {
    await storage.saveResearchReport(report("same", { title: "existing", updatedAt: iso }));
    await storage.saveResearchReport(report("old-only", { title: "残る" }));
    const result = await storage.importBackupData(
      {
        ...emptyEntities,
        researchReports: [
          report("same", { title: "incoming-newer", updatedAt: later }),
          report("new-id", { title: "追加" }),
          report("tie", { title: "incoming-tie", updatedAt: iso })
        ],
        ...parseSkipped
      },
      "merge"
    );
    await storage.saveResearchReport(report("tie", { title: "existing-tie", updatedAt: iso }));
    const tieMerge = await storage.importBackupData(
      {
        ...emptyEntities,
        researchReports: [report("tie", { title: "incoming-tie", updatedAt: iso })],
        ...parseSkipped
      },
      "merge"
    );
    expect((await storage.getResearchReport("same"))?.title).toBe("incoming-newer");
    expect((await storage.getResearchReport("new-id"))?.title).toBe("追加");
    expect((await storage.getResearchReport("old-only"))?.title).toBe("残る");
    expect((await storage.getResearchReport("tie"))?.title).toBe("existing-tie");
    expect(result.importedResearchReports).toBe(3);
    expect(tieMerge.importedResearchReports).toBe(1);
    expect((await storage.getResearchReport("tie"))?.title).toBe("existing-tie");
  });

  it("不正 entry の skipped が skippedResearchReports に反映される", async () => {
    const result = await storage.importBackupData(
      {
        ...emptyEntities,
        researchReports: [report("ok")],
        researchReportParseSkipped: 2,
        quizQuestionParseSkipped: 0,
        quizDeckParseSkipped: 0,
        quizAttemptLogParseSkipped: 0
      },
      "merge"
    );
    expect(result.importedResearchReports).toBe(1);
    expect(result.skippedResearchReports).toBe(2);
  });

  it("atomic replace 中の ResearchReport put 失敗は全ストアを rollback する", async () => {
    await storage.importBackupData(
      {
        concepts: [concept("old_c")],
        contextCards: [{ ...createEmptyContextCardInput(), id: "old_ctx", title: "旧文脈", createdAt: iso, updatedAt: iso }],
        quizQuestions: [question("old_q")],
        quizDecks: [deck("old_d", ["old_q"])],
        quizAttemptLogs: [log("old_log", "old_q")],
        researchReports: [report("old_rr")],
        ...parseSkipped
      },
      "replace"
    );

    const originalPut = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (this: IDBObjectStore, value, key) {
      if (this.name === "researchReports") {
        throw new Error("injected researchReports put failure");
      }
      return originalPut.call(this, value, key);
    });

    await expect(
      storage.importBackupData(
        {
          concepts: [concept("new_c")],
          contextCards: [{ ...createEmptyContextCardInput(), id: "new_ctx", title: "新文脈", createdAt: iso, updatedAt: iso }],
          quizQuestions: [question("new_q")],
          quizDecks: [deck("new_d", ["new_q"])],
          quizAttemptLogs: [log("new_log", "new_q")],
          researchReports: [report("new_rr")],
          ...parseSkipped
        },
        "replace"
      )
    ).rejects.toThrow("injected researchReports put failure");

    vi.restoreAllMocks();
    expect((await storage.getConceptById("old_c"))?.title).toBe("old_c");
    expect(await storage.getConceptById("new_c")).toBeUndefined();
    expect((await storage.getQuizQuestions()).map((q) => q.id)).toEqual(["old_q"]);
    expect((await storage.getQuizDecks()).map((d) => d.id)).toEqual(["old_d"]);
    expect((await storage.getQuizAttemptLogs()).map((row) => row.id)).toEqual(["old_log"]);
    expect((await storage.getResearchReports()).map((r) => r.id)).toEqual(["old_rr"]);
  });

  it("researchReports を持たない旧 JSON / ZIP fixture を import できる", async () => {
    const jsonResult = await storage.importBackupData(
      {
        concepts: [concept("legacy_c")],
        contextCards: [],
        quizQuestions: [],
        quizDecks: [],
        quizAttemptLogs: [],
        quizQuestionParseSkipped: 0,
        quizDeckParseSkipped: 0,
        quizAttemptLogParseSkipped: 0
      },
      "merge"
    );
    expect(jsonResult.importedConcepts).toBe(1);
    expect(jsonResult.importedResearchReports).toBe(0);

    const zip = zipFileFrom({
      concepts: [concept("legacy_zip")],
      contextCards: [],
      quizQuestions: [],
      quizDecks: []
    });
    const zipResult = await storage.importConceptBookPackage(zip, "merge");
    expect(zipResult.importedConcepts).toBe(1);
    expect(zipResult.importedResearchReports).toBe(0);
  });
});
