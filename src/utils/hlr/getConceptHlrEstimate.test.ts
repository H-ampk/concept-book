import { describe, expect, it } from "vitest";
import { QUIZ_ATTEMPT_LOG_SCHEMA_VERSION, type QuizAttemptLog } from "../../types/quiz";
import { calculateBktMastery } from "../mastery/bkt";
import { getConceptMastery } from "../mastery/getConceptMastery";
import { resolveConceptIdFromLog } from "../quiz/resolveConceptIdFromLog";
import { DEFAULT_HLR_PARAMETERS, MIN_DISTINCT_STUDY_DAYS_FOR_ESTIMATE } from "./constants";
import { buildConceptHlrEstimateMap, getConceptHlrEstimate } from "./getConceptHlrEstimate";
import { calculateHlrHalfLifeDays, calculateHlrRetentionProbability } from "./hlr";
import type { HlrParameters } from "./types";

const baseLog = (overrides: Partial<QuizAttemptLog>): QuizAttemptLog => ({
  id: "log-1",
  questionId: "q-1",
  questionPromptSnapshot: "prompt",
  selectedChoiceId: "a",
  selectedChoiceTextSnapshot: "A",
  correctChoiceId: "a",
  correctChoiceTextSnapshot: "A",
  correct: true,
  startedAt: "2026-01-01T00:00:00.000Z",
  answeredAt: "2026-01-01T00:00:01.000Z",
  timeMs: 1000,
  schemaVersion: QUIZ_ATTEMPT_LOG_SCHEMA_VERSION,
  ...overrides
});

const now = (iso: string): Date => new Date(iso);

describe("getConceptHlrEstimate", () => {
  it("ログ0件は insufficient-data で half-life / retention / elapsed を確定しない", () => {
    const estimate = getConceptHlrEstimate([], "concept-a", { now: now("2026-01-10T00:00:00.000Z") });
    expect(estimate.conceptId).toBe("concept-a");
    expect(estimate.status).toBe("insufficient-data");
    expect(estimate.halfLifeDays).toBeNull();
    expect(estimate.retentionProbability).toBeNull();
    expect(estimate.elapsedDays).toBeNull();
    expect(estimate.lastAnsweredAt).toBeNull();
    expect(estimate.attemptCount).toBe(0);
    expect(estimate.successCount).toBe(0);
    expect(estimate.failureCount).toBe(0);
    expect(estimate.distinctStudyDayCount).toBe(0);
    expect(estimate.meanSpacingDays).toBeNull();
  });

  it("回答1件は insufficient-data だが lastAnsweredAt / elapsedDays は返す", () => {
    const logs = [
      baseLog({
        questionConceptId: "concept-a",
        answeredAt: "2026-01-01T00:00:00.000Z"
      })
    ];
    const estimate = getConceptHlrEstimate(logs, "concept-a", { now: now("2026-01-03T12:00:00.000Z") });
    expect(estimate.status).toBe("insufficient-data");
    expect(estimate.halfLifeDays).toBeNull();
    expect(estimate.retentionProbability).toBeNull();
    expect(estimate.lastAnsweredAt).toBe("2026-01-01T00:00:00.000Z");
    expect(estimate.elapsedDays).toBeCloseTo(2.5);
    expect(estimate.attemptCount).toBe(1);
    expect(estimate.distinctStudyDayCount).toBe(1);
  });

  it("同日の回答のみは insufficient-data", () => {
    const logs = [
      baseLog({
        id: "1",
        questionConceptId: "concept-a",
        answeredAt: "2026-01-01T08:00:00.000Z"
      }),
      baseLog({
        id: "2",
        questionConceptId: "concept-a",
        correct: false,
        answeredAt: "2026-01-01T20:00:00.000Z"
      })
    ];
    const estimate = getConceptHlrEstimate(logs, "concept-a", { now: now("2026-01-02T00:00:00.000Z") });
    expect(estimate.status).toBe("insufficient-data");
    expect(estimate.halfLifeDays).toBeNull();
    expect(estimate.retentionProbability).toBeNull();
    expect(estimate.distinctStudyDayCount).toBe(1);
    expect(estimate.attemptCount).toBe(2);
    expect(estimate.meanSpacingDays).toBeNull();
    expect(estimate.lastAnsweredAt).toBe("2026-01-01T20:00:00.000Z");
  });

  it("複数日にわたる回答は estimated", () => {
    const logs = [
      baseLog({
        id: "1",
        questionConceptId: "concept-a",
        answeredAt: "2026-01-01T00:00:00.000Z"
      }),
      baseLog({
        id: "2",
        questionConceptId: "concept-a",
        answeredAt: "2026-01-03T00:00:00.000Z"
      })
    ];
    const estimate = getConceptHlrEstimate(logs, "concept-a", { now: now("2026-01-03T00:00:00.000Z") });
    expect(estimate.status).toBe("estimated");
    expect(estimate.halfLifeDays).toBe(calculateHlrHalfLifeDays(2, 0));
    expect(estimate.retentionProbability).toBe(1);
    expect(estimate.distinctStudyDayCount).toBe(2);
    expect(estimate.distinctStudyDayCount).toBeGreaterThanOrEqual(MIN_DISTINCT_STUDY_DAYS_FOR_ESTIMATE);
  });

  it("success / failure の違いが half-life に反映される", () => {
    const successes = [
      baseLog({
        id: "1",
        questionConceptId: "concept-a",
        correct: true,
        answeredAt: "2026-01-01T00:00:00.000Z"
      }),
      baseLog({
        id: "2",
        questionConceptId: "concept-a",
        correct: true,
        answeredAt: "2026-01-02T00:00:00.000Z"
      })
    ];
    const failures = [
      baseLog({
        id: "1",
        questionConceptId: "concept-a",
        correct: false,
        answeredAt: "2026-01-01T00:00:00.000Z"
      }),
      baseLog({
        id: "2",
        questionConceptId: "concept-a",
        correct: false,
        answeredAt: "2026-01-02T00:00:00.000Z"
      })
    ];
    const mixed = [
      baseLog({
        id: "1",
        questionConceptId: "concept-a",
        correct: true,
        answeredAt: "2026-01-01T00:00:00.000Z"
      }),
      baseLog({
        id: "2",
        questionConceptId: "concept-a",
        correct: false,
        answeredAt: "2026-01-02T00:00:00.000Z"
      })
    ];
    const nowAt = now("2026-01-02T00:00:00.000Z");
    const successEstimate = getConceptHlrEstimate(successes, "concept-a", { now: nowAt });
    const failureEstimate = getConceptHlrEstimate(failures, "concept-a", { now: nowAt });
    const mixedEstimate = getConceptHlrEstimate(mixed, "concept-a", { now: nowAt });
    expect(successEstimate.successCount).toBe(2);
    expect(successEstimate.failureCount).toBe(0);
    expect(failureEstimate.successCount).toBe(0);
    expect(failureEstimate.failureCount).toBe(2);
    expect(mixedEstimate.successCount).toBe(1);
    expect(mixedEstimate.failureCount).toBe(1);
    expect(successEstimate.halfLifeDays).toBeGreaterThan(mixedEstimate.halfLifeDays ?? 0);
    expect(mixedEstimate.halfLifeDays).toBeGreaterThan(failureEstimate.halfLifeDays ?? 0);
  });

  it("短い経過時間と長い経過時間で retention が変化する", () => {
    const logs = [
      baseLog({
        id: "1",
        questionConceptId: "concept-a",
        answeredAt: "2026-01-01T00:00:00.000Z"
      }),
      baseLog({
        id: "2",
        questionConceptId: "concept-a",
        answeredAt: "2026-01-02T00:00:00.000Z"
      })
    ];
    const soon = getConceptHlrEstimate(logs, "concept-a", { now: now("2026-01-02T00:00:00.000Z") });
    const later = getConceptHlrEstimate(logs, "concept-a", { now: now("2026-02-01T00:00:00.000Z") });
    expect(soon.status).toBe("estimated");
    expect(later.status).toBe("estimated");
    expect(soon.retentionProbability).toBe(1);
    expect(later.retentionProbability).toBeLessThan(soon.retentionProbability ?? 1);
    expect(later.elapsedDays).toBeGreaterThan(soon.elapsedDays ?? 0);
  });

  it("lastAnsweredAt / elapsedDays が正しい", () => {
    const logs = [
      baseLog({
        id: "1",
        questionConceptId: "concept-a",
        answeredAt: "2026-01-01T00:00:00.000Z"
      }),
      baseLog({
        id: "2",
        questionConceptId: "concept-a",
        answeredAt: "2026-01-04T06:00:00.000Z"
      })
    ];
    const estimate = getConceptHlrEstimate(logs, "concept-a", { now: now("2026-01-05T18:00:00.000Z") });
    expect(estimate.lastAnsweredAt).toBe("2026-01-04T06:00:00.000Z");
    expect(estimate.elapsedDays).toBeCloseTo(1.5);
  });

  it("distinctStudyDayCount は UTC 暦日で数える", () => {
    const logs = [
      baseLog({
        id: "1",
        questionConceptId: "concept-a",
        answeredAt: "2026-01-01T08:00:00.000Z"
      }),
      baseLog({
        id: "2",
        questionConceptId: "concept-a",
        answeredAt: "2026-01-01T22:00:00.000Z"
      }),
      baseLog({
        id: "3",
        questionConceptId: "concept-a",
        answeredAt: "2026-01-02T01:00:00.000Z"
      }),
      baseLog({
        id: "4",
        questionConceptId: "concept-a",
        answeredAt: "2026-01-03T00:00:00.000Z"
      })
    ];
    const estimate = getConceptHlrEstimate(logs, "concept-a", { now: now("2026-01-03T00:00:00.000Z") });
    expect(estimate.distinctStudyDayCount).toBe(3);
    expect(estimate.attemptCount).toBe(4);
  });

  it("meanSpacingDays は UTC 暦日の間隔平均であり同日回答では水増ししない", () => {
    const logs = [
      baseLog({
        id: "1",
        questionConceptId: "concept-a",
        answeredAt: "2026-01-01T10:00:00.000Z"
      }),
      baseLog({
        id: "2",
        questionConceptId: "concept-a",
        answeredAt: "2026-01-01T18:00:00.000Z"
      }),
      baseLog({
        id: "3",
        questionConceptId: "concept-a",
        answeredAt: "2026-01-04T00:00:00.000Z"
      }),
      baseLog({
        id: "4",
        questionConceptId: "concept-a",
        answeredAt: "2026-01-10T00:00:00.000Z"
      })
    ];
    const estimate = getConceptHlrEstimate(logs, "concept-a", { now: now("2026-01-10T00:00:00.000Z") });
    expect(estimate.distinctStudyDayCount).toBe(3);
    expect(estimate.meanSpacingDays).toBeCloseTo((3 + 6) / 2);
  });

  it("ログ順が時系列でなくても同じ結果", () => {
    const chronological = [
      baseLog({
        id: "1",
        questionConceptId: "concept-a",
        correct: false,
        answeredAt: "2026-01-01T00:00:00.000Z"
      }),
      baseLog({
        id: "2",
        questionConceptId: "concept-a",
        correct: true,
        answeredAt: "2026-01-04T00:00:00.000Z"
      }),
      baseLog({
        id: "3",
        questionConceptId: "concept-a",
        correct: true,
        answeredAt: "2026-01-10T00:00:00.000Z"
      })
    ];
    const reversed = [chronological[2], chronological[1], chronological[0]];
    const shuffled = [chronological[1], chronological[2], chronological[0]];
    const options = { now: now("2026-01-12T00:00:00.000Z") };
    expect(getConceptHlrEstimate(reversed, "concept-a", options)).toEqual(
      getConceptHlrEstimate(chronological, "concept-a", options)
    );
    expect(getConceptHlrEstimate(shuffled, "concept-a", options)).toEqual(
      getConceptHlrEstimate(chronological, "concept-a", options)
    );
  });

  it("入力配列を破壊しない", () => {
    const logs = [
      baseLog({
        id: "2",
        questionConceptId: "concept-a",
        answeredAt: "2026-01-04T00:00:00.000Z"
      }),
      baseLog({
        id: "1",
        questionConceptId: "concept-a",
        answeredAt: "2026-01-01T00:00:00.000Z"
      })
    ];
    const snapshot = logs.map((log) => ({ ...log }));
    getConceptHlrEstimate(logs, "concept-a", { now: now("2026-01-05T00:00:00.000Z") });
    buildConceptHlrEstimateMap(logs, { now: now("2026-01-05T00:00:00.000Z") });
    expect(logs).toEqual(snapshot);
    expect(logs[0].id).toBe("2");
  });

  it("resolveConceptIdFromLog() による Concept 帰属が既存仕様と一致する", () => {
    const logs = [
      baseLog({
        id: "1",
        questionConceptId: "asked",
        conceptId: "fallback",
        selectedLinkedConceptId: "selected",
        correctLinkedConceptId: "linked",
        correct: true,
        answeredAt: "2026-01-01T00:00:00.000Z"
      }),
      baseLog({
        id: "2",
        questionConceptId: "asked",
        conceptId: "fallback",
        selectedLinkedConceptId: "selected",
        correctLinkedConceptId: "linked",
        correct: true,
        answeredAt: "2026-01-02T00:00:00.000Z"
      }),
      baseLog({
        id: "3",
        conceptId: "fallback",
        selectedLinkedConceptId: "selected",
        correctLinkedConceptId: "linked",
        correct: false,
        answeredAt: "2026-01-01T00:00:00.000Z"
      }),
      baseLog({
        id: "4",
        conceptId: "fallback",
        selectedLinkedConceptId: "selected",
        correctLinkedConceptId: "linked",
        correct: false,
        answeredAt: "2026-01-03T00:00:00.000Z"
      }),
      baseLog({
        id: "5",
        selectedLinkedConceptId: "selected",
        correctLinkedConceptId: "linked",
        correct: true,
        answeredAt: "2026-01-01T00:00:00.000Z"
      })
    ];

    expect(resolveConceptIdFromLog(logs[0])).toBe("asked");
    expect(resolveConceptIdFromLog(logs[2])).toBe("fallback");
    expect(resolveConceptIdFromLog(logs[4])).toBeNull();

    const asked = getConceptHlrEstimate(logs, "asked", { now: now("2026-01-03T00:00:00.000Z") });
    const fallback = getConceptHlrEstimate(logs, "fallback", { now: now("2026-01-03T00:00:00.000Z") });
    expect(asked.attemptCount).toBe(2);
    expect(asked.successCount).toBe(2);
    expect(fallback.attemptCount).toBe(2);
    expect(fallback.failureCount).toBe(2);
    expect(getConceptHlrEstimate(logs, "selected").attemptCount).toBe(0);
    expect(getConceptHlrEstimate(logs, "linked").attemptCount).toBe(0);

    const map = buildConceptHlrEstimateMap(logs);
    expect(map.has("asked")).toBe(true);
    expect(map.has("fallback")).toBe(true);
    expect(map.has("selected")).toBe(false);
    expect(map.has("linked")).toBe(false);
  });

  it("elapsed = 0 なら retention = 1、elapsed = halfLife なら retention = 0.5", () => {
    const logs = [
      baseLog({
        id: "1",
        questionConceptId: "concept-a",
        answeredAt: "2026-01-01T00:00:00.000Z"
      }),
      baseLog({
        id: "2",
        questionConceptId: "concept-a",
        answeredAt: "2026-01-02T00:00:00.000Z"
      })
    ];
    const last = "2026-01-02T00:00:00.000Z";
    const atLast = getConceptHlrEstimate(logs, "concept-a", { now: now(last) });
    expect(atLast.elapsedDays).toBe(0);
    expect(atLast.retentionProbability).toBe(1);

    const halfLifeDays = atLast.halfLifeDays;
    expect(halfLifeDays).not.toBeNull();
    const atHalfLife = getConceptHlrEstimate(logs, "concept-a", {
      now: new Date(Date.parse(last) + (halfLifeDays as number) * 24 * 60 * 60 * 1000)
    });
    expect(atHalfLife.elapsedDays).toBeCloseTo(halfLifeDays as number);
    expect(atHalfLife.retentionProbability).toBeCloseTo(0.5);
  });

  it("異なる HlrParameters を渡すと結果が変化する", () => {
    const logs = [
      baseLog({
        id: "1",
        questionConceptId: "concept-a",
        correct: true,
        answeredAt: "2026-01-01T00:00:00.000Z"
      }),
      baseLog({
        id: "2",
        questionConceptId: "concept-a",
        correct: false,
        answeredAt: "2026-01-02T00:00:00.000Z"
      })
    ];
    const custom: HlrParameters = { intercept: 2, successWeight: 0.2, failureWeight: -0.1 };
    const defaultEstimate = getConceptHlrEstimate(logs, "concept-a", { now: now("2026-01-02T00:00:00.000Z") });
    const customEstimate = getConceptHlrEstimate(logs, "concept-a", {
      now: now("2026-01-02T00:00:00.000Z"),
      parameters: custom
    });
    expect(defaultEstimate.successCount).toBe(customEstimate.successCount);
    expect(defaultEstimate.halfLifeDays).not.toBe(customEstimate.halfLifeDays);
    expect(customEstimate.halfLifeDays).toBe(calculateHlrHalfLifeDays(1, 1, custom));
  });

  it("elapsedDays は freshness のように floor しない連続値", () => {
    const logs = [
      baseLog({
        id: "1",
        questionConceptId: "concept-a",
        answeredAt: "2026-01-01T00:00:00.000Z"
      }),
      baseLog({
        id: "2",
        questionConceptId: "concept-a",
        answeredAt: "2026-01-02T00:00:00.000Z"
      })
    ];
    const estimate = getConceptHlrEstimate(logs, "concept-a", { now: now("2026-01-02T12:00:00.000Z") });
    expect(estimate.elapsedDays).toBeCloseTo(0.5);
    expect(estimate.elapsedDays).not.toBe(0);
    expect(estimate.retentionProbability).toBe(
      calculateHlrRetentionProbability(0.5, estimate.halfLifeDays as number)
    );
  });
});

describe("buildConceptHlrEstimateMap", () => {
  it("ログに現れる Concept のみ生成する", () => {
    const logs = [
      baseLog({ id: "a", questionConceptId: "concept-a", answeredAt: "2026-01-01T00:00:00.000Z" }),
      baseLog({ id: "b", conceptId: "concept-b", answeredAt: "2026-01-02T00:00:00.000Z" }),
      baseLog({ id: "orphan", selectedLinkedConceptId: "concept-c", answeredAt: "2026-01-03T00:00:00.000Z" })
    ];
    const map = buildConceptHlrEstimateMap(logs, { now: now("2026-01-04T00:00:00.000Z") });
    expect([...map.keys()].sort()).toEqual(["concept-a", "concept-b"]);
    expect(map.has("concept-c")).toBe(false);
  });

  it("getConceptHlrEstimate と同じ結果になる", () => {
    const logs = [
      baseLog({
        id: "1",
        questionConceptId: "concept-a",
        correct: true,
        answeredAt: "2026-01-01T00:00:00.000Z"
      }),
      baseLog({
        id: "2",
        questionConceptId: "concept-a",
        correct: false,
        answeredAt: "2026-01-03T00:00:00.000Z"
      }),
      baseLog({
        id: "3",
        questionConceptId: "concept-b",
        correct: true,
        answeredAt: "2026-01-02T00:00:00.000Z"
      })
    ];
    const options = { now: now("2026-01-05T00:00:00.000Z") };
    const map = buildConceptHlrEstimateMap(logs, options);
    expect(map.get("concept-a")).toEqual(getConceptHlrEstimate(logs, "concept-a", options));
    expect(map.get("concept-b")).toEqual(getConceptHlrEstimate(logs, "concept-b", options));
  });
});

describe("BKT との独立性", () => {
  it("同じ回答ログについて now だけを変えても BKT masteryProbability / masteryScore は変化しない", () => {
    const logs = [
      baseLog({
        id: "1",
        questionConceptId: "concept-a",
        correct: true,
        answeredAt: "2026-01-01T00:00:00.000Z"
      }),
      baseLog({
        id: "2",
        questionConceptId: "concept-a",
        correct: true,
        answeredAt: "2026-01-02T00:00:00.000Z"
      }),
      baseLog({
        id: "3",
        questionConceptId: "concept-a",
        correct: true,
        answeredAt: "2026-01-03T00:00:00.000Z"
      }),
      baseLog({
        id: "4",
        questionConceptId: "concept-a",
        correct: true,
        answeredAt: "2026-01-04T00:00:00.000Z"
      }),
      baseLog({
        id: "5",
        questionConceptId: "concept-a",
        correct: true,
        answeredAt: "2026-01-05T00:00:00.000Z"
      })
    ];
    const earlyNow = now("2026-01-05T00:00:00.000Z");
    const lateNow = now("2026-03-15T00:00:00.000Z");
    const earlyMastery = getConceptMastery(logs, "concept-a", { now: earlyNow });
    const lateMastery = getConceptMastery(logs, "concept-a", { now: lateNow });
    const earlyHlr = getConceptHlrEstimate(logs, "concept-a", { now: earlyNow });
    const lateHlr = getConceptHlrEstimate(logs, "concept-a", { now: lateNow });

    expect(lateMastery.masteryProbability).toBe(earlyMastery.masteryProbability);
    expect(lateMastery.masteryScore).toBe(earlyMastery.masteryScore);
    expect(lateMastery.freshness).not.toBe(earlyMastery.freshness);
    expect(lateHlr.retentionProbability).toBeLessThan(earlyHlr.retentionProbability ?? 1);
    expect(lateHlr.halfLifeDays).toBe(earlyHlr.halfLifeDays);
  });

  it("HLR 計算を追加しても既存 mastery の値が変わらない", () => {
    const logs = [
      baseLog({
        id: "1",
        questionConceptId: "concept-a",
        correct: true,
        answeredAt: "2026-01-01T00:00:00.000Z"
      }),
      baseLog({
        id: "2",
        questionConceptId: "concept-a",
        correct: true,
        answeredAt: "2026-01-02T00:00:00.000Z"
      }),
      baseLog({
        id: "3",
        questionConceptId: "concept-a",
        correct: true,
        answeredAt: "2026-01-03T00:00:00.000Z"
      }),
      baseLog({
        id: "4",
        questionConceptId: "concept-a",
        correct: true,
        answeredAt: "2026-01-04T00:00:00.000Z"
      }),
      baseLog({
        id: "5",
        questionConceptId: "concept-a",
        correct: true,
        answeredAt: "2026-01-05T00:00:00.000Z"
      })
    ];
    const lateNow = now("2026-03-15T00:00:00.000Z");
    const mastery = getConceptMastery(logs, "concept-a", { now: lateNow });
    const hlr = getConceptHlrEstimate(logs, "concept-a", { now: lateNow });

    expect(mastery.masteryProbability).toBe(calculateBktMastery(logs));
    expect(mastery.masteryScore).toBe(Math.round(mastery.masteryProbability * 100));
    expect(hlr.status).toBe("estimated");
    expect(hlr.retentionProbability).not.toBeNull();
    expect(hlr.retentionProbability).not.toBe(mastery.masteryProbability);
    expect(mastery.masteryScore).toBeGreaterThan(80);
    expect(hlr.retentionProbability).toBeLessThan(0.7);
    expect(Object.prototype.hasOwnProperty.call(mastery, "retentionProbability")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(mastery, "halfLifeDays")).toBe(false);
  });

  it("mastery confidence を HLR の推定可否として流用しない", () => {
    const sameDayMany = Array.from({ length: 5 }, (_, i) =>
      baseLog({
        id: `s-${i}`,
        questionConceptId: "concept-a",
        correct: true,
        answeredAt: `2026-01-01T${String(i + 10).padStart(2, "0")}:00:00.000Z`
      })
    );
    const twoDays = [
      baseLog({
        id: "1",
        questionConceptId: "concept-b",
        correct: true,
        answeredAt: "2026-01-01T00:00:00.000Z"
      }),
      baseLog({
        id: "2",
        questionConceptId: "concept-b",
        correct: true,
        answeredAt: "2026-01-02T00:00:00.000Z"
      })
    ];
    const sameDayMastery = getConceptMastery(sameDayMany, "concept-a");
    const sameDayHlr = getConceptHlrEstimate(sameDayMany, "concept-a", { now: now("2026-01-02T00:00:00.000Z") });
    const twoDayMastery = getConceptMastery(twoDays, "concept-b");
    const twoDayHlr = getConceptHlrEstimate(twoDays, "concept-b", { now: now("2026-01-02T00:00:00.000Z") });

    expect(sameDayMastery.confidence).toBe("medium");
    expect(sameDayHlr.status).toBe("insufficient-data");
    expect(twoDayMastery.confidence).toBe("low");
    expect(twoDayHlr.status).toBe("estimated");
  });
});

describe("DEFAULT_HLR_PARAMETERS", () => {
  it("provisional な Leitner-derived baseline であり ConceptBook 推定値ではない", () => {
    expect(DEFAULT_HLR_PARAMETERS).toEqual({
      intercept: 0,
      successWeight: 1,
      failureWeight: -1
    });
  });
});
