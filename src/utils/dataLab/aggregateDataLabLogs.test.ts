import { describe, expect, it } from "vitest";
import { createEmptyConceptInput, type Concept } from "../../types/concept";
import { QUIZ_ATTEMPT_LOG_SCHEMA_VERSION, QUIZ_DECK_SCHEMA_VERSION, type QuizAttemptLog, type QuizDeck } from "../../types/quiz";
import { getDataLabLogConceptId } from "./filterDataLabLogs";
import {
  aggregateDataLabLogs,
  DATA_LAB_CONCEPT_NONE_KEY,
  DATA_LAB_DOMAIN_NONE_KEY
} from "./aggregateDataLabLogs";
import { QUIZ_DECK_BUCKET_FREE } from "../quizStats";

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
  timeMs: 1000,
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

const deck = (overrides: Partial<QuizDeck> = {}): QuizDeck => ({
  id: "deck-1",
  title: "AI基礎",
  questionIds: [],
  visibility: "private",
  schemaVersion: QUIZ_DECK_SCHEMA_VERSION,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides
});

const emptyMaps = () => ({
  conceptById: new Map<string, Concept>(),
  deckById: new Map<string, QuizDeck>()
});

const aggregate = (
  logs: QuizAttemptLog[],
  groupBy: Parameters<typeof aggregateDataLabLogs>[0]["groupBy"],
  maps: { conceptById?: Map<string, Concept>; deckById?: Map<string, QuizDeck> } = {}
) =>
  aggregateDataLabLogs({
    logs,
    groupBy,
    conceptById: maps.conceptById ?? new Map(),
    deckById: maps.deckById ?? new Map()
  });

describe("aggregateDataLabLogs 基本指標", () => {
  it("回答数・正答数・誤答数・正答率を算出する", () => {
    const logs = [
      log({ id: "1", conceptId: "c", correct: true, timeMs: 1000 }),
      log({ id: "2", conceptId: "c", correct: true, timeMs: 2000 }),
      log({ id: "3", conceptId: "c", correct: false, timeMs: 3000 })
    ];
    const rows = aggregate(logs, "concept", {
      conceptById: new Map([["c", concept({ id: "c", title: "C" })]])
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].attemptCount).toBe(3);
    expect(rows[0].correctCount).toBe(2);
    expect(rows[0].incorrectCount).toBe(1);
    expect(rows[0].accuracy).toBeCloseTo(2 / 3);
  });

  it("平均回答時間は有効な timeMs のみで計算し、0・負・NaN・Infinity を含めない", () => {
    const logs = [
      log({ id: "ok1", conceptId: "c", timeMs: 1000, correct: true }),
      log({ id: "ok2", conceptId: "c", timeMs: 3000, correct: true }),
      log({ id: "zero", conceptId: "c", timeMs: 0, correct: true }),
      log({ id: "neg", conceptId: "c", timeMs: -10, correct: true }),
      log({ id: "nan", conceptId: "c", timeMs: Number.NaN, correct: true }),
      log({ id: "inf", conceptId: "c", timeMs: Number.POSITIVE_INFINITY, correct: true })
    ];
    const [row] = aggregate(logs, "concept", {
      conceptById: new Map([["c", concept({ id: "c" })]])
    });
    expect(row.averageResponseTimeMs).toBe(2000);
    expect(row.attemptCount).toBe(6);
  });

  it("有効な回答時間が0件なら averageResponseTimeMs は null", () => {
    const [row] = aggregate([log({ conceptId: "c", timeMs: 0 })], "concept", {
      conceptById: new Map([["c", concept({ id: "c" })]])
    });
    expect(row.averageResponseTimeMs).toBeNull();
  });

  it("firstAttemptAt / lastAttemptAt は解析可能な answeredAt の最古・最新", () => {
    const first = atLocal("2026-08-01", 10);
    const last = atLocal("2026-08-20", 18);
    const logs = [
      log({ id: "mid", conceptId: "c", answeredAt: atLocal("2026-08-10") }),
      log({ id: "last", conceptId: "c", answeredAt: last }),
      log({ id: "first", conceptId: "c", answeredAt: first })
    ];
    const [row] = aggregate(logs, "concept", {
      conceptById: new Map([["c", concept({ id: "c" })]])
    });
    expect(row.firstAttemptAt).toBe(first);
    expect(row.lastAttemptAt).toBe(last);
  });
});

describe("aggregateDataLabLogs Concept", () => {
  it("Concept ID ごとに集計し、現在の title を表示する", () => {
    const conceptById = new Map([
      ["a", concept({ id: "a", title: "人工知能" })],
      ["b", concept({ id: "b", title: "哲学" })]
    ]);
    const rows = aggregate(
      [log({ id: "1", conceptId: "a" }), log({ id: "2", conceptId: "a" }), log({ id: "3", conceptId: "b" })],
      "concept",
      { conceptById }
    );
    expect(rows.map((row) => row.key)).toEqual(["a", "b"]);
    expect(rows.find((row) => row.key === "a")?.label).toBe("人工知能");
    expect(rows.find((row) => row.key === "a")?.attemptCount).toBe(2);
    expect(rows.find((row) => row.key === "b")?.attemptCount).toBe(1);
  });

  it("削除済み Concept でもクラッシュせず、元 ID をキーに残す", () => {
    const rows = aggregate([log({ conceptId: "gone" })], "concept", emptyMaps());
    expect(rows).toHaveLength(1);
    expect(rows[0].key).toBe("gone");
    expect(rows[0].label).toBe("削除済みConcept");
    expect(rows[0].conceptId).toBe("gone");
  });

  it("Concept ID なしは安定 sentinel の Conceptなし へまとめる", () => {
    const rows = aggregate([log({ id: "1" }), log({ id: "2" })], "concept", emptyMaps());
    expect(rows).toHaveLength(1);
    expect(rows[0].key).toBe(DATA_LAB_CONCEPT_NONE_KEY);
    expect(rows[0].key).not.toBe("");
    expect(rows[0].label).toBe("Conceptなし");
    expect(rows[0].attemptCount).toBe(2);
  });

  it("conceptId と questionConceptId が異なる場合、#90 と同じ帰属（conceptId 優先）になる", () => {
    const mixed = log({
      conceptId: "concept-a",
      questionConceptId: "concept-b"
    });
    expect(getDataLabLogConceptId(mixed)).toBe("concept-a");
    const conceptById = new Map([
      ["concept-a", concept({ id: "concept-a", title: "A" })],
      ["concept-b", concept({ id: "concept-b", title: "B" })]
    ]);
    const rows = aggregate([mixed], "concept", { conceptById });
    expect(rows).toHaveLength(1);
    expect(rows[0].key).toBe("concept-a");
    expect(rows[0].label).toBe("A");
  });
});

describe("aggregateDataLabLogs 分野", () => {
  it("複数分野 Concept の1ログを各分野へ1回ずつ計上する", () => {
    const conceptById = new Map([
      ["a", concept({ id: "a", domainTags: ["情報科学", "哲学"] })]
    ]);
    const rows = aggregate([log({ conceptId: "a" })], "domain", { conceptById });
    expect(rows.map((row) => row.key).sort()).toEqual(["哲学", "情報科学"]);
    expect(rows.every((row) => row.attemptCount === 1)).toBe(true);
    const totalAttempts = rows.reduce((sum, row) => sum + row.attemptCount, 0);
    expect(totalAttempts).toBeGreaterThan(1);
  });

  it("同一 domainTag の重複では二重計上しない", () => {
    const conceptById = new Map([
      ["a", concept({ id: "a", domainTags: ["情報科学", "情報科学"] })]
    ]);
    const rows = aggregate([log({ conceptId: "a" })], "domain", { conceptById });
    expect(rows).toHaveLength(1);
    expect(rows[0].attemptCount).toBe(1);
  });

  it("分野なし Concept を分野なしバケットへまとめる", () => {
    const conceptById = new Map([["a", concept({ id: "a", domainTags: [] })]]);
    const rows = aggregate([log({ conceptId: "a" })], "domain", { conceptById });
    expect(rows[0].key).toBe(DATA_LAB_DOMAIN_NONE_KEY);
    expect(rows[0].label).toBe("分野なし");
  });

  it("削除済み Concept は分野を復元できないため分野なしへ安全計上する", () => {
    const rows = aggregate([log({ conceptId: "gone" })], "domain", emptyMaps());
    expect(rows[0].key).toBe(DATA_LAB_DOMAIN_NONE_KEY);
    expect(rows[0].label).toBe("分野なし");
  });
});

describe("aggregateDataLabLogs Deck", () => {
  it("Deck ID ごとに集計し、現在の title を使う", () => {
    const deckById = new Map([["deck-1", deck({ id: "deck-1", title: "AI基礎" })]]);
    const rows = aggregate(
      [log({ id: "1", deckId: "deck-1" }), log({ id: "2", deckId: "deck-1" })],
      "deck",
      { deckById }
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].key).toBe("deck-1");
    expect(rows[0].label).toBe("AI基礎");
    expect(rows[0].attemptCount).toBe(2);
  });

  it("Deck ID なしは自由学習へまとめる", () => {
    const rows = aggregate([log()], "deck", emptyMaps());
    expect(rows[0].key).toBe(QUIZ_DECK_BUCKET_FREE);
    expect(rows[0].label).toBe("自由学習");
  });

  it("削除済み Deck でもクラッシュせず、異なる ID を別バケットにする", () => {
    const rows = aggregate(
      [
        log({ id: "1", deckId: "gone-a", deckTitleSnapshot: "旧A" }),
        log({ id: "2", deckId: "gone-b", deckTitleSnapshot: "旧B" }),
        log({ id: "3", deckId: "gone-c" })
      ],
      "deck",
      emptyMaps()
    );
    expect(rows.map((row) => row.key).sort()).toEqual(["gone-a", "gone-b", "gone-c"]);
    expect(rows.find((row) => row.key === "gone-a")?.label).toBe("旧A（削除済み）");
    expect(rows.find((row) => row.key === "gone-c")?.label).toBe("削除済みDeck");
  });
});

describe("aggregateDataLabLogs 日", () => {
  it("ローカル日付 YYYY-MM-DD 単位で集計する", () => {
    const rows = aggregate(
      [log({ id: "1", answeredAt: atLocal("2026-08-28", 10) }), log({ id: "2", answeredAt: atLocal("2026-08-28", 22) })],
      "day"
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].key).toBe("2026-08-28");
    expect(rows[0].attemptCount).toBe(2);
  });

  it("深夜をまたいだログは別日になる", () => {
    const before = new Date(2026, 7, 28, 23, 30).toISOString();
    const after = new Date(2026, 7, 29, 0, 30).toISOString();
    const rows = aggregate(
      [log({ id: "1", answeredAt: before }), log({ id: "2", answeredAt: after })],
      "day"
    );
    expect(rows.map((row) => row.key)).toEqual(["2026-08-28", "2026-08-29"]);
  });

  it("UTC の日付スライスではなくローカル日付でまとめる", () => {
    const localNearMidnight = new Date(2026, 7, 29, 0, 10);
    const iso = localNearMidnight.toISOString();
    const utcYmd = iso.slice(0, 10);
    const rows = aggregate([log({ answeredAt: iso })], "day");
    expect(rows[0].key).toBe("2026-08-29");
    if (utcYmd !== "2026-08-29") {
      expect(rows[0].key).not.toBe(utcYmd);
    }
  });
});

describe("aggregateDataLabLogs 週", () => {
  it("月曜日開始で同じ週は同じキーになる", () => {
    const mon = atLocal("2026-08-24");
    const sun = atLocal("2026-08-30");
    const rows = aggregate(
      [log({ id: "1", answeredAt: mon }), log({ id: "2", answeredAt: sun })],
      "week"
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].key).toBe("2026-W35");
    expect(rows[0].periodStart).toBe("2026-08-24");
    expect(rows[0].periodEnd).toBe("2026-08-30");
    expect(rows[0].label).toBe("2026-08-24 ～ 2026-08-30");
  });

  it("火曜と翌月曜は別週", () => {
    const tue = atLocal("2026-08-25");
    const nextMon = atLocal("2026-08-31");
    const rows = aggregate(
      [log({ id: "1", answeredAt: tue }), log({ id: "2", answeredAt: nextMon })],
      "week"
    );
    expect(rows).toHaveLength(2);
    expect(rows[0].key).toBe("2026-W35");
    expect(rows[1].key).toBe("2026-W36");
  });

  it("ISO week-year の年末年始境界を正しく扱う", () => {
    const dec31 = atLocal("2020-12-31");
    const jan1 = atLocal("2021-01-01");
    const rows = aggregate(
      [log({ id: "1", answeredAt: dec31 }), log({ id: "2", answeredAt: jan1 })],
      "week"
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].key).toBe("2020-W53");
    expect(rows[0].periodStart).toBe("2020-12-28");
    expect(rows[0].periodEnd).toBe("2021-01-03");
  });
});

describe("aggregateDataLabLogs 月", () => {
  it("YYYY-MM で月ごとに集計し、年をまたいでも混同しない", () => {
    const rows = aggregate(
      [
        log({ id: "1", answeredAt: atLocal("2025-12-15") }),
        log({ id: "2", answeredAt: atLocal("2026-12-15") }),
        log({ id: "3", answeredAt: atLocal("2026-11-01") })
      ],
      "month"
    );
    expect(rows.map((row) => row.key)).toEqual(["2025-12", "2026-11", "2026-12"]);
    expect(rows[0].periodStart).toBe("2025-12-01");
    expect(rows[0].periodEnd).toBe("2025-12-31");
  });
});

describe("aggregateDataLabLogs 境界ケース", () => {
  it("logs が空なら空配列", () => {
    expect(aggregate([], "concept")).toEqual([]);
    expect(aggregate([], "day")).toEqual([]);
  });

  it("1件のみでも集計できる", () => {
    const rows = aggregate([log({ conceptId: "c", correct: false, timeMs: 1500 })], "concept", {
      conceptById: new Map([["c", concept({ id: "c", title: "C" })]])
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].attemptCount).toBe(1);
    expect(rows[0].correctCount).toBe(0);
    expect(rows[0].incorrectCount).toBe(1);
    expect(rows[0].accuracy).toBe(0);
    expect(rows[0].averageResponseTimeMs).toBe(1500);
  });

  it("不正な answeredAt でも Concept 集計はクラッシュせず、日時比較には使わない", () => {
    const valid = atLocal("2026-08-10");
    const rows = aggregate(
      [
        log({ id: "bad", conceptId: "c", answeredAt: "not-a-date", timeMs: 1000 }),
        log({ id: "ok", conceptId: "c", answeredAt: valid, timeMs: 2000 })
      ],
      "concept",
      { conceptById: new Map([["c", concept({ id: "c" })]]) }
    );
    expect(rows[0].attemptCount).toBe(2);
    expect(rows[0].firstAttemptAt).toBe(valid);
    expect(rows[0].lastAttemptAt).toBe(valid);
  });

  it("日集計では不正な answeredAt のログだけ除外する", () => {
    const rows = aggregate(
      [
        log({ id: "bad", answeredAt: "???" }),
        log({ id: "ok", answeredAt: atLocal("2026-08-10") })
      ],
      "day"
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].attemptCount).toBe(1);
    expect(rows[0].key).toBe("2026-08-10");
  });

  it("Concept / 分野 / Deck はラベル昇順、同ラベルは key で安定ソート", () => {
    const conceptById = new Map([
      ["z", concept({ id: "z", title: "同じ" })],
      ["a", concept({ id: "a", title: "同じ" })],
      ["m", concept({ id: "m", title: "あい" })]
    ]);
    const rows = aggregate(
      [log({ id: "1", conceptId: "z" }), log({ id: "2", conceptId: "a" }), log({ id: "3", conceptId: "m" })],
      "concept",
      { conceptById }
    );
    expect(rows.map((row) => row.key)).toEqual(["m", "a", "z"]);
  });

  it("日 / 週 / 月は時系列昇順", () => {
    const days = aggregate(
      [
        log({ id: "2", answeredAt: atLocal("2026-08-30") }),
        log({ id: "1", answeredAt: atLocal("2026-08-28") })
      ],
      "day"
    );
    expect(days.map((row) => row.key)).toEqual(["2026-08-28", "2026-08-30"]);

    const months = aggregate(
      [
        log({ id: "2", answeredAt: atLocal("2026-09-01") }),
        log({ id: "1", answeredAt: atLocal("2026-07-01") })
      ],
      "month"
    );
    expect(months.map((row) => row.key)).toEqual(["2026-07", "2026-09"]);
  });
});
