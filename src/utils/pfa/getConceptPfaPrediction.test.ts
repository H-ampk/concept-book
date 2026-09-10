import { describe, expect, it } from "vitest";
import { QUIZ_ATTEMPT_LOG_SCHEMA_VERSION, type QuizAttemptLog } from "../../types/quiz";
import { resolveConceptIdFromLog } from "../quiz/resolveConceptIdFromLog";
import { DEFAULT_PFA_PARAMETERS } from "./constants";
import { buildConceptPfaPredictionMap, getConceptPfaPrediction } from "./getConceptPfaPrediction";
import { calculatePfaNextCorrectProbability } from "./pfa";
import type { PfaParameters } from "./types";

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

describe("getConceptPfaPrediction", () => {
  it("対象 Concept のログ0件でも sigmoid(intercept) を prior として返す", () => {
    const prediction = getConceptPfaPrediction([], "concept-a");
    expect(prediction.conceptId).toBe("concept-a");
    expect(prediction.successCount).toBe(0);
    expect(prediction.failureCount).toBe(0);
    expect(prediction.nextCorrectProbability).toBe(calculatePfaNextCorrectProbability(0, 0));
    expect(prediction.nextCorrectProbability).toBeCloseTo(0.5);
  });

  it("成功のみを successCount に計上する", () => {
    const logs = [
      baseLog({ id: "1", questionConceptId: "concept-a", correct: true }),
      baseLog({ id: "2", questionConceptId: "concept-a", correct: true })
    ];
    const prediction = getConceptPfaPrediction(logs, "concept-a");
    expect(prediction.successCount).toBe(2);
    expect(prediction.failureCount).toBe(0);
    expect(prediction.nextCorrectProbability).toBe(calculatePfaNextCorrectProbability(2, 0));
  });

  it("失敗のみを failureCount に計上する", () => {
    const logs = [
      baseLog({ id: "1", questionConceptId: "concept-a", correct: false }),
      baseLog({ id: "2", questionConceptId: "concept-a", correct: false })
    ];
    const prediction = getConceptPfaPrediction(logs, "concept-a");
    expect(prediction.successCount).toBe(0);
    expect(prediction.failureCount).toBe(2);
    expect(prediction.nextCorrectProbability).toBe(calculatePfaNextCorrectProbability(0, 2));
  });

  it("成功・失敗混在を counts に反映する", () => {
    const logs = [
      baseLog({ id: "1", questionConceptId: "concept-a", correct: true }),
      baseLog({ id: "2", questionConceptId: "concept-a", correct: false }),
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
        correct: false,
        answeredAt: "2026-01-05T00:00:00.000Z"
      }),
      baseLog({
        id: "6",
        questionConceptId: "concept-a",
        correct: true,
        answeredAt: "2026-01-06T00:00:00.000Z"
      })
    ];
    const prediction = getConceptPfaPrediction(logs, "concept-a");
    expect(prediction.successCount).toBe(4);
    expect(prediction.failureCount).toBe(2);
    expect(prediction.nextCorrectProbability).toBe(calculatePfaNextCorrectProbability(4, 2));
  });

  it("successCount が増えると、正の successWeight では probability が上昇する", () => {
    const oneSuccess = getConceptPfaPrediction(
      [baseLog({ questionConceptId: "concept-a", correct: true })],
      "concept-a"
    );
    const twoSuccess = getConceptPfaPrediction(
      [
        baseLog({ id: "1", questionConceptId: "concept-a", correct: true }),
        baseLog({ id: "2", questionConceptId: "concept-a", correct: true })
      ],
      "concept-a"
    );
    expect(twoSuccess.nextCorrectProbability).toBeGreaterThan(oneSuccess.nextCorrectProbability);
  });

  it("failureCount が増えると、負の failureWeight では probability が低下する", () => {
    const oneFailure = getConceptPfaPrediction(
      [baseLog({ questionConceptId: "concept-a", correct: false })],
      "concept-a"
    );
    const twoFailure = getConceptPfaPrediction(
      [
        baseLog({ id: "1", questionConceptId: "concept-a", correct: false }),
        baseLog({ id: "2", questionConceptId: "concept-a", correct: false })
      ],
      "concept-a"
    );
    expect(twoFailure.nextCorrectProbability).toBeLessThan(oneFailure.nextCorrectProbability);
  });

  it("probability は常に 0〜1", () => {
    const prediction = getConceptPfaPrediction(
      [
        baseLog({ id: "1", questionConceptId: "concept-a", correct: true }),
        baseLog({ id: "2", questionConceptId: "concept-a", correct: false })
      ],
      "concept-a"
    );
    expect(prediction.nextCorrectProbability).toBeGreaterThanOrEqual(0);
    expect(prediction.nextCorrectProbability).toBeLessThanOrEqual(1);
  });

  it("questionConceptId が優先される", () => {
    const logs = [
      baseLog({
        questionConceptId: "concept-q",
        conceptId: "concept-fallback",
        correct: true
      })
    ];
    expect(getConceptPfaPrediction(logs, "concept-q").successCount).toBe(1);
    expect(getConceptPfaPrediction(logs, "concept-fallback").successCount).toBe(0);
    expect(getConceptPfaPrediction(logs, "concept-fallback").failureCount).toBe(0);
  });

  it("questionConceptId が無い場合 conceptId へ fallback する", () => {
    const logs = [baseLog({ conceptId: "concept-fallback", correct: true })];
    expect(getConceptPfaPrediction(logs, "concept-fallback").successCount).toBe(1);
    expect(resolveConceptIdFromLog(logs[0])).toBe("concept-fallback");
  });

  it("selectedLinkedConceptId のみでは対象 Concept にしない", () => {
    const logs = [baseLog({ selectedLinkedConceptId: "concept-selected-only", correct: false })];
    expect(resolveConceptIdFromLog(logs[0])).toBeNull();
    expect(getConceptPfaPrediction(logs, "concept-selected-only").successCount).toBe(0);
    expect(getConceptPfaPrediction(logs, "concept-selected-only").failureCount).toBe(0);
    expect(buildConceptPfaPredictionMap(logs).size).toBe(0);
  });

  it("correctLinkedConceptId のみでは対象 Concept にしない", () => {
    const logs = [baseLog({ correctLinkedConceptId: "concept-correct-link", correct: true })];
    expect(resolveConceptIdFromLog(logs[0])).toBeNull();
    expect(getConceptPfaPrediction(logs, "concept-correct-link").successCount).toBe(0);
    expect(buildConceptPfaPredictionMap(logs).size).toBe(0);
  });

  it("別 Concept のログが混入しない", () => {
    const logs = [
      baseLog({ id: "a1", questionConceptId: "concept-a", correct: true }),
      baseLog({ id: "b1", questionConceptId: "concept-b", correct: false }),
      baseLog({ id: "a2", questionConceptId: "concept-a", correct: false })
    ];
    const predictionA = getConceptPfaPrediction(logs, "concept-a");
    const predictionB = getConceptPfaPrediction(logs, "concept-b");
    expect(predictionA.successCount).toBe(1);
    expect(predictionA.failureCount).toBe(1);
    expect(predictionB.successCount).toBe(0);
    expect(predictionB.failureCount).toBe(1);
  });

  it("BKT と同じ resolveConceptIdFromLog() で帰属する", () => {
    const logs = [
      baseLog({
        id: "1",
        questionConceptId: "asked",
        conceptId: "fallback",
        selectedLinkedConceptId: "selected",
        correctLinkedConceptId: "linked",
        correct: true
      }),
      baseLog({
        id: "2",
        conceptId: "fallback",
        selectedLinkedConceptId: "selected",
        correctLinkedConceptId: "linked",
        correct: false
      }),
      baseLog({
        id: "3",
        selectedLinkedConceptId: "selected",
        correctLinkedConceptId: "linked",
        correct: true
      })
    ];

    const grouped = new Map<string, { successCount: number; failureCount: number }>();
    for (const log of logs) {
      const conceptId = resolveConceptIdFromLog(log);
      if (!conceptId) {
        continue;
      }
      const current = grouped.get(conceptId) ?? { successCount: 0, failureCount: 0 };
      if (log.correct) {
        current.successCount += 1;
      } else {
        current.failureCount += 1;
      }
      grouped.set(conceptId, current);
    }

    expect(getConceptPfaPrediction(logs, "asked")).toMatchObject(grouped.get("asked") ?? {});
    expect(getConceptPfaPrediction(logs, "fallback")).toMatchObject(grouped.get("fallback") ?? {});
    expect(getConceptPfaPrediction(logs, "selected").successCount).toBe(0);
    expect(getConceptPfaPrediction(logs, "linked").successCount).toBe(0);
    expect(buildConceptPfaPredictionMap(logs).has("asked")).toBe(true);
    expect(buildConceptPfaPredictionMap(logs).has("fallback")).toBe(true);
    expect(buildConceptPfaPredictionMap(logs).has("selected")).toBe(false);
    expect(buildConceptPfaPredictionMap(logs).has("linked")).toBe(false);
  });

  it("入力ログが時系列順でなくても、同じ成功・失敗回数なら結果が同じ", () => {
    const chronological = [
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
      }),
      baseLog({
        id: "3",
        questionConceptId: "concept-a",
        correct: true,
        answeredAt: "2026-01-03T00:00:00.000Z"
      })
    ];
    const reversedOrder = [chronological[1], chronological[2], chronological[0]];
    const shuffled = [chronological[2], chronological[0], chronological[1]];
    expect(getConceptPfaPrediction(reversedOrder, "concept-a")).toEqual(
      getConceptPfaPrediction(chronological, "concept-a")
    );
    expect(getConceptPfaPrediction(shuffled, "concept-a")).toEqual(
      getConceptPfaPrediction(chronological, "concept-a")
    );
  });

  it("入力配列を破壊しない", () => {
    const logs = [
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
        answeredAt: "2026-01-02T00:00:00.000Z"
      })
    ];
    const snapshot = logs.map((log) => ({ ...log }));
    getConceptPfaPrediction(logs, "concept-a");
    buildConceptPfaPredictionMap(logs);
    expect(logs).toEqual(snapshot);
    expect(logs[0].id).toBe("1");
  });

  it("同じ入力と parameters なら決定的に同じ結果になる", () => {
    const logs = [
      baseLog({ id: "1", questionConceptId: "concept-a", correct: true }),
      baseLog({ id: "2", questionConceptId: "concept-a", correct: false })
    ];
    expect(getConceptPfaPrediction(logs, "concept-a")).toEqual(getConceptPfaPrediction(logs, "concept-a"));
  });

  it("異なる PfaParameters を渡すと prediction が変化する", () => {
    const logs = [
      baseLog({ id: "1", questionConceptId: "concept-a", correct: true }),
      baseLog({ id: "2", questionConceptId: "concept-a", correct: true }),
      baseLog({ id: "3", questionConceptId: "concept-a", correct: false })
    ];
    const mild: PfaParameters = { intercept: 0, successWeight: 0.2, failureWeight: -0.2 };
    const strong: PfaParameters = { intercept: 0, successWeight: 1, failureWeight: -1 };
    const mildPrediction = getConceptPfaPrediction(logs, "concept-a", { parameters: mild });
    const strongPrediction = getConceptPfaPrediction(logs, "concept-a", { parameters: strong });
    expect(mildPrediction.successCount).toBe(strongPrediction.successCount);
    expect(mildPrediction.failureCount).toBe(strongPrediction.failureCount);
    expect(mildPrediction.nextCorrectProbability).not.toBe(strongPrediction.nextCorrectProbability);
    expect(strongPrediction.nextCorrectProbability).toBeGreaterThan(mildPrediction.nextCorrectProbability);
  });

  it("timeMs や linkedConceptId は PFA 計算に使わない", () => {
    const logsSlow = [baseLog({ questionConceptId: "concept-a", correct: true, timeMs: 60_000 })];
    const logsFast = [
      baseLog({
        questionConceptId: "concept-a",
        correct: true,
        timeMs: 200,
        selectedLinkedConceptId: "other",
        correctLinkedConceptId: "other"
      })
    ];
    expect(getConceptPfaPrediction(logsSlow, "concept-a").nextCorrectProbability).toBe(
      getConceptPfaPrediction(logsFast, "concept-a").nextCorrectProbability
    );
    expect(getConceptPfaPrediction(logsFast, "other").successCount).toBe(0);
  });
});

describe("buildConceptPfaPredictionMap", () => {
  it("ログに現れる Concept ごとに prediction を構築し、存在しない Concept は生成しない", () => {
    const logs = [
      baseLog({ id: "a", questionConceptId: "concept-a", correct: true }),
      baseLog({ id: "b", conceptId: "concept-b", correct: false }),
      baseLog({ id: "orphan", selectedLinkedConceptId: "concept-c", correct: true })
    ];
    const map = buildConceptPfaPredictionMap(logs);
    expect([...map.keys()].sort()).toEqual(["concept-a", "concept-b"]);
    expect(map.get("concept-a")?.successCount).toBe(1);
    expect(map.get("concept-b")?.failureCount).toBe(1);
    expect(map.has("concept-c")).toBe(false);
  });

  it("getConceptPfaPrediction と同じ counts / probability になる", () => {
    const logs = [
      baseLog({ id: "1", questionConceptId: "concept-a", correct: true }),
      baseLog({ id: "2", questionConceptId: "concept-a", correct: false }),
      baseLog({ id: "3", questionConceptId: "concept-b", correct: true })
    ];
    const map = buildConceptPfaPredictionMap(logs);
    expect(map.get("concept-a")).toEqual(getConceptPfaPrediction(logs, "concept-a"));
    expect(map.get("concept-b")).toEqual(getConceptPfaPrediction(logs, "concept-b"));
  });

  it("options.parameters を一括計算にも適用する", () => {
    const logs = [baseLog({ questionConceptId: "concept-a", correct: true })];
    const parameters: PfaParameters = { intercept: 0, successWeight: 1, failureWeight: -1 };
    const map = buildConceptPfaPredictionMap(logs, { parameters });
    expect(map.get("concept-a")).toEqual(getConceptPfaPrediction(logs, "concept-a", { parameters }));
    expect(map.get("concept-a")?.nextCorrectProbability).not.toBe(
      getConceptPfaPrediction(logs, "concept-a").nextCorrectProbability
    );
  });
});

describe("DEFAULT_PFA_PARAMETERS", () => {
  it("provisional な初期デフォルト値を持つ", () => {
    expect(DEFAULT_PFA_PARAMETERS).toEqual({
      intercept: 0,
      successWeight: 0.4,
      failureWeight: -0.4
    });
  });
});
