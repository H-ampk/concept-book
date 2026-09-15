import { describe, expect, it } from "vitest";
import { QUIZ_ATTEMPT_LOG_SCHEMA_VERSION, type QuizAttemptLog } from "../../types/quiz";
import {
  calculateBktMastery,
  calculateBktMasteryAfterEvidence,
  calculateBktMasteryAfterObservation,
  calculateBktNextCorrectProbability
} from "./bkt";
import { DEFAULT_BKT_PARAMETERS, DEFAULT_FREE_RESPONSE_BKT_EVIDENCE } from "./constants";
import type { BktParameters } from "./types";

const baseLog = (overrides: Partial<QuizAttemptLog>): QuizAttemptLog => ({
  id: "log-1",
  questionId: "q-1",
  questionType: "multiple-choice",
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

  it("四択のみのログでは旧 binary BKT と完全に同じ値になる", () => {
    const logs = [
      baseLog({ id: "1", correct: true, answeredAt: "2026-01-01T00:00:00.000Z" }),
      baseLog({ id: "2", correct: false, answeredAt: "2026-01-02T00:00:00.000Z" }),
      baseLog({ id: "3", correct: true, answeredAt: "2026-01-03T00:00:00.000Z" }),
      baseLog({ id: "4", correct: false, answeredAt: "2026-01-04T00:00:00.000Z" })
    ];
    const legacyUpdate = (prior: number, correct: boolean, parameters: BktParameters): number => {
      const { learnProbability, guessProbability, slipProbability } = parameters;
      const denom = correct
        ? prior * (1 - slipProbability) + (1 - prior) * guessProbability
        : prior * slipProbability + (1 - prior) * (1 - guessProbability);
      const posterior = correct
        ? (prior * (1 - slipProbability)) / denom
        : (prior * slipProbability) / denom;
      return posterior + (1 - posterior) * learnProbability;
    };
    let legacy = DEFAULT_BKT_PARAMETERS.initialMastery;
    for (const log of logs) {
      legacy = legacyUpdate(legacy, log.correct, DEFAULT_BKT_PARAMETERS);
    }
    expect(calculateBktMastery(logs)).toBe(legacy);
    expect(calculateBktMasteryAfterObservation(DEFAULT_BKT_PARAMETERS.initialMastery, true)).toBe(
      legacyUpdate(DEFAULT_BKT_PARAMETERS.initialMastery, true, DEFAULT_BKT_PARAMETERS)
    );
  });
});

describe("evidence-aware BKT", () => {
  it("初回 multiple-choice correct / incorrect は従来値になる", () => {
    expect(calculateBktMastery([baseLog({ correct: true })])).toBeCloseTo(0.5764705882);
    expect(calculateBktMastery([baseLog({ correct: false })])).toBeCloseTo(0.1272727273);
  });

  it("初回 free-response の correct / partial / incorrect は recall model になる", () => {
    const frCorrect = calculateBktMastery([
      baseLog({ questionType: "free-response", correct: true, selfEvaluation: "correct" })
    ]);
    const frPartial = calculateBktMastery([
      baseLog({ questionType: "free-response", correct: false, selfEvaluation: "partial" })
    ]);
    const frIncorrect = calculateBktMastery([
      baseLog({ questionType: "free-response", correct: false, selfEvaluation: "incorrect" })
    ]);
    expect(frCorrect).toBeCloseTo(0.7);
    expect(frPartial).toBeCloseTo(0.28);
    expect(frIncorrect).toBeCloseTo(0.1147540984);
  });

  it("同じ prior から free-response correct は multiple-choice correct より高い", () => {
    const mcCorrect = calculateBktMastery([baseLog({ correct: true })]);
    const frCorrect = calculateBktMastery([
      baseLog({ questionType: "free-response", correct: true, selfEvaluation: "correct" })
    ]);
    expect(frCorrect).toBeGreaterThan(mcCorrect);
  });

  it("partial は incorrect と同じ値にならない", () => {
    const partial = calculateBktMastery([
      baseLog({ questionType: "free-response", correct: false, selfEvaluation: "partial" })
    ]);
    const frIncorrect = calculateBktMastery([
      baseLog({ questionType: "free-response", correct: false, selfEvaluation: "incorrect" })
    ]);
    const mcIncorrect = calculateBktMastery([baseLog({ correct: false })]);
    expect(partial).not.toBeCloseTo(frIncorrect);
    expect(partial).not.toBeCloseTo(mcIncorrect);
    expect(partial).toBeGreaterThan(mcIncorrect);
  });

  it("free-response incorrect は multiple-choice incorrect より低い", () => {
    const mcIncorrect = calculateBktMastery([baseLog({ correct: false })]);
    const frIncorrect = calculateBktMastery([
      baseLog({ questionType: "free-response", correct: false, selfEvaluation: "incorrect" })
    ]);
    expect(frIncorrect).toBeLessThan(mcIncorrect);
  });

  it("evidence の強さは free-response correct > multiple-choice correct > partial > multiple-choice incorrect > free-response incorrect", () => {
    const mcCorrect = calculateBktMastery([baseLog({ correct: true })]);
    const mcIncorrect = calculateBktMastery([baseLog({ correct: false })]);
    const frCorrect = calculateBktMastery([
      baseLog({ questionType: "free-response", correct: true, selfEvaluation: "correct" })
    ]);
    const frPartial = calculateBktMastery([
      baseLog({ questionType: "free-response", correct: false, selfEvaluation: "partial" })
    ]);
    const frIncorrect = calculateBktMastery([
      baseLog({ questionType: "free-response", correct: false, selfEvaluation: "incorrect" })
    ]);
    expect(frCorrect).toBeGreaterThan(mcCorrect);
    expect(mcCorrect).toBeGreaterThan(frPartial);
    expect(frPartial).toBeGreaterThan(mcIncorrect);
    expect(mcIncorrect).toBeGreaterThan(frIncorrect);
  });

  it("全結果が finite かつ 0〜1", () => {
    const logs: QuizAttemptLog[][] = [
      [],
      [baseLog({ correct: true })],
      [baseLog({ correct: false })],
      [baseLog({ questionType: "free-response", correct: true, selfEvaluation: "correct" })],
      [baseLog({ questionType: "free-response", correct: false, selfEvaluation: "partial" })],
      [baseLog({ questionType: "free-response", correct: false, selfEvaluation: "incorrect" })],
      [
        baseLog({ id: "1", correct: true, answeredAt: "2026-01-01T00:00:00.000Z" }),
        baseLog({
          id: "2",
          questionType: "free-response",
          correct: false,
          selfEvaluation: "partial",
          answeredAt: "2026-01-02T00:00:00.000Z"
        })
      ]
    ];
    for (const caseLogs of logs) {
      const mastery = calculateBktMastery(caseLogs);
      expect(mastery).toBeGreaterThanOrEqual(0);
      expect(mastery).toBeLessThanOrEqual(1);
      expect(Number.isFinite(mastery)).toBe(true);
    }
  });

  it("入力配列を破壊しない", () => {
    const logs = [
      baseLog({ id: "2", correct: true, answeredAt: "2026-01-02T00:00:00.000Z" }),
      baseLog({
        id: "1",
        questionType: "free-response",
        correct: false,
        selfEvaluation: "partial",
        answeredAt: "2026-01-01T00:00:00.000Z"
      })
    ];
    const snapshot = logs.map((log) => ({ ...log }));
    calculateBktMastery(logs);
    expect(logs).toEqual(snapshot);
    expect(logs[0].id).toBe("2");
  });

  it("入力順に依存せず answeredAt 順で同じ結果になる", () => {
    const chronological = [
      baseLog({
        id: "1",
        questionType: "free-response",
        correct: false,
        selfEvaluation: "partial",
        answeredAt: "2026-01-01T00:00:00.000Z"
      }),
      baseLog({ id: "2", correct: true, answeredAt: "2026-01-02T00:00:00.000Z" }),
      baseLog({
        id: "3",
        questionType: "free-response",
        correct: true,
        selfEvaluation: "correct",
        answeredAt: "2026-01-03T00:00:00.000Z"
      })
    ];
    const shuffled = [chronological[2], chronological[0], chronological[1]];
    expect(calculateBktMastery(shuffled)).toBe(calculateBktMastery(chronological));
    expect(shuffled[0].id).toBe("3");
  });

  it("custom BktParameters を渡した場合も multiple-choice はその guess / slip を使う", () => {
    const custom: BktParameters = {
      initialMastery: 0.5,
      learnProbability: 0.2,
      guessProbability: 0.05,
      slipProbability: 0.3
    };
    const fromLog = calculateBktMastery([baseLog({ correct: true })], custom);
    const fromBinary = calculateBktMasteryAfterObservation(custom.initialMastery, true, custom);
    expect(fromLog).toBe(fromBinary);
    expect(fromLog).not.toBe(calculateBktMastery([baseLog({ correct: true })]));
  });

  it("likelihood 更新は 0 除算でも finite な [0, 1] を返す", () => {
    const mastery = calculateBktMasteryAfterEvidence(
      0.4,
      { probabilityIfLearned: 0, probabilityIfNotLearned: 0 },
      0.1
    );
    expect(mastery).toBeCloseTo(0.4 + (1 - 0.4) * 0.1);
    expect(Number.isFinite(mastery)).toBe(true);
  });
});

describe("calculateBktNextCorrectProbability question type", () => {
  it("target 未指定は multiple-choice observation model", () => {
    const logs = [baseLog({ correct: true })];
    expect(calculateBktNextCorrectProbability(logs)).toBeCloseTo(
      observationModel(calculateBktMastery(logs), DEFAULT_BKT_PARAMETERS)
    );
  });

  it("target が free-response なら recall の correct probability を使う", () => {
    const logs = [baseLog({ correct: true })];
    const mastery = calculateBktMastery(logs);
    const expected =
      mastery * DEFAULT_FREE_RESPONSE_BKT_EVIDENCE.correct.probabilityIfLearned +
      (1 - mastery) * DEFAULT_FREE_RESPONSE_BKT_EVIDENCE.correct.probabilityIfNotLearned;
    expect(
      calculateBktNextCorrectProbability(logs, DEFAULT_BKT_PARAMETERS, {
        targetQuestionType: "free-response"
      })
    ).toBeCloseTo(expected);
    expect(
      calculateBktNextCorrectProbability(logs, DEFAULT_BKT_PARAMETERS, {
        targetQuestionType: "free-response"
      })
    ).not.toBeCloseTo(calculateBktNextCorrectProbability(logs));
  });
});
