import { describe, expect, it } from "vitest";
import { createEmptyConceptInput, type Concept } from "../../types/concept";
import { QUIZ_ATTEMPT_LOG_SCHEMA_VERSION, type QuizAttemptLog } from "../../types/quiz";
import { DEFAULT_DATA_LAB_FILTERS, filterDataLabLogs, getDataLabLogConceptId, isDataLabFiltersDefault } from "./filterDataLabLogs";

const atLocal = (ymd: string, hours = 12, minutes = 0, seconds = 0, ms = 0): string => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d, hours, minutes, seconds, ms).toISOString();
};

const log = (overrides: Partial<QuizAttemptLog> = {}): QuizAttemptLog => ({
  id: "log-1",
  questionId: "q1",
  questionPromptSnapshot: "問い",
  selectedChoiceId: "c1",
  selectedChoiceTextSnapshot: "選択",
  correctChoiceId: "c2",
  correctChoiceTextSnapshot: "正解",
  correct: true,
  startedAt: atLocal("2026-08-15"),
  answeredAt: atLocal("2026-08-15"),
  timeMs: 10,
  schemaVersion: QUIZ_ATTEMPT_LOG_SCHEMA_VERSION,
  ...overrides
});

const concept = (overrides: Partial<Concept> = {}): Concept => ({
  ...createEmptyConceptInput(),
  id: "concept-a",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  title: "人工知能",
  domainTags: ["情報科学"],
  ...overrides
});

const ids = (rows: QuizAttemptLog[]): string[] => rows.map((row) => row.id);

describe("getDataLabLogConceptId", () => {
  it("conceptId を優先する", () => {
    expect(
      getDataLabLogConceptId(
        log({
          conceptId: "concept-a",
          questionConceptId: "concept-b",
          selectedLinkedConceptId: "concept-c"
        })
      )
    ).toBe("concept-a");
  });

  it("conceptId がない旧ログでは questionConceptId に fallback する", () => {
    expect(getDataLabLogConceptId(log({ questionConceptId: "concept-b" }))).toBe("concept-b");
  });

  it("selectedLinkedConceptId だけでは分析対象 Concept にしない", () => {
    expect(getDataLabLogConceptId(log({ selectedLinkedConceptId: "concept-c" }))).toBeNull();
  });
});

describe("filterDataLabLogs", () => {
  const conceptA = concept({ id: "concept-a", title: "人工知能", domainTags: ["情報科学", "哲学"] });
  const conceptB = concept({ id: "concept-b", title: "哲学", domainTags: ["哲学"] });
  const conceptC = concept({ id: "concept-c", title: "数学", domainTags: ["数学"] });
  const conceptById = new Map<string, Concept>([
    [conceptA.id, conceptA],
    [conceptB.id, conceptB],
    [conceptC.id, conceptC]
  ]);

  const logs: QuizAttemptLog[] = [
    log({
      id: "a-aug1-ok-d1",
      conceptId: "concept-a",
      deckId: "deck-1",
      correct: true,
      answeredAt: atLocal("2026-08-01", 0, 0, 0, 0)
    }),
    log({
      id: "b-aug15-ng-d2",
      conceptId: "concept-b",
      deckId: "deck-2",
      correct: false,
      answeredAt: atLocal("2026-08-15")
    }),
    log({
      id: "c-aug30-ok-free",
      conceptId: "concept-c",
      correct: true,
      answeredAt: atLocal("2026-08-30", 23, 59, 59, 999)
    }),
    log({
      id: "legacy-q-only",
      questionConceptId: "concept-a",
      selectedLinkedConceptId: "concept-b",
      correctLinkedConceptId: "concept-c",
      deckId: "deck-1",
      correct: false,
      answeredAt: atLocal("2026-08-10")
    }),
    log({
      id: "deleted-concept",
      conceptId: "gone-concept",
      deckId: "gone-deck",
      correct: true,
      answeredAt: atLocal("2026-08-12")
    })
  ];

  it("全条件未指定で全ログが返る", () => {
    expect(ids(filterDataLabLogs(logs, DEFAULT_DATA_LAB_FILTERS, conceptById))).toEqual(ids(logs));
  });

  it("開始日のみでフィルタする", () => {
    expect(
      ids(filterDataLabLogs(logs, { ...DEFAULT_DATA_LAB_FILTERS, dateFrom: "2026-08-15" }, conceptById))
    ).toEqual(["b-aug15-ng-d2", "c-aug30-ok-free"]);
  });

  it("終了日のみでフィルタする", () => {
    expect(
      ids(filterDataLabLogs(logs, { ...DEFAULT_DATA_LAB_FILTERS, dateTo: "2026-08-10" }, conceptById))
    ).toEqual(["a-aug1-ok-d1", "legacy-q-only"]);
  });

  it("開始日と終了日の両端を含む", () => {
    expect(
      ids(
        filterDataLabLogs(
          logs,
          { ...DEFAULT_DATA_LAB_FILTERS, dateFrom: "2026-08-01", dateTo: "2026-08-30" },
          conceptById
        )
      )
    ).toEqual(ids(logs));
  });

  it("Concept 1件指定で絞れる", () => {
    expect(
      ids(filterDataLabLogs(logs, { ...DEFAULT_DATA_LAB_FILTERS, conceptIds: ["concept-b"] }, conceptById))
    ).toEqual(["b-aug15-ng-d2"]);
  });

  it("Concept 複数選択は OR になる", () => {
    expect(
      ids(
        filterDataLabLogs(logs, { ...DEFAULT_DATA_LAB_FILTERS, conceptIds: ["concept-a", "concept-b"] }, conceptById)
      )
    ).toEqual(["a-aug1-ok-d1", "b-aug15-ng-d2", "legacy-q-only"]);
  });

  it("conceptId がない旧ログは questionConceptId で Concept 一致する", () => {
    expect(
      ids(filterDataLabLogs(logs, { ...DEFAULT_DATA_LAB_FILTERS, conceptIds: ["concept-a"] }, conceptById))
    ).toEqual(["a-aug1-ok-d1", "legacy-q-only"]);
  });

  it("selectedLinkedConceptId だけ一致するログを Concept 対象にしない", () => {
    const onlyLinked = log({
      id: "linked-only",
      selectedLinkedConceptId: "concept-a",
      answeredAt: atLocal("2026-08-20")
    });
    expect(
      ids(filterDataLabLogs([onlyLinked], { ...DEFAULT_DATA_LAB_FILTERS, conceptIds: ["concept-a"] }, conceptById))
    ).toEqual([]);
  });

  it("分野1件指定で絞れる", () => {
    expect(
      ids(filterDataLabLogs(logs, { ...DEFAULT_DATA_LAB_FILTERS, domainTags: ["数学"] }, conceptById))
    ).toEqual(["c-aug30-ok-free"]);
  });

  it("複数分野を持つ Concept を判定できる", () => {
    expect(
      ids(filterDataLabLogs(logs, { ...DEFAULT_DATA_LAB_FILTERS, domainTags: ["情報科学"] }, conceptById))
    ).toEqual(["a-aug1-ok-d1", "legacy-q-only"]);
  });

  it("分野複数選択は OR になる", () => {
    expect(
      ids(filterDataLabLogs(logs, { ...DEFAULT_DATA_LAB_FILTERS, domainTags: ["数学", "情報科学"] }, conceptById))
    ).toEqual(["a-aug1-ok-d1", "c-aug30-ok-free", "legacy-q-only"]);
  });

  it("削除済み Concept 参照でもクラッシュせず、フィルタ未指定なら残す", () => {
    expect(ids(filterDataLabLogs(logs, DEFAULT_DATA_LAB_FILTERS, conceptById))).toContain("deleted-concept");
  });

  it("Concept 不明時は分野フィルタに一致しない", () => {
    expect(
      ids(filterDataLabLogs(logs, { ...DEFAULT_DATA_LAB_FILTERS, domainTags: ["情報科学"] }, conceptById))
    ).not.toContain("deleted-concept");
  });

  it("Deck 1件指定で絞れる", () => {
    expect(
      ids(filterDataLabLogs(logs, { ...DEFAULT_DATA_LAB_FILTERS, deckIds: ["deck-2"] }, conceptById))
    ).toEqual(["b-aug15-ng-d2"]);
  });

  it("Deck 複数選択は OR になる", () => {
    expect(
      ids(filterDataLabLogs(logs, { ...DEFAULT_DATA_LAB_FILTERS, deckIds: ["deck-1", "deck-2"] }, conceptById))
    ).toEqual(["a-aug1-ok-d1", "b-aug15-ng-d2", "legacy-q-only"]);
  });

  it("deckId がない自由学習ログは Deck 条件中に一致しない", () => {
    expect(
      ids(filterDataLabLogs(logs, { ...DEFAULT_DATA_LAB_FILTERS, deckIds: ["deck-1"] }, conceptById))
    ).not.toContain("c-aug30-ok-free");
  });

  it("削除済み Deck ID を持つログでもクラッシュしない", () => {
    expect(
      ids(filterDataLabLogs(logs, { ...DEFAULT_DATA_LAB_FILTERS, deckIds: ["gone-deck"] }, conceptById))
    ).toEqual(["deleted-concept"]);
  });

  it("correctness all で全件", () => {
    expect(ids(filterDataLabLogs(logs, { ...DEFAULT_DATA_LAB_FILTERS, correctness: "all" }, conceptById))).toEqual(
      ids(logs)
    );
  });

  it("correct で正答のみ", () => {
    expect(
      ids(filterDataLabLogs(logs, { ...DEFAULT_DATA_LAB_FILTERS, correctness: "correct" }, conceptById))
    ).toEqual(["a-aug1-ok-d1", "c-aug30-ok-free", "deleted-concept"]);
  });

  it("incorrect で誤答のみ", () => {
    expect(
      ids(filterDataLabLogs(logs, { ...DEFAULT_DATA_LAB_FILTERS, correctness: "incorrect" }, conceptById))
    ).toEqual(["b-aug15-ng-d2", "legacy-q-only"]);
  });

  it("異なる種類の条件は AND、同一種類の複数値は OR になる", () => {
    expect(
      ids(
        filterDataLabLogs(
          logs,
          {
            dateFrom: "2026-08-01",
            dateTo: "2026-08-30",
            conceptIds: ["concept-a", "concept-b"],
            domainTags: ["情報科学", "哲学"],
            deckIds: ["deck-1", "deck-2"],
            correctness: "incorrect"
          },
          conceptById
        )
      )
    ).toEqual(["b-aug15-ng-d2", "legacy-q-only"]);
  });

  it("条件一致0件でもエラーにならない", () => {
    expect(
      ids(filterDataLabLogs(logs, { ...DEFAULT_DATA_LAB_FILTERS, conceptIds: ["missing"] }, conceptById))
    ).toEqual([]);
  });

  it("DEFAULT はリセット後の初期状態である", () => {
    expect(isDataLabFiltersDefault(DEFAULT_DATA_LAB_FILTERS)).toBe(true);
    expect(isDataLabFiltersDefault({ ...DEFAULT_DATA_LAB_FILTERS, correctness: "correct" })).toBe(false);
  });
});
