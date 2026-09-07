import { describe, expect, it } from "vitest";
import type { DataLabAggregateRow } from "./aggregateDataLabLogs";
import { sortDataLabTableRows } from "./sortDataLabTableRows";

const row = (overrides: Partial<DataLabAggregateRow> & Pick<DataLabAggregateRow, "key" | "label">): DataLabAggregateRow => ({
  groupBy: "concept",
  attemptCount: 1,
  correctCount: 1,
  incorrectCount: 0,
  accuracy: 1,
  averageResponseTimeMs: 1000,
  firstAttemptAt: "2026-01-01T00:00:00.000Z",
  lastAttemptAt: "2026-01-01T00:00:00.000Z",
  ...overrides
});

describe("sortDataLabTableRows", () => {
  const rows = [
    row({
      key: "a",
      label: "ベータ",
      attemptCount: 2,
      correctCount: 1,
      incorrectCount: 1,
      accuracy: 0.5,
      averageResponseTimeMs: 3000,
      lastAttemptAt: "2026-01-02T00:00:00.000Z"
    }),
    row({
      key: "b",
      label: "アルファ",
      attemptCount: 9,
      correctCount: 9,
      incorrectCount: 0,
      accuracy: 1,
      averageResponseTimeMs: 1000,
      lastAttemptAt: "2026-01-01T00:00:00.000Z"
    }),
    row({
      key: "c",
      label: "ガンマ",
      attemptCount: 2,
      correctCount: 0,
      incorrectCount: 2,
      accuracy: null,
      averageResponseTimeMs: null,
      lastAttemptAt: null
    })
  ];

  it("未ソート時は元配列順を維持する", () => {
    const sorted = sortDataLabTableRows(rows, { key: null, direction: "asc" });
    expect(sorted.map((item) => item.key)).toEqual(["a", "b", "c"]);
    expect(sorted).toBe(rows);
  });

  it("回答数を数値としてソートする", () => {
    const sorted = sortDataLabTableRows(rows, { key: "attemptCount", direction: "asc" });
    expect(sorted.map((item) => item.key)).toEqual(["a", "c", "b"]);
  });

  it("正答率を数値としてソートし、null は最後にする", () => {
    const asc = sortDataLabTableRows(rows, { key: "accuracy", direction: "asc" });
    expect(asc.map((item) => item.key)).toEqual(["a", "b", "c"]);
    const desc = sortDataLabTableRows(rows, { key: "accuracy", direction: "desc" });
    expect(desc.map((item) => item.key)).toEqual(["b", "a", "c"]);
  });

  it("平均回答時間を数値としてソートし、null は最後にする", () => {
    const desc = sortDataLabTableRows(rows, { key: "averageResponseTimeMs", direction: "desc" });
    expect(desc.map((item) => item.key)).toEqual(["a", "b", "c"]);
  });

  it("日時を日時値としてソートし、null は最後にする", () => {
    const desc = sortDataLabTableRows(rows, { key: "lastAttemptAt", direction: "desc" });
    expect(desc.map((item) => item.key)).toEqual(["a", "b", "c"]);
  });

  it("label を文字列としてソートする", () => {
    const sorted = sortDataLabTableRows(rows, { key: "label", direction: "asc" });
    expect(sorted.map((item) => item.label)).toEqual(["アルファ", "ガンマ", "ベータ"]);
  });

  it("同値は元の index で安定させる", () => {
    const same = [
      row({ key: "first", label: "同じ", attemptCount: 2 }),
      row({ key: "second", label: "同じ", attemptCount: 2 })
    ];
    const asc = sortDataLabTableRows(same, { key: "attemptCount", direction: "asc" });
    const desc = sortDataLabTableRows(same, { key: "attemptCount", direction: "desc" });
    expect(asc.map((item) => item.key)).toEqual(["first", "second"]);
    expect(desc.map((item) => item.key)).toEqual(["first", "second"]);
  });
});
