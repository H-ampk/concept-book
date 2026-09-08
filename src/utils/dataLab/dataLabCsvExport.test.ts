import { describe, expect, it } from "vitest";
import { createEmptyConceptInput, type Concept } from "../../types/concept";
import { QUIZ_ATTEMPT_LOG_SCHEMA_VERSION, type QuizAttemptLog, type QuizDeck } from "../../types/quiz";
import { UTF8_BOM } from "../csv";
import type { DataLabAggregateRow, DataLabGroupBy } from "./aggregateDataLabLogs";
import {
  DATA_LAB_AGGREGATE_CSV_COLUMNS,
  DATA_LAB_LOG_CSV_COLUMNS,
  buildDataLabAggregateCsv,
  buildDataLabLogCsv,
  dataLabAggregateCsvFilename,
  dataLabLogCsvFilename
} from "./dataLabCsvExport";

const log = (overrides: Partial<QuizAttemptLog> = {}): QuizAttemptLog => ({
  id: "log-1",
  questionId: "q1",
  questionPromptSnapshot: "問い",
  selectedChoiceId: "c1",
  selectedChoiceTextSnapshot: "選択",
  correctChoiceId: "c2",
  correctChoiceTextSnapshot: "正解",
  correct: true,
  startedAt: "2026-08-15T03:00:00.000Z",
  answeredAt: "2026-08-15T03:00:01.000Z",
  timeMs: 4200,
  schemaVersion: QUIZ_ATTEMPT_LOG_SCHEMA_VERSION,
  conceptId: "concept-a",
  deckId: "deck-1",
  deckTitleSnapshot: "旧デッキ",
  ...overrides
});

const concept = (overrides: Partial<Concept> = {}): Concept => ({
  ...createEmptyConceptInput(),
  id: "concept-a",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  title: "人工知能",
  domainTags: ["人工知能", "哲学", "HCI"],
  ...overrides
});

const deck = (overrides: Partial<QuizDeck> = {}): QuizDeck => ({
  id: "deck-1",
  title: "AI基礎",
  questionIds: [],
  visibility: "private",
  schemaVersion: 1,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides
});

const parseCsv = (csv: string): string[] => csv.replace(/^\uFEFF/, "").trimEnd().split("\r\n");

const aggregateRow = (
  groupBy: DataLabGroupBy,
  overrides: Partial<DataLabAggregateRow> = {}
): DataLabAggregateRow => ({
  groupBy,
  key: "k1",
  label: "ラベル",
  attemptCount: 10,
  correctCount: 7,
  incorrectCount: 3,
  accuracy: 0.123456,
  averageResponseTimeMs: 4321.5,
  firstAttemptAt: "2026-08-01T00:00:00.000Z",
  lastAttemptAt: "2026-08-15T00:00:00.000Z",
  ...overrides
});

describe("buildDataLabLogCsv", () => {
  it("渡したログだけを出力し、BOM とヘッダーを付ける", () => {
    const csv = buildDataLabLogCsv(
      [log({ id: "only-this" }), log({ id: "second", conceptId: "concept-a" })],
      new Map([["concept-a", concept()]]),
      new Map([["deck-1", deck()]])
    );
    expect(csv.startsWith(UTF8_BOM)).toBe(true);
    const lines = parseCsv(csv);
    expect(lines[0]).toBe(DATA_LAB_LOG_CSV_COLUMNS.join(","));
    expect(lines).toHaveLength(3);
    expect(lines[1]?.startsWith("only-this,")).toBe(true);
    expect(lines[2]?.startsWith("second,")).toBe(true);
  });

  it("0件でも例外にならずヘッダーのみを返す", () => {
    const csv = buildDataLabLogCsv([], new Map(), new Map());
    expect(parseCsv(csv)).toEqual([DATA_LAB_LOG_CSV_COLUMNS.join(",")]);
  });

  it("Concept ID / 名前、Deck ID / 名前、正答 boolean、回答時間 ms、日時をそのまま出す", () => {
    const csv = buildDataLabLogCsv(
      [log({ correct: false, timeMs: 1500, answeredAt: "2026-09-07T12:34:56.000Z" })],
      new Map([["concept-a", concept()]]),
      new Map([["deck-1", deck()]])
    );
    const data = parseCsv(csv)[1] ?? "";
    expect(data).toContain("concept-a");
    expect(data).toContain("人工知能");
    expect(data).toContain("deck-1");
    expect(data).toContain("AI基礎");
    expect(data).toContain("false");
    expect(data).not.toContain("誤答");
    expect(data).toContain("1500");
    expect(data).not.toContain("1.5秒");
    expect(data).toContain("2026-09-07T12:34:56.000Z");
    expect(data).not.toContain("2026/09/07");
  });

  it("複数 domainTags を | 区切りの1セルに入れる", () => {
    const csv = buildDataLabLogCsv(
      [log()],
      new Map([["concept-a", concept()]]),
      new Map([["deck-1", deck()]])
    );
    expect(csv).toContain("人工知能|哲学|HCI");
  });

  it("削除済み Concept でも失敗せず ID を残す", () => {
    const csv = buildDataLabLogCsv(
      [log({ conceptId: "gone-concept" })],
      new Map(),
      new Map([["deck-1", deck()]])
    );
    const data = parseCsv(csv)[1] ?? "";
    expect(data).toContain("gone-concept");
    expect(data).toContain("削除済みConcept");
  });

  it("questionConceptId だけでも Concept ID を解決する", () => {
    const csv = buildDataLabLogCsv(
      [log({ conceptId: undefined, questionConceptId: "concept-from-q" })],
      new Map([["concept-from-q", concept({ id: "concept-from-q", title: "旧出題" })]]),
      new Map()
    );
    const data = parseCsv(csv)[1] ?? "";
    expect(data).toContain("concept-from-q");
    expect(data).toContain("旧出題");
  });

  it("削除済み Deck は snapshot を使い、ID を失わない", () => {
    const csv = buildDataLabLogCsv(
      [log({ deckId: "gone-deck", deckTitleSnapshot: "心理学セット" })],
      new Map([["concept-a", concept()]]),
      new Map()
    );
    const data = parseCsv(csv)[1] ?? "";
    expect(data).toContain("gone-deck");
    expect(data).toContain("心理学セット（削除済み）");
  });

  it("snapshot もない削除済み Deck は削除済みDeck とする", () => {
    const csv = buildDataLabLogCsv(
      [log({ deckId: "gone-deck", deckTitleSnapshot: undefined })],
      new Map([["concept-a", concept()]]),
      new Map()
    );
    expect(parseCsv(csv)[1]).toContain("削除済みDeck");
  });

  it("自由学習は deckId 空・deckName 自由学習", () => {
    const csv = buildDataLabLogCsv(
      [log({ deckId: undefined, deckTitleSnapshot: undefined })],
      new Map([["concept-a", concept()]]),
      new Map()
    );
    const cells = (parseCsv(csv)[1] ?? "").split(",");
    const deckIdIndex = DATA_LAB_LOG_CSV_COLUMNS.indexOf("deckId");
    const deckNameIndex = DATA_LAB_LOG_CSV_COLUMNS.indexOf("deckName");
    expect(cells[deckIdIndex]).toBe("");
    expect(cells[deckNameIndex]).toBe("自由学習");
  });

  it("カンマ・引用符・改行・日本語・絵文字をエスケープする", () => {
    const csv = buildDataLabLogCsv(
      [log()],
      new Map([
        [
          "concept-a",
          concept({
            title: '彼は "AI" と言った',
            domainTags: ["AI, HCI", "1行目\n2行目", "観測🔭"]
          })
        ]
      ]),
      new Map([["deck-1", deck({ title: "日本語デッキ" })]])
    );
    expect(csv).toContain('"彼は ""AI"" と言った"');
    expect(csv).toContain('"AI, HCI|1行目\n2行目|観測🔭"');
    expect(csv).toContain("日本語デッキ");
  });
});

describe("buildDataLabAggregateCsv", () => {
  const groupBys: DataLabGroupBy[] = ["concept", "domain", "deck", "day", "week", "month"];

  it.each(groupBys)("%s の aggregatedRows を CSV 化できる", (groupBy) => {
    const csv = buildDataLabAggregateCsv([
      aggregateRow(groupBy, {
        key: `${groupBy}-key`,
        label: `${groupBy}-label`,
        conceptId: groupBy === "concept" ? "c1" : null,
        domainTag: groupBy === "domain" ? "哲学" : null,
        deckId: groupBy === "deck" ? "d1" : null,
        periodStart: groupBy === "day" || groupBy === "week" || groupBy === "month" ? "2026-09-01" : null,
        periodEnd: groupBy === "day" || groupBy === "week" || groupBy === "month" ? "2026-09-07" : null
      })
    ]);
    expect(csv.startsWith(UTF8_BOM)).toBe(true);
    const lines = parseCsv(csv);
    expect(lines[0]).toBe(DATA_LAB_AGGREGATE_CSV_COLUMNS.join(","));
    expect(lines[1]).toContain(groupBy);
    expect(lines[1]).toContain(`${groupBy}-key`);
    expect(lines[1]).toContain(`${groupBy}-label`);
  });

  it("accuracy と averageResponseTimeMs を aggregatedRows の値のまま出す（再計算しない）", () => {
    const csv = buildDataLabAggregateCsv([
      aggregateRow("concept", {
        attemptCount: 100,
        correctCount: 1,
        incorrectCount: 99,
        accuracy: 0.123456,
        averageResponseTimeMs: 4321.5
      })
    ]);
    const data = parseCsv(csv)[1] ?? "";
    expect(data).toContain("0.123456");
    expect(data).toContain("4321.5");
    expect(data).not.toContain("12.3%");
    expect(data).not.toContain("4.3秒");
  });

  it("masteryProbability を生の 0〜1 で出し、百分率文字列や 0 埋めをしない", () => {
    const withValue = buildDataLabAggregateCsv([
      aggregateRow("concept", { masteryProbability: 0.821, accuracy: 0.5 })
    ]);
    const withNull = buildDataLabAggregateCsv([
      aggregateRow("concept", { masteryProbability: null, accuracy: 0.5 })
    ]);
    expect(parseCsv(withValue)[1]).toContain("0.821");
    expect(parseCsv(withValue)[1]).not.toContain("82%");
    const masteryIndex = DATA_LAB_AGGREGATE_CSV_COLUMNS.indexOf("masteryProbability");
    expect(masteryIndex).toBeGreaterThan(-1);
    expect((parseCsv(withNull)[1] ?? "").split(",")[masteryIndex]).toBe("");
  });

  it("null の accuracy / 平均時間を空セルにし、0 や null 文字列にしない", () => {
    const csv = buildDataLabAggregateCsv([
      aggregateRow("domain", {
        accuracy: null,
        averageResponseTimeMs: null,
        firstAttemptAt: null,
        lastAttemptAt: null,
        conceptId: null,
        domainTag: undefined,
        deckId: null,
        periodStart: null,
        periodEnd: undefined
      })
    ]);
    const data = parseCsv(csv)[1] ?? "";
    expect(data).not.toContain("null");
    expect(data).not.toContain("undefined");
    const accuracyIndex = DATA_LAB_AGGREGATE_CSV_COLUMNS.indexOf("accuracy");
    const avgIndex = DATA_LAB_AGGREGATE_CSV_COLUMNS.indexOf("averageResponseTimeMs");
    const cells = data.split(",");
    expect(cells[accuracyIndex]).toBe("");
    expect(cells[avgIndex]).toBe("");
  });

  it("0件でも例外にならない", () => {
    expect(parseCsv(buildDataLabAggregateCsv([]))[0]).toBe(DATA_LAB_AGGREGATE_CSV_COLUMNS.join(","));
  });
});

describe("Data Lab CSV ファイル名", () => {
  const now = new Date(2026, 8, 7, 12, 0, 0);

  it("フィルタ済みログは conceptbook-datalab-logs-YYYY-MM-DD.csv", () => {
    expect(dataLabLogCsvFilename(now)).toBe("conceptbook-datalab-logs-2026-09-07.csv");
  });

  it.each(["concept", "domain", "deck", "day", "week", "month"] as const)(
    "集計結果は conceptbook-datalab-%s-YYYY-MM-DD.csv",
    (groupBy) => {
      expect(dataLabAggregateCsvFilename(groupBy, now)).toBe(
        `conceptbook-datalab-${groupBy}-2026-09-07.csv`
      );
    }
  );
});
