import { describe, expect, it } from "vitest";
import { QUIZ_ATTEMPT_LOG_SCHEMA_VERSION, type QuizAttemptLog } from "../types/quiz";
import { buildDirectConfusionEdges } from "./conceptGraphConfusion";
import {
  CONFUSION_SPARSE_OPPORTUNITY_THRESHOLD,
  computeConceptConfusionSummaries,
  computeConfusionAnalysis,
  computeDirectedConfusionStats,
  isSparseConfusionSample,
  RECENT_CONFUSION_ATTEMPT_LIMIT,
  toConfusionPairCounts
} from "./confusionAnalysis";
import { filterLogsByAnsweredDateRange } from "./quizAttemptDateFilter";
import { computeConfusionPairs } from "./quizStats";

const log = (overrides: Partial<QuizAttemptLog>): QuizAttemptLog => ({
  id: "log-1",
  questionId: "q-1",
  questionPromptSnapshot: "prompt",
  selectedChoiceId: "choice-selected",
  selectedChoiceTextSnapshot: "選んだ",
  correctChoiceId: "choice-correct",
  correctChoiceTextSnapshot: "正解",
  correct: false,
  startedAt: "2026-01-01T00:00:00.000Z",
  answeredAt: "2026-01-01T00:00:01.000Z",
  timeMs: 1000,
  schemaVersion: QUIZ_ATTEMPT_LOG_SCHEMA_VERSION,
  ...overrides
});

const findPair = (
  stats: ReturnType<typeof computeDirectedConfusionStats>,
  correctConceptId: string,
  selectedConceptId: string
) => stats.find((s) => s.correctConceptId === correctConceptId && s.selectedConceptId === selectedConceptId);

describe("computeDirectedConfusionStats", () => {
  it("A→B と B→A を別 stat にする", () => {
    const stats = computeDirectedConfusionStats([
      log({
        id: "ab",
        correctLinkedConceptId: "A",
        selectedLinkedConceptId: "B",
        correct: false
      }),
      log({
        id: "ba",
        correctLinkedConceptId: "B",
        selectedLinkedConceptId: "A",
        correct: false
      })
    ]);
    expect(findPair(stats, "A", "B")?.confusionCount).toBe(1);
    expect(findPair(stats, "B", "A")?.confusionCount).toBe(1);
    expect(stats).toHaveLength(2);
  });

  it("同じ A→B が 3 回なら confusionCount は 3", () => {
    const stats = computeDirectedConfusionStats([
      log({ id: "1", correctLinkedConceptId: "A", selectedLinkedConceptId: "B", correct: false }),
      log({ id: "2", correctLinkedConceptId: "A", selectedLinkedConceptId: "B", correct: false }),
      log({ id: "3", correctLinkedConceptId: "A", selectedLinkedConceptId: "B", correct: false })
    ]);
    expect(findPair(stats, "A", "B")?.confusionCount).toBe(3);
  });

  it("A が正解だった 10 件のうち A→B が 2 件なら opportunityCount=10, rate=0.2", () => {
    const logs: QuizAttemptLog[] = [];
    for (let i = 0; i < 8; i += 1) {
      logs.push(
        log({
          id: `ok-${i}`,
          correctLinkedConceptId: "A",
          selectedLinkedConceptId: "A",
          correct: true
        })
      );
    }
    logs.push(
      log({ id: "ab-1", correctLinkedConceptId: "A", selectedLinkedConceptId: "B", correct: false }),
      log({ id: "ab-2", correctLinkedConceptId: "A", selectedLinkedConceptId: "B", correct: false })
    );
    const pair = findPair(computeDirectedConfusionStats(logs), "A", "B");
    expect(pair?.opportunityCount).toBe(10);
    expect(pair?.confusionCount).toBe(2);
    expect(pair?.confusionRate).toBe(0.2);
  });

  it("正答ログも opportunityCount に含む", () => {
    const pair = findPair(
      computeDirectedConfusionStats([
        log({
          id: "ok",
          correctLinkedConceptId: "A",
          selectedLinkedConceptId: "A",
          correct: true
        }),
        log({
          id: "ng",
          correctLinkedConceptId: "A",
          selectedLinkedConceptId: "B",
          correct: false
        })
      ]),
      "A",
      "B"
    );
    expect(pair?.opportunityCount).toBe(2);
    expect(pair?.confusionCount).toBe(1);
    expect(pair?.confusionRate).toBe(0.5);
  });

  it("B が正解だった回答を A→B の分母へ混ぜない", () => {
    const pair = findPair(
      computeDirectedConfusionStats([
        log({
          id: "ab",
          correctLinkedConceptId: "A",
          selectedLinkedConceptId: "B",
          correct: false
        }),
        log({
          id: "b-ok",
          correctLinkedConceptId: "B",
          selectedLinkedConceptId: "B",
          correct: true
        }),
        log({
          id: "ba",
          correctLinkedConceptId: "B",
          selectedLinkedConceptId: "A",
          correct: false
        })
      ]),
      "A",
      "B"
    );
    expect(pair?.opportunityCount).toBe(1);
    expect(pair?.confusionCount).toBe(1);
  });

  it("recent は正解 Concept の直近 10 回答だけを使う", () => {
    const logs: QuizAttemptLog[] = [];
    for (let i = 0; i < 10; i += 1) {
      logs.push(
        log({
          id: `old-ab-${i}`,
          correctLinkedConceptId: "A",
          selectedLinkedConceptId: "B",
          correct: false,
          answeredAt: `2026-01-${String(i + 1).padStart(2, "0")}T00:00:00.000Z`
        })
      );
    }
    for (let i = 0; i < 10; i += 1) {
      logs.push(
        log({
          id: `recent-ok-${i}`,
          correctLinkedConceptId: "A",
          selectedLinkedConceptId: "A",
          correct: true,
          answeredAt: `2026-02-${String(i + 1).padStart(2, "0")}T00:00:00.000Z`
        })
      );
    }
    const pair = findPair(computeDirectedConfusionStats(logs), "A", "B");
    expect(pair?.confusionCount).toBe(10);
    expect(pair?.recentOpportunityCount).toBe(RECENT_CONFUSION_ATTEMPT_LIMIT);
    expect(pair?.recentConfusionCount).toBe(0);
    expect(pair?.recentConfusionRate).toBe(0);
  });

  it("回答が 3 件しかない場合 recentOpportunityCount は 3", () => {
    const pair = findPair(
      computeDirectedConfusionStats([
        log({
          id: "1",
          correctLinkedConceptId: "A",
          selectedLinkedConceptId: "A",
          correct: true,
          answeredAt: "2026-01-01T00:00:00.000Z"
        }),
        log({
          id: "2",
          correctLinkedConceptId: "A",
          selectedLinkedConceptId: "B",
          correct: false,
          answeredAt: "2026-01-02T00:00:00.000Z"
        }),
        log({
          id: "3",
          correctLinkedConceptId: "A",
          selectedLinkedConceptId: "A",
          correct: true,
          answeredAt: "2026-01-03T00:00:00.000Z"
        })
      ]),
      "A",
      "B"
    );
    expect(pair?.recentOpportunityCount).toBe(3);
    expect(pair?.recentConfusionCount).toBe(1);
    expect(pair?.recentConfusionRate).toBeCloseTo(1 / 3);
  });

  it("最終混同日時は入力配列順に依存せず最新 answeredAt を選ぶ", () => {
    const pair = findPair(
      computeDirectedConfusionStats([
        log({
          id: "newer-first",
          correctLinkedConceptId: "A",
          selectedLinkedConceptId: "B",
          correct: false,
          answeredAt: "2026-09-01T12:00:00.000Z"
        }),
        log({
          id: "older-last",
          correctLinkedConceptId: "A",
          selectedLinkedConceptId: "B",
          correct: false,
          answeredAt: "2026-01-01T00:00:00.000Z"
        })
      ]),
      "A",
      "B"
    );
    expect(pair?.lastConfusedAt).toBe("2026-09-01T12:00:00.000Z");
  });

  it("linkedConceptId が欠けてもクラッシュせず pair にしない", () => {
    expect(() =>
      computeDirectedConfusionStats([
        log({ id: "no-correct", selectedLinkedConceptId: "B", correctLinkedConceptId: undefined }),
        log({ id: "no-selected", selectedLinkedConceptId: undefined, correctLinkedConceptId: "A" }),
        log({ id: "empty", selectedLinkedConceptId: "  ", correctLinkedConceptId: "" })
      ])
    ).not.toThrow();
    expect(
      computeDirectedConfusionStats([
        log({ id: "no-correct", selectedLinkedConceptId: "B", correctLinkedConceptId: undefined, correct: false }),
        log({ id: "no-selected", selectedLinkedConceptId: undefined, correctLinkedConceptId: "A", correct: false })
      ])
    ).toEqual([]);
  });

  it("正解と選択が同じ Concept のログを混同 pair にしない", () => {
    const stats = computeDirectedConfusionStats([
      log({
        id: "self-wrong",
        correctLinkedConceptId: "A",
        selectedLinkedConceptId: "A",
        correct: false
      }),
      log({
        id: "real",
        correctLinkedConceptId: "A",
        selectedLinkedConceptId: "B",
        correct: false
      })
    ]);
    expect(findPair(stats, "A", "A")).toBeUndefined();
    expect(findPair(stats, "A", "B")?.confusionCount).toBe(1);
    expect(findPair(stats, "A", "B")?.opportunityCount).toBe(2);
  });

  it("Concept オブジェクトがなくても ID 単位で集計できる", () => {
    const pair = findPair(
      computeDirectedConfusionStats([
        log({
          id: "deleted",
          correctLinkedConceptId: "deleted-correct",
          selectedLinkedConceptId: "deleted-selected",
          correct: false
        })
      ]),
      "deleted-correct",
      "deleted-selected"
    );
    expect(pair?.confusionCount).toBe(1);
    expect(pair?.opportunityCount).toBe(1);
  });

  it("期間フィルタ後のログだけを使う", () => {
    const logs = [
      log({
        id: "in",
        correctLinkedConceptId: "A",
        selectedLinkedConceptId: "B",
        correct: false,
        answeredAt: "2026-09-05T00:00:00.000Z"
      }),
      log({
        id: "out",
        correctLinkedConceptId: "A",
        selectedLinkedConceptId: "C",
        correct: false,
        answeredAt: "2026-08-01T00:00:00.000Z"
      })
    ];
    const inPeriod = filterLogsByAnsweredDateRange(logs, "2026-09-01", "2026-09-30");
    const stats = computeDirectedConfusionStats(inPeriod);
    expect(findPair(stats, "A", "B")?.confusionCount).toBe(1);
    expect(findPair(stats, "A", "C")).toBeUndefined();
    expect(findPair(stats, "A", "B")?.opportunityCount).toBe(1);
  });

  it("1 回だけの誤答もデータから消さない", () => {
    const pair = findPair(
      computeDirectedConfusionStats([
        log({
          id: "once",
          correctLinkedConceptId: "A",
          selectedLinkedConceptId: "B",
          correct: false
        })
      ]),
      "A",
      "B"
    );
    expect(pair?.confusionCount).toBe(1);
    expect(pair?.confusionRate).toBe(1);
    expect(isSparseConfusionSample(pair?.opportunityCount ?? 0)).toBe(true);
    expect(CONFUSION_SPARSE_OPPORTUNITY_THRESHOLD).toBe(5);
  });
});

describe("computeConceptConfusionSummaries", () => {
  it("正解 Concept ごとに混同対象を回数主軸で並べる", () => {
    const summaries = computeConceptConfusionSummaries([
      log({ id: "ab1", correctLinkedConceptId: "A", selectedLinkedConceptId: "B", correct: false }),
      log({ id: "ab2", correctLinkedConceptId: "A", selectedLinkedConceptId: "B", correct: false }),
      log({ id: "ab3", correctLinkedConceptId: "A", selectedLinkedConceptId: "B", correct: false }),
      log({
        id: "ac",
        correctLinkedConceptId: "A",
        selectedLinkedConceptId: "C",
        correct: false,
        answeredAt: "2026-03-01T00:00:00.000Z"
      }),
      log({
        id: "once-100",
        correctLinkedConceptId: "A",
        selectedLinkedConceptId: "Z",
        correct: false,
        answeredAt: "2026-02-01T00:00:00.000Z"
      }),
      ...Array.from({ length: 15 }, (_, i) =>
        log({
          id: `ok-${i}`,
          correctLinkedConceptId: "A",
          selectedLinkedConceptId: "A",
          correct: true
        })
      )
    ]);
    const a = summaries.find((s) => s.conceptId === "A");
    expect(a?.opportunityCount).toBe(20);
    expect(a?.totalConfusionCount).toBe(5);
    expect(a?.confusionRate).toBe(0.25);
    expect(a?.targets.map((t) => t.selectedConceptId)).toEqual(["B", "C", "Z"]);
    expect(a?.targets[0]?.confusionCount).toBe(3);
    expect(a?.targets[2]?.confusionRate).toBe(0.05);
  });

  it("率 100% の 1 件を回数の多い混同より上にしない", () => {
    const stats = computeDirectedConfusionStats([
      log({
        id: "once-100",
        correctLinkedConceptId: "X",
        selectedLinkedConceptId: "Y",
        correct: false
      }),
      ...Array.from({ length: 12 }, (_, i) =>
        log({
          id: `ab-${i}`,
          correctLinkedConceptId: "A",
          selectedLinkedConceptId: "B",
          correct: false
        })
      ),
      ...Array.from({ length: 8 }, (_, i) =>
        log({
          id: `ok-${i}`,
          correctLinkedConceptId: "A",
          selectedLinkedConceptId: "A",
          correct: true
        })
      )
    ]);
    expect(stats[0]?.correctConceptId).toBe("A");
    expect(stats[0]?.selectedConceptId).toBe("B");
    expect(stats[0]?.confusionCount).toBe(12);
    expect(stats[0]?.confusionRate).toBe(0.6);
    expect(stats[1]?.correctConceptId).toBe("X");
    expect(stats[1]?.confusionCount).toBe(1);
    expect(stats[1]?.confusionRate).toBe(1);
  });
});

describe("computeConfusionPairs compatibility wrapper", () => {
  it("新しい共通集計の confusionCount を count として返す", () => {
    const logs = [
      log({ id: "ab", correctLinkedConceptId: "A", selectedLinkedConceptId: "B", correct: false }),
      log({ id: "ab2", correctLinkedConceptId: "A", selectedLinkedConceptId: "B", correct: false }),
      log({ id: "ba", correctLinkedConceptId: "B", selectedLinkedConceptId: "A", correct: false }),
      log({ id: "ok", correctLinkedConceptId: "A", selectedLinkedConceptId: "A", correct: true })
    ];
    const directed = computeDirectedConfusionStats(logs);
    const wrapped = computeConfusionPairs(logs);
    expect(wrapped).toEqual(toConfusionPairCounts(directed));
    expect(wrapped.find((p) => p.correctConceptId === "A" && p.selectedConceptId === "B")?.count).toBe(
      2
    );
  });
});

describe("Concept Graph undirected merge from directed stats", () => {
  it("A→B / B→A を direct graph では 1 本へ合算できる", () => {
    const directed = computeDirectedConfusionStats([
      log({ id: "ab1", correctLinkedConceptId: "A", selectedLinkedConceptId: "B", correct: false }),
      log({ id: "ab2", correctLinkedConceptId: "A", selectedLinkedConceptId: "B", correct: false }),
      log({ id: "ba1", correctLinkedConceptId: "B", selectedLinkedConceptId: "A", correct: false }),
      log({ id: "ba2", correctLinkedConceptId: "B", selectedLinkedConceptId: "A", correct: false }),
      log({ id: "ba3", correctLinkedConceptId: "B", selectedLinkedConceptId: "A", correct: false })
    ]);
    const edges = buildDirectConfusionEdges(toConfusionPairCounts(directed), new Set(["A", "B"]));
    expect(edges).toEqual([{ source: "A", target: "B", count: 5 }]);
  });
});

describe("isSparseConfusionSample", () => {
  it("閾値未満だけ true にする", () => {
    expect(isSparseConfusionSample(1)).toBe(true);
    expect(isSparseConfusionSample(CONFUSION_SPARSE_OPPORTUNITY_THRESHOLD - 1)).toBe(true);
    expect(isSparseConfusionSample(CONFUSION_SPARSE_OPPORTUNITY_THRESHOLD)).toBe(false);
  });
});

describe("computeConfusionAnalysis", () => {
  it("pair と Concept 要約を同じ入力から一度に返す", () => {
    const analysis = computeConfusionAnalysis([
      log({ id: "ab", correctLinkedConceptId: "A", selectedLinkedConceptId: "B", correct: false })
    ]);
    expect(analysis.directedStats).toHaveLength(1);
    expect(analysis.conceptSummaries).toHaveLength(1);
    expect(analysis.conceptSummaries[0]?.targets).toEqual(analysis.directedStats);
  });
});
