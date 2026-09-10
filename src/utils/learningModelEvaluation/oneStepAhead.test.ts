import { describe, expect, it, vi } from "vitest";
import { QUIZ_ATTEMPT_LOG_SCHEMA_VERSION, type QuizAttemptLog } from "../../types/quiz";
import { calculateBktNextCorrectProbability } from "../mastery/bkt";
import { DEFAULT_BKT_PARAMETERS } from "../mastery/constants";
import { DEFAULT_PFA_PARAMETERS } from "../pfa/constants";
import { getConceptPfaPrediction } from "../pfa/getConceptPfaPrediction";
import { calculatePfaNextCorrectProbability } from "../pfa/pfa";
import { buildOneStepAheadPredictionSeries } from "./oneStepAhead";
import {
  BKT_LEARNING_MODEL_ID,
  createBktLearningModelPredictor,
  createPfaLearningModelPredictor,
  PFA_LEARNING_MODEL_ID
} from "./predictors";
import type { LearningModelPredictor } from "./types";

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

const historyIdsOf = (predictor: { mock: { calls: unknown[][] } }, callIndex: number): string[] => {
  const args = predictor.mock.calls[callIndex]?.[0] as { historyLogs: QuizAttemptLog[] } | undefined;
  return (args?.historyLogs ?? []).map((log) => log.id);
};

const createSpyPredictor = (
  id: string,
  impl: LearningModelPredictor["predictNextCorrectProbability"] = () => 0.5
): LearningModelPredictor & { predictNextCorrectProbability: ReturnType<typeof vi.fn> } => {
  const predictNextCorrectProbability = vi.fn(impl);
  return { id, predictNextCorrectProbability };
};

describe("buildOneStepAheadPredictionSeries", () => {
  it("predictor が null を返した場合、その model / attempt の prediction point は生成しない", () => {
    const logs = [
      baseLog({ id: "a", questionConceptId: "concept-a", answeredAt: "2026-01-01T00:00:00.000Z" }),
      baseLog({ id: "b", questionConceptId: "concept-a", answeredAt: "2026-01-02T00:00:00.000Z" })
    ];
    const predictor = createSpyPredictor("nullable", ({ historyLogs }) => (historyLogs.length === 0 ? null : 0.4));
    const points = buildOneStepAheadPredictionSeries(logs, [predictor]);
    expect(points).toHaveLength(1);
    expect(points[0]).toMatchObject({
      attemptId: "b",
      model: "nullable",
      predictedCorrectProbability: 0.4,
      historyCount: 1
    });
  });

  it("1回答目を BKT prior だけで予測できる", () => {
    const logs = [baseLog({ id: "first", questionConceptId: "concept-a" })];
    const points = buildOneStepAheadPredictionSeries(logs, [createBktLearningModelPredictor()]);
    expect(points).toHaveLength(1);
    expect(points[0].historyCount).toBe(0);
    expect(points[0].predictedCorrectProbability).toBe(calculateBktNextCorrectProbability([]));
    expect(points[0].predictedCorrectProbability).toBeCloseTo(0.34);
    expect(points[0].model).toBe(BKT_LEARNING_MODEL_ID);
  });

  it("1回答目を PFA prior だけで予測できる", () => {
    const logs = [baseLog({ id: "first", questionConceptId: "concept-a" })];
    const points = buildOneStepAheadPredictionSeries(logs, [createPfaLearningModelPredictor()]);
    expect(points).toHaveLength(1);
    expect(points[0].historyCount).toBe(0);
    expect(points[0].predictedCorrectProbability).toBe(calculatePfaNextCorrectProbability(0, 0));
    expect(points[0].predictedCorrectProbability).toBeCloseTo(0.5);
    expect(points[0].model).toBe(PFA_LEARNING_MODEL_ID);
  });

  it("BKT / PFA の2回答目は1回答目だけの履歴から予測する", () => {
    const first = baseLog({
      id: "first",
      questionConceptId: "concept-a",
      correct: true,
      answeredAt: "2026-01-01T00:00:00.000Z"
    });
    const second = baseLog({
      id: "second",
      questionConceptId: "concept-a",
      correct: false,
      answeredAt: "2026-01-02T00:00:00.000Z"
    });
    const points = buildOneStepAheadPredictionSeries(
      [first, second],
      [createBktLearningModelPredictor(), createPfaLearningModelPredictor()]
    );
    const bktSecond = points.find((point) => point.model === "bkt" && point.attemptId === "second");
    const pfaSecond = points.find((point) => point.model === "pfa" && point.attemptId === "second");
    expect(bktSecond?.historyCount).toBe(1);
    expect(pfaSecond?.historyCount).toBe(1);
    expect(bktSecond?.predictedCorrectProbability).toBe(calculateBktNextCorrectProbability([first]));
    expect(pfaSecond?.predictedCorrectProbability).toBe(
      getConceptPfaPrediction([first], "concept-a").nextCorrectProbability
    );
    expect(bktSecond?.predictedCorrectProbability).not.toBe(
      calculateBktNextCorrectProbability([first, second])
    );
  });

  it("2回答目の prediction が1回答目だけを利用する", () => {
    const first = baseLog({
      id: "first",
      questionConceptId: "concept-a",
      correct: true,
      answeredAt: "2026-01-01T00:00:00.000Z"
    });
    const second = baseLog({
      id: "second",
      questionConceptId: "concept-a",
      correct: false,
      answeredAt: "2026-01-02T00:00:00.000Z"
    });
    const spy = createSpyPredictor("spy");
    buildOneStepAheadPredictionSeries([first, second], [spy]);
    expect(historyIdsOf(spy.predictNextCorrectProbability, 0)).toEqual([]);
    expect(historyIdsOf(spy.predictNextCorrectProbability, 1)).toEqual(["first"]);
    expect(spy.predictNextCorrectProbability.mock.calls[1][0]).toMatchObject({
      conceptId: "concept-a"
    });
  });

  it("target 自身が predictor history に入っていない", () => {
    const logs = [
      baseLog({ id: "a", questionConceptId: "concept-a", answeredAt: "2026-01-01T00:00:00.000Z" }),
      baseLog({ id: "b", questionConceptId: "concept-a", answeredAt: "2026-01-02T00:00:00.000Z" }),
      baseLog({ id: "c", questionConceptId: "concept-a", answeredAt: "2026-01-03T00:00:00.000Z" })
    ];
    const spy = createSpyPredictor("spy");
    buildOneStepAheadPredictionSeries(logs, [spy]);
    const targets = ["a", "b", "c"];
    spy.predictNextCorrectProbability.mock.calls.forEach((call, index) => {
      const history = (call[0] as { historyLogs: QuizAttemptLog[] }).historyLogs;
      expect(history.map((log) => log.id)).not.toContain(targets[index]);
    });
  });

  it("target より未来のログが predictor history に入っていない", () => {
    const logs = [
      baseLog({ id: "past", questionConceptId: "concept-a", answeredAt: "2026-01-01T00:00:00.000Z" }),
      baseLog({ id: "target", questionConceptId: "concept-a", answeredAt: "2026-01-02T00:00:00.000Z" }),
      baseLog({ id: "future", questionConceptId: "concept-a", answeredAt: "2026-01-03T00:00:00.000Z" })
    ];
    const spy = createSpyPredictor("spy");
    buildOneStepAheadPredictionSeries(logs, [spy]);
    expect(historyIdsOf(spy.predictNextCorrectProbability, 1)).toEqual(["past"]);
    expect(historyIdsOf(spy.predictNextCorrectProbability, 1)).not.toContain("future");
    expect(historyIdsOf(spy.predictNextCorrectProbability, 1)).not.toContain("target");
  });

  it("入力配列が時系列でなくても同じ結果になる", () => {
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
        answeredAt: "2026-01-02T00:00:00.000Z"
      }),
      baseLog({
        id: "3",
        questionConceptId: "concept-a",
        correct: true,
        answeredAt: "2026-01-03T00:00:00.000Z"
      })
    ];
    const reversed = [chronological[2], chronological[1], chronological[0]];
    const predictors = [createBktLearningModelPredictor(), createPfaLearningModelPredictor()];
    expect(buildOneStepAheadPredictionSeries(reversed, predictors)).toEqual(
      buildOneStepAheadPredictionSeries(chronological, predictors)
    );
  });

  it("入力配列を並び替えても prediction が変化しない", () => {
    const logs = [
      baseLog({ id: "c", questionConceptId: "concept-a", answeredAt: "2026-01-03T00:00:00.000Z", correct: true }),
      baseLog({ id: "a", questionConceptId: "concept-a", answeredAt: "2026-01-01T00:00:00.000Z", correct: false }),
      baseLog({ id: "b", questionConceptId: "concept-a", answeredAt: "2026-01-02T00:00:00.000Z", correct: true })
    ];
    const shuffled = [logs[1], logs[2], logs[0]];
    const another = [logs[2], logs[0], logs[1]];
    const predictors = [createBktLearningModelPredictor(), createPfaLearningModelPredictor()];
    expect(buildOneStepAheadPredictionSeries(shuffled, predictors)).toEqual(
      buildOneStepAheadPredictionSeries(logs, predictors)
    );
    expect(buildOneStepAheadPredictionSeries(another, predictors)).toEqual(
      buildOneStepAheadPredictionSeries(logs, predictors)
    );
  });

  it("同一 answeredAt の複数回答が互いを history として利用しない", () => {
    const a = baseLog({
      id: "a",
      questionConceptId: "concept-a",
      answeredAt: "2026-01-01T10:00:00.000Z",
      correct: true
    });
    const b = baseLog({
      id: "b",
      questionConceptId: "concept-a",
      answeredAt: "2026-01-01T10:00:00.000Z",
      correct: false
    });
    const spy = createSpyPredictor("spy");
    buildOneStepAheadPredictionSeries([a, b], [spy]);
    expect(historyIdsOf(spy.predictNextCorrectProbability, 0)).toEqual([]);
    expect(historyIdsOf(spy.predictNextCorrectProbability, 1)).toEqual([]);
    expect(historyIdsOf(spy.predictNextCorrectProbability, 0)).not.toContain("b");
    expect(historyIdsOf(spy.predictNextCorrectProbability, 1)).not.toContain("a");
  });

  it("同一 timestamp group 後の回答では group 全体が history に含まれる", () => {
    const a = baseLog({
      id: "a",
      questionConceptId: "concept-a",
      answeredAt: "2026-01-01T10:00:00.000Z",
      correct: true
    });
    const b = baseLog({
      id: "b",
      questionConceptId: "concept-a",
      answeredAt: "2026-01-01T10:00:00.000Z",
      correct: false
    });
    const c = baseLog({
      id: "c",
      questionConceptId: "concept-a",
      answeredAt: "2026-01-01T10:05:00.000Z",
      correct: true
    });
    const spy = createSpyPredictor("spy");
    buildOneStepAheadPredictionSeries([c, b, a], [spy]);
    expect(historyIdsOf(spy.predictNextCorrectProbability, 2).sort()).toEqual(["a", "b"]);
  });

  it("不正 answeredAt を target / history に利用しない", () => {
    const validPast = baseLog({
      id: "past",
      questionConceptId: "concept-a",
      answeredAt: "2026-01-01T00:00:00.000Z"
    });
    const invalid = baseLog({
      id: "invalid",
      questionConceptId: "concept-a",
      answeredAt: "not-a-date",
      correct: false
    });
    const validLater = baseLog({
      id: "later",
      questionConceptId: "concept-a",
      answeredAt: "2026-01-02T00:00:00.000Z"
    });
    const spy = createSpyPredictor("spy");
    const points = buildOneStepAheadPredictionSeries([validLater, invalid, validPast], [spy]);
    expect(points.map((point) => point.attemptId)).toEqual(["past", "later"]);
    expect(historyIdsOf(spy.predictNextCorrectProbability, 0)).toEqual([]);
    expect(historyIdsOf(spy.predictNextCorrectProbability, 1)).toEqual(["past"]);
    expect(historyIdsOf(spy.predictNextCorrectProbability, 1)).not.toContain("invalid");
  });

  it("Concept A の履歴が Concept B の predictor history に混ざらない", () => {
    const logs = [
      baseLog({
        id: "a1",
        questionConceptId: "concept-a",
        answeredAt: "2026-01-01T00:00:00.000Z",
        correct: true
      }),
      baseLog({
        id: "b1",
        questionConceptId: "concept-b",
        answeredAt: "2026-01-02T00:00:00.000Z",
        correct: false
      }),
      baseLog({
        id: "a2",
        questionConceptId: "concept-a",
        answeredAt: "2026-01-03T00:00:00.000Z",
        correct: true
      })
    ];
    const spy = createSpyPredictor("spy");
    buildOneStepAheadPredictionSeries(logs, [spy]);
    expect(spy.predictNextCorrectProbability.mock.calls[1][0]).toMatchObject({ conceptId: "concept-b" });
    expect(historyIdsOf(spy.predictNextCorrectProbability, 1)).toEqual([]);
    expect(historyIdsOf(spy.predictNextCorrectProbability, 2)).toEqual(["a1"]);
    expect(historyIdsOf(spy.predictNextCorrectProbability, 2)).not.toContain("b1");
  });

  it("Concept を resolve できないログを評価しない", () => {
    const unresolved = baseLog({
      id: "orphan",
      selectedLinkedConceptId: "only-selected",
      correctLinkedConceptId: "only-correct",
      answeredAt: "2026-01-01T00:00:00.000Z"
    });
    const resolved = baseLog({
      id: "kept",
      questionConceptId: "concept-a",
      answeredAt: "2026-01-02T00:00:00.000Z"
    });
    const spy = createSpyPredictor("spy");
    const points = buildOneStepAheadPredictionSeries([unresolved, resolved], [spy]);
    expect(points).toHaveLength(1);
    expect(points[0].attemptId).toBe("kept");
    expect(historyIdsOf(spy.predictNextCorrectProbability, 0)).toEqual([]);
    expect(spy.predictNextCorrectProbability).toHaveBeenCalledTimes(1);
  });

  it("questionConceptId を conceptId より優先する", () => {
    const logs = [
      baseLog({
        id: "asked",
        questionConceptId: "concept-asked",
        conceptId: "concept-fallback",
        answeredAt: "2026-01-01T00:00:00.000Z"
      })
    ];
    const spy = createSpyPredictor("spy");
    const points = buildOneStepAheadPredictionSeries(logs, [spy]);
    expect(points[0].conceptId).toBe("concept-asked");
    expect(spy.predictNextCorrectProbability.mock.calls[0][0]).toMatchObject({
      conceptId: "concept-asked"
    });
  });

  it("複数 predictor を attempt ごとに入力順で並べる", () => {
    const logs = [
      baseLog({ id: "1", questionConceptId: "concept-a", answeredAt: "2026-01-01T00:00:00.000Z" }),
      baseLog({ id: "2", questionConceptId: "concept-a", answeredAt: "2026-01-02T00:00:00.000Z" })
    ];
    const points = buildOneStepAheadPredictionSeries(logs, [
      createBktLearningModelPredictor(),
      createPfaLearningModelPredictor()
    ]);
    expect(points.map((point) => `${point.model}:${point.attemptId}`)).toEqual([
      "bkt:1",
      "pfa:1",
      "bkt:2",
      "pfa:2"
    ]);
  });

  it("同じログ・parameter から deterministic な結果になる", () => {
    const logs = [
      baseLog({ id: "1", questionConceptId: "concept-a", correct: true, answeredAt: "2026-01-01T00:00:00.000Z" }),
      baseLog({ id: "2", questionConceptId: "concept-a", correct: false, answeredAt: "2026-01-02T00:00:00.000Z" })
    ];
    const predictors = [createBktLearningModelPredictor(), createPfaLearningModelPredictor()];
    expect(buildOneStepAheadPredictionSeries(logs, predictors)).toEqual(
      buildOneStepAheadPredictionSeries(logs, predictors)
    );
  });

  it("元の logs 配列を破壊しない", () => {
    const logs = [
      baseLog({ id: "2", questionConceptId: "concept-a", answeredAt: "2026-01-02T00:00:00.000Z" }),
      baseLog({ id: "1", questionConceptId: "concept-a", answeredAt: "2026-01-01T00:00:00.000Z" })
    ];
    const snapshot = logs.map((log) => ({ ...log }));
    buildOneStepAheadPredictionSeries(logs, [createBktLearningModelPredictor()]);
    expect(logs).toEqual(snapshot);
    expect(logs[0].id).toBe("2");
  });

  it("不正な predictor 出力を silently clamp せず point を生成しない", () => {
    const logs = [baseLog({ id: "a", questionConceptId: "concept-a" })];
    const invalidValues = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -0.1, 1.1];
    for (const value of invalidValues) {
      const points = buildOneStepAheadPredictionSeries(logs, [createSpyPredictor("bad", () => value)]);
      expect(points).toEqual([]);
    }
  });

  it("null predictor を 0 として評価しない", () => {
    const logs = [baseLog({ id: "a", questionConceptId: "concept-a", correct: true })];
    const points = buildOneStepAheadPredictionSeries(logs, [createSpyPredictor("none", () => null)]);
    expect(points).toEqual([]);
    expect(points.some((point) => point.predictedCorrectProbability === 0)).toBe(false);
  });
});

describe("createBktLearningModelPredictor", () => {
  it("DEFAULT_BKT_PARAMETERS で calculateBktNextCorrectProbability と一致する", () => {
    const history = [
      baseLog({ id: "1", questionConceptId: "concept-a", correct: true, answeredAt: "2026-01-01T00:00:00.000Z" })
    ];
    const predictor = createBktLearningModelPredictor();
    expect(predictor.id).toBe(BKT_LEARNING_MODEL_ID);
    expect(
      predictor.predictNextCorrectProbability({ conceptId: "concept-a", historyLogs: history })
    ).toBe(calculateBktNextCorrectProbability(history, DEFAULT_BKT_PARAMETERS));
  });

  it("parameters を差し替えできる", () => {
    const history = [baseLog({ id: "1", questionConceptId: "concept-a", correct: true })];
    const custom = {
      initialMastery: 0.4,
      learnProbability: 0.3,
      guessProbability: 0.1,
      slipProbability: 0.05
    };
    const customP = createBktLearningModelPredictor(custom).predictNextCorrectProbability({
      conceptId: "concept-a",
      historyLogs: history
    });
    const defaultP = createBktLearningModelPredictor().predictNextCorrectProbability({
      conceptId: "concept-a",
      historyLogs: history
    });
    expect(customP).toBe(calculateBktNextCorrectProbability(history, custom));
    expect(customP).not.toBe(defaultP);
  });

  it("probability は 0〜1 の finite", () => {
    const histories: QuizAttemptLog[][] = [
      [],
      [baseLog({ correct: true })],
      [baseLog({ id: "1", correct: false }), baseLog({ id: "2", correct: true })]
    ];
    const predictor = createBktLearningModelPredictor();
    for (const historyLogs of histories) {
      const probability = predictor.predictNextCorrectProbability({
        conceptId: "concept-a",
        historyLogs
      });
      expect(probability).not.toBeNull();
      expect(probability).toBeGreaterThanOrEqual(0);
      expect(probability).toBeLessThanOrEqual(1);
      expect(Number.isFinite(probability)).toBe(true);
    }
  });
});

describe("createPfaLearningModelPredictor", () => {
  it("既存 getConceptPfaPrediction を再利用する", () => {
    const history = [
      baseLog({ id: "1", questionConceptId: "concept-a", correct: true }),
      baseLog({ id: "2", questionConceptId: "concept-a", correct: false })
    ];
    const predictor = createPfaLearningModelPredictor();
    expect(predictor.id).toBe(PFA_LEARNING_MODEL_ID);
    expect(
      predictor.predictNextCorrectProbability({ conceptId: "concept-a", historyLogs: history })
    ).toBe(getConceptPfaPrediction(history, "concept-a").nextCorrectProbability);
    expect(
      predictor.predictNextCorrectProbability({ conceptId: "concept-a", historyLogs: [] })
    ).toBe(calculatePfaNextCorrectProbability(0, 0, DEFAULT_PFA_PARAMETERS));
  });

  it("parameters を差し替えできる", () => {
    const history = [
      baseLog({ id: "1", questionConceptId: "concept-a", correct: true }),
      baseLog({ id: "2", questionConceptId: "concept-a", correct: true })
    ];
    const custom = { intercept: 0, successWeight: 1, failureWeight: -1 };
    const customP = createPfaLearningModelPredictor(custom).predictNextCorrectProbability({
      conceptId: "concept-a",
      historyLogs: history
    });
    const defaultP = createPfaLearningModelPredictor().predictNextCorrectProbability({
      conceptId: "concept-a",
      historyLogs: history
    });
    expect(customP).toBe(getConceptPfaPrediction(history, "concept-a", { parameters: custom }).nextCorrectProbability);
    expect(customP).not.toBe(defaultP);
  });

  it("probability は 0〜1 の finite", () => {
    const predictor = createPfaLearningModelPredictor();
    const histories: QuizAttemptLog[][] = [
      [],
      [baseLog({ questionConceptId: "concept-a", correct: true })],
      [
        baseLog({ id: "1", questionConceptId: "concept-a", correct: true }),
        baseLog({ id: "2", questionConceptId: "concept-a", correct: false })
      ]
    ];
    for (const historyLogs of histories) {
      const probability = predictor.predictNextCorrectProbability({
        conceptId: "concept-a",
        historyLogs
      });
      expect(probability).not.toBeNull();
      expect(probability).toBeGreaterThanOrEqual(0);
      expect(probability).toBeLessThanOrEqual(1);
      expect(Number.isFinite(probability)).toBe(true);
    }
  });
});
