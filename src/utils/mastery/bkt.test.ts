import { describe, expect, it } from "vitest";
import { QUIZ_ATTEMPT_LOG_SCHEMA_VERSION, type QuizAttemptLog } from "../../types/quiz";
import {
  calculateBktMastery,
  calculateBktMasteryAfterObservation,
  calculateBktNextCorrectProbability
} from "./bkt";
import { DEFAULT_BKT_PARAMETERS } from "./constants";
import type { BktParameters } from "./types";

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

const observationModel = (masteryProbability: number, parameters: BktParameters): number =>
  masteryProbability * (1 - parameters.slipProbability) + (1 - masteryProbability) * parameters.guessProbability;

describe("calculateBktNextCorrectProbability", () => {
  it("履歴0件では initialMastery を prior とした observation model を返す", () => {
    const expected = observationModel(DEFAULT_BKT_PARAMETERS.initialMastery, DEFAULT_BKT_PARAMETERS);
    expect(calculateBktNextCorrectProbability([])).toBeCloseTo(expected);
    expect(calculateBktNextCorrectProbability([])).toBeCloseTo(0.34);
  });

  it("masteryProbability をそのまま次回正答確率として使わない", () => {
    const mastery = calculateBktMastery([]);
    const nextCorrect = calculateBktNextCorrectProbability([]);
    expect(mastery).toBe(DEFAULT_BKT_PARAMETERS.initialMastery);
    expect(nextCorrect).not.toBe(mastery);
    expect(nextCorrect).toBeCloseTo(observationModel(mastery, DEFAULT_BKT_PARAMETERS));
  });

  it("履歴反映後の P(L) に observation model を適用する", () => {
    const logs = [
      baseLog({ id: "1", correct: true, answeredAt: "2026-01-01T00:00:00.000Z" }),
      baseLog({ id: "2", correct: false, answeredAt: "2026-01-02T00:00:00.000Z" })
    ];
    const mastery = calculateBktMastery(logs);
    expect(calculateBktNextCorrectProbability(logs)).toBeCloseTo(
      observationModel(mastery, DEFAULT_BKT_PARAMETERS)
    );
  });

  it("probability は常に 0〜1 の finite", () => {
    const cases: QuizAttemptLog[][] = [
      [],
      [baseLog({ correct: true })],
      [baseLog({ correct: false })],
      [
        baseLog({ id: "1", correct: true, answeredAt: "2026-01-01T00:00:00.000Z" }),
        baseLog({ id: "2", correct: true, answeredAt: "2026-01-02T00:00:00.000Z" }),
        baseLog({ id: "3", correct: false, answeredAt: "2026-01-03T00:00:00.000Z" })
      ]
    ];
    for (const logs of cases) {
      const probability = calculateBktNextCorrectProbability(logs);
      expect(probability).toBeGreaterThanOrEqual(0);
      expect(probability).toBeLessThanOrEqual(1);
      expect(Number.isFinite(probability)).toBe(true);
    }
  });

  it("parameters を差し替えると予測が変わる", () => {
    const logs = [baseLog({ correct: true })];
    const defaultP = calculateBktNextCorrectProbability(logs);
    const custom: BktParameters = {
      initialMastery: 0.5,
      learnProbability: 0.2,
      guessProbability: 0.05,
      slipProbability: 0.05
    };
    const customP = calculateBktNextCorrectProbability(logs, custom);
    expect(customP).not.toBe(defaultP);
    expect(customP).toBeCloseTo(observationModel(calculateBktMastery(logs, custom), custom));
  });

  it("入力配列を破壊しない", () => {
    const logs = [
      baseLog({ id: "2", correct: true, answeredAt: "2026-01-02T00:00:00.000Z" }),
      baseLog({ id: "1", correct: false, answeredAt: "2026-01-01T00:00:00.000Z" })
    ];
    const snapshot = logs.map((log) => ({ ...log }));
    calculateBktNextCorrectProbability(logs);
    expect(logs).toEqual(snapshot);
    expect(logs[0].id).toBe("2");
  });
});

describe("calculateBktMasteryAfterObservation", () => {
  it("1回答分の更新を畳み込んだ結果が calculateBktMastery と一致する", () => {
    const logs = [
      baseLog({ id: "1", correct: true, answeredAt: "2026-01-01T00:00:00.000Z" }),
      baseLog({ id: "2", correct: false, answeredAt: "2026-01-02T00:00:00.000Z" }),
      baseLog({ id: "3", correct: true, answeredAt: "2026-01-03T00:00:00.000Z" })
    ];
    let folded = DEFAULT_BKT_PARAMETERS.initialMastery;
    for (const log of logs) {
      folded = calculateBktMasteryAfterObservation(folded, log.correct);
    }
    expect(calculateBktMastery(logs)).toBe(folded);
  });
});
