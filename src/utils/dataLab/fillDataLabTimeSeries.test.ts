import { describe, expect, it } from "vitest";
import type { DataLabAggregateRow } from "./aggregateDataLabLogs";
import { fillDataLabTimeSeries } from "./fillDataLabTimeSeries";

const dayRow = (ymd: string, overrides: Partial<DataLabAggregateRow> = {}): DataLabAggregateRow => ({
  groupBy: "day",
  key: ymd,
  label: ymd,
  attemptCount: 5,
  correctCount: 4,
  incorrectCount: 1,
  accuracy: 0.8,
  masteryProbability: null,
  averageResponseTimeMs: 1200,
  firstAttemptAt: "2026-09-01T01:00:00.000Z",
  lastAttemptAt: "2026-09-01T02:00:00.000Z",
  periodStart: ymd,
  periodEnd: ymd,
  ...overrides
});

const weekRow = (
  key: string,
  periodStart: string,
  periodEnd: string,
  overrides: Partial<DataLabAggregateRow> = {}
): DataLabAggregateRow => ({
  groupBy: "week",
  key,
  label: `${periodStart} ～ ${periodEnd}`,
  attemptCount: 3,
  correctCount: 2,
  incorrectCount: 1,
  accuracy: 2 / 3,
  masteryProbability: null,
  averageResponseTimeMs: 900,
  firstAttemptAt: "2026-08-24T01:00:00.000Z",
  lastAttemptAt: "2026-08-24T02:00:00.000Z",
  periodStart,
  periodEnd,
  ...overrides
});

const monthRow = (ym: string, periodEnd: string, overrides: Partial<DataLabAggregateRow> = {}): DataLabAggregateRow => ({
  groupBy: "month",
  key: ym,
  label: ym,
  attemptCount: 8,
  correctCount: 6,
  incorrectCount: 2,
  accuracy: 0.75,
  masteryProbability: null,
  averageResponseTimeMs: 800,
  firstAttemptAt: "2026-11-01T01:00:00.000Z",
  lastAttemptAt: "2026-11-02T01:00:00.000Z",
  periodStart: `${ym}-01`,
  periodEnd,
  ...overrides
});

const expectEmptyPeriod = (row: DataLabAggregateRow | undefined) => {
  expect(row).toBeDefined();
  expect(row?.attemptCount).toBe(0);
  expect(row?.correctCount).toBe(0);
  expect(row?.incorrectCount).toBe(0);
  expect(row?.accuracy).toBeNull();
  expect(row?.averageResponseTimeMs).toBeNull();
  expect(row?.firstAttemptAt).toBeNull();
  expect(row?.lastAttemptAt).toBeNull();
};

describe("fillDataLabTimeSeries 日", () => {
  it("連続した日なら追加補完されない", () => {
    const rows = [dayRow("2026-09-01"), dayRow("2026-09-02"), dayRow("2026-09-03")];
    const filled = fillDataLabTimeSeries(rows, { groupBy: "day" });
    expect(filled.map((row) => row.key)).toEqual(["2026-09-01", "2026-09-02", "2026-09-03"]);
  });

  it("1日抜けている場合、その日が追加される", () => {
    const filled = fillDataLabTimeSeries([dayRow("2026-09-01"), dayRow("2026-09-03")], { groupBy: "day" });
    expect(filled.map((row) => row.key)).toEqual(["2026-09-01", "2026-09-02", "2026-09-03"]);
    expectEmptyPeriod(filled[1]);
  });

  it("複数日抜けている場合、すべて追加される", () => {
    const filled = fillDataLabTimeSeries([dayRow("2026-09-01"), dayRow("2026-09-05")], { groupBy: "day" });
    expect(filled.map((row) => row.key)).toEqual([
      "2026-09-01",
      "2026-09-02",
      "2026-09-03",
      "2026-09-04",
      "2026-09-05"
    ]);
  });

  it("年末年始をまたいで補完できる", () => {
    const filled = fillDataLabTimeSeries([dayRow("2026-12-31"), dayRow("2027-01-02")], { groupBy: "day" });
    expect(filled.map((row) => row.key)).toEqual(["2026-12-31", "2027-01-01", "2027-01-02"]);
  });

  it("月末をまたいで補完できる", () => {
    const filled = fillDataLabTimeSeries([dayRow("2026-01-31"), dayRow("2026-02-02")], { groupBy: "day" });
    expect(filled.map((row) => row.key)).toEqual(["2026-01-31", "2026-02-01", "2026-02-02"]);
  });
});

describe("fillDataLabTimeSeries 週", () => {
  it("1週抜けている場合に補完でき、月曜日開始を維持する", () => {
    const filled = fillDataLabTimeSeries(
      [
        weekRow("2026-W35", "2026-08-24", "2026-08-30"),
        weekRow("2026-W37", "2026-09-07", "2026-09-13")
      ],
      { groupBy: "week" }
    );
    expect(filled.map((row) => row.key)).toEqual(["2026-W35", "2026-W36", "2026-W37"]);
    expect(filled[1]?.periodStart).toBe("2026-08-31");
    expect(filled[1]?.periodEnd).toBe("2026-09-06");
    expect(filled[1]?.label).toBe("2026-08-31 ～ 2026-09-06");
    expectEmptyPeriod(filled[1]);
  });

  it("年末年始の ISO week-year を壊さない", () => {
    const filled = fillDataLabTimeSeries(
      [
        weekRow("2020-W53", "2020-12-28", "2021-01-03"),
        weekRow("2021-W02", "2021-01-11", "2021-01-17")
      ],
      { groupBy: "week" }
    );
    expect(filled.map((row) => row.key)).toEqual(["2020-W53", "2021-W01", "2021-W02"]);
    expect(filled[1]?.periodStart).toBe("2021-01-04");
    expect(filled[1]?.periodEnd).toBe("2021-01-10");
  });
});

describe("fillDataLabTimeSeries 月", () => {
  it("1か月抜けている場合に補完できる", () => {
    const filled = fillDataLabTimeSeries(
      [monthRow("2026-01", "2026-01-31"), monthRow("2026-03", "2026-03-31")],
      { groupBy: "month" }
    );
    expect(filled.map((row) => row.key)).toEqual(["2026-01", "2026-02", "2026-03"]);
    expect(filled[1]?.periodStart).toBe("2026-02-01");
    expect(filled[1]?.periodEnd).toBe("2026-02-28");
    expectEmptyPeriod(filled[1]);
  });

  it("年をまたいで補完できる", () => {
    const filled = fillDataLabTimeSeries(
      [monthRow("2026-11", "2026-11-30"), monthRow("2027-01", "2027-01-31")],
      { groupBy: "month" }
    );
    expect(filled.map((row) => row.key)).toEqual(["2026-11", "2026-12", "2027-01"]);
  });
});

describe("fillDataLabTimeSeries 実データを壊さない", () => {
  it("既存行の値を変更せず、重複生成せず、時系列順を維持する", () => {
    const original = dayRow("2026-09-01", { attemptCount: 5, accuracy: 0.8 });
    const later = dayRow("2026-09-03", { attemptCount: 4, accuracy: 0.75 });
    const filled = fillDataLabTimeSeries([original, later], { groupBy: "day" });
    expect(filled[0]).toBe(original);
    expect(filled[2]).toBe(later);
    expect(filled.filter((row) => row.key === "2026-09-01")).toHaveLength(1);
    expect(filled.map((row) => row.key)).toEqual(["2026-09-01", "2026-09-02", "2026-09-03"]);
  });

  it("Concept / 分野 / Deck には適用しない", () => {
    const conceptRow = { ...dayRow("2026-09-01"), groupBy: "concept" as const, key: "c1", label: "A" };
    expect(fillDataLabTimeSeries([conceptRow], { groupBy: "concept" })).toEqual([conceptRow]);
  });
});

describe("fillDataLabTimeSeries 期間指定", () => {
  it("開始日・終了日指定時、その期間全体を補完できる", () => {
    const filled = fillDataLabTimeSeries([dayRow("2026-09-03")], {
      groupBy: "day",
      dateFrom: "2026-09-01",
      dateTo: "2026-09-07"
    });
    expect(filled.map((row) => row.key)).toEqual([
      "2026-09-01",
      "2026-09-02",
      "2026-09-03",
      "2026-09-04",
      "2026-09-05",
      "2026-09-06",
      "2026-09-07"
    ]);
  });

  it("期間未指定時、最初〜最後のログの範囲だけ補完する", () => {
    const filled = fillDataLabTimeSeries([dayRow("2026-08-01"), dayRow("2026-08-03")], { groupBy: "day" });
    expect(filled.map((row) => row.key)).toEqual(["2026-08-01", "2026-08-02", "2026-08-03"]);
    expect(filled.some((row) => row.key === "2026-08-04")).toBe(false);
  });

  it("開始日のみ指定時は指定日〜最後のログまで補完する", () => {
    const filled = fillDataLabTimeSeries([dayRow("2026-09-08")], {
      groupBy: "day",
      dateFrom: "2026-09-01"
    });
    expect(filled[0]?.key).toBe("2026-09-01");
    expect(filled.at(-1)?.key).toBe("2026-09-08");
    expect(filled).toHaveLength(8);
  });

  it("終了日のみ指定時は最初のログ〜指定日まで補完する", () => {
    const filled = fillDataLabTimeSeries([dayRow("2026-09-01")], {
      groupBy: "day",
      dateTo: "2026-09-04"
    });
    expect(filled.map((row) => row.key)).toEqual([
      "2026-09-01",
      "2026-09-02",
      "2026-09-03",
      "2026-09-04"
    ]);
  });
});

describe("fillDataLabTimeSeries フィルタ結果のみを見る", () => {
  it("渡された集計行の範囲だけを元に補完し、フィルタ対象外の日付を復活させない", () => {
    const psychologyOnly = [dayRow("2026-09-01"), dayRow("2026-09-03")];
    const filled = fillDataLabTimeSeries(psychologyOnly, { groupBy: "day" });
    expect(filled.map((row) => row.key)).toEqual(["2026-09-01", "2026-09-02", "2026-09-03"]);
    expect(filled.some((row) => row.key === "2026-08-31")).toBe(false);
  });

  it("正誤フィルタ後の集計（誤答のみの日だけ）を、他日の正答で復活させない", () => {
    const incorrectOnlyDays = [dayRow("2026-09-01", { attemptCount: 2, correctCount: 0, accuracy: 0 })];
    const filled = fillDataLabTimeSeries(incorrectOnlyDays, {
      groupBy: "day",
      dateFrom: "2026-09-01",
      dateTo: "2026-09-03"
    });
    expect(filled[0]?.attemptCount).toBe(2);
    expectEmptyPeriod(filled[1]);
    expectEmptyPeriod(filled[2]);
  });
});
