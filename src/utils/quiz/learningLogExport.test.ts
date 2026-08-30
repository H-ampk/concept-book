import { describe, expect, it } from "vitest";
import { QUIZ_ATTEMPT_LOG_SCHEMA_VERSION, type QuizAttemptLog } from "../../types/quiz";
import {
  LEARNING_LOG_CSV_COLUMNS,
  buildLearningLogCsv,
  escapeCsvCell,
  learningLogCsvFilename,
  learningLogToCsvRow
} from "./learningLogExport";

const baseLog = (overrides: Partial<QuizAttemptLog> = {}): QuizAttemptLog => ({
  id: "log_1",
  sessionId: "sess_1",
  conceptId: "concept_a",
  questionId: "q1",
  questionPromptSnapshot: "問い",
  questionConceptId: "concept_q",
  selectedChoiceId: "c1",
  selectedChoiceTextSnapshot: "選択",
  selectedLinkedConceptId: "concept_s",
  correctChoiceId: "c2",
  correctChoiceTextSnapshot: "正解",
  correctLinkedConceptId: "concept_c",
  correct: true,
  startedAt: "2026-01-01T00:00:00.000Z",
  answeredAt: "2026-01-01T00:00:01.500Z",
  timeMs: 1500,
  deckId: "deck_1",
  deckTitleSnapshot: "デッキA",
  schemaVersion: QUIZ_ATTEMPT_LOG_SCHEMA_VERSION,
  ...overrides
});

describe("escapeCsvCell", () => {
  it("カンマを含む値をダブルクォートで囲む", () => {
    expect(escapeCsvCell("a,b")).toBe('"a,b"');
  });

  it("ダブルクォートを二重化して囲む", () => {
    expect(escapeCsvCell('彼は"はい"と言った')).toBe('"彼は""はい""と言った"');
  });

  it("改行を含む値をダブルクォートで囲む", () => {
    expect(escapeCsvCell("一行目\n二行目")).toBe('"一行目\n二行目"');
  });
});

describe("buildLearningLogCsv", () => {
  it("通常ログからCSVを生成でき、ヘッダー順が期待どおりである", () => {
    const csv = buildLearningLogCsv([baseLog()], new Map([["concept_a", "概念A"]]));
    expect(csv.startsWith("\uFEFF")).toBe(true);
    const lines = csv.replace(/^\uFEFF/, "").trimEnd().split("\r\n");
    expect(lines[0]).toBe(LEARNING_LOG_CSV_COLUMNS.join(","));
    expect(lines[1]?.startsWith("log_1,sess_1,")).toBe(true);
  });

  it("日本語文字列を保持する", () => {
    const csv = buildLearningLogCsv(
      [baseLog({ questionPromptSnapshot: "心理学の定義は？" })],
      new Map()
    );
    expect(csv).toContain("心理学の定義は？");
  });

  it("カンマを含む問題文を正しくescapeする", () => {
    const csv = buildLearningLogCsv(
      [baseLog({ questionPromptSnapshot: "りんご,みかん" })],
      new Map()
    );
    expect(csv).toContain('"りんご,みかん"');
  });

  it("ダブルクォートを含む値を正しくescapeする", () => {
    const csv = buildLearningLogCsv(
      [baseLog({ selectedChoiceTextSnapshot: '答えは"これ"です' })],
      new Map()
    );
    expect(csv).toContain('"答えは""これ""です"');
  });

  it("改行を含む値を1レコードとして保持する", () => {
    const csv = buildLearningLogCsv(
      [baseLog({ questionPromptSnapshot: "第一段落\n第二段落" })],
      new Map()
    );
    const body = csv.replace(/^\uFEFF/, "");
    expect(body).toContain('"第一段落\n第二段落"');
    expect(body.trimEnd().split("\r\n")).toHaveLength(2);
  });

  it("optionalフィールドがundefinedでも壊れない", () => {
    const csv = buildLearningLogCsv(
      [
        baseLog({
          sessionId: undefined,
          conceptId: undefined,
          questionConceptId: undefined,
          selectedLinkedConceptId: undefined,
          correctLinkedConceptId: undefined,
          deckId: undefined,
          deckTitleSnapshot: undefined
        })
      ],
      new Map()
    );
    const dataLine = csv.replace(/^\uFEFF/, "").trimEnd().split("\r\n")[1] ?? "";
    const cells = dataLine.split(",");
    expect(cells[0]).toBe("log_1");
    expect(cells[1]).toBe("");
    expect(cells).toHaveLength(LEARNING_LOG_CSV_COLUMNS.length);
  });

  it("Concept名をMapから補助列へ追加できる", () => {
    const row = learningLogToCsvRow(
      baseLog(),
      new Map([
        ["concept_a", "出題概念"],
        ["concept_q", "問題概念"],
        ["concept_s", "選択概念"],
        ["concept_c", "正解概念"]
      ])
    );
    expect(row.conceptTitleCurrent).toBe("出題概念");
    expect(row.questionConceptTitleCurrent).toBe("問題概念");
    expect(row.selectedLinkedConceptTitleCurrent).toBe("選択概念");
    expect(row.correctLinkedConceptTitleCurrent).toBe("正解概念");
  });

  it("削除済みConceptではIDを残しタイトルを空にする", () => {
    const row = learningLogToCsvRow(baseLog({ conceptId: "deleted_id" }), new Map());
    expect(row.conceptId).toBe("deleted_id");
    expect(row.conceptTitleCurrent).toBe("");
  });

  it("timeSecondsがtimeMsから正しく生成される", () => {
    expect(learningLogToCsvRow(baseLog({ timeMs: 1500 }), new Map()).timeSeconds).toBe(1.5);
    expect(learningLogToCsvRow(baseLog({ timeMs: 0 }), new Map()).timeSeconds).toBe(0);
  });
});

describe("learningLogCsvFilename", () => {
  it("実行日のローカル日付をファイル名に含める", () => {
    const now = new Date(2026, 7, 23, 21, 0, 0);
    expect(learningLogCsvFilename(now)).toBe("conceptbook-learning-logs-2026-08-23.csv");
  });
});
