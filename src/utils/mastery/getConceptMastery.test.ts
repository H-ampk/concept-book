import { describe, expect, it } from "vitest";
import { QUIZ_ATTEMPT_LOG_SCHEMA_VERSION, type QuizAttemptLog } from "../../types/quiz";
import { calculateBktMastery } from "./bkt";
import { DEFAULT_BKT_PARAMETERS } from "./constants";
import { buildConceptMasteryMap, getConceptMastery } from "./getConceptMastery";
import { resolveConceptIdFromLog } from "../quiz/resolveConceptIdFromLog";

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

describe("resolveConceptIdFromLog", () => {
  it("questionConceptId を優先し、correctLinkedConceptId は使わない", () => {
    const log = baseLog({
      questionConceptId: "concept-q",
      conceptId: "concept-fallback",
      correctLinkedConceptId: "concept-correct-link",
      selectedLinkedConceptId: "concept-selected-link"
    });
    expect(resolveConceptIdFromLog(log)).toBe("concept-q");
  });

  it("questionConceptId が無ければ conceptId へ fallback する", () => {
    const log = baseLog({
      conceptId: "concept-fallback",
      correctLinkedConceptId: "concept-correct-link"
    });
    expect(resolveConceptIdFromLog(log)).toBe("concept-fallback");
  });

  it("selectedLinkedConceptId のみでは mastery 対象にしない", () => {
    const log = baseLog({ selectedLinkedConceptId: "concept-selected-only" });
    expect(resolveConceptIdFromLog(log)).toBeNull();
  });
});

describe("calculateBktMastery", () => {
  it("空ログは初期事前確率を返す", () => {
    expect(calculateBktMastery([])).toBe(DEFAULT_BKT_PARAMETERS.initialMastery);
  });

  it("連続正解で masteryProbability が継続的に上昇する", () => {
    const logs = [
      baseLog({ id: "1", correct: true, answeredAt: "2026-01-01T00:00:00.000Z" }),
      baseLog({ id: "2", correct: true, answeredAt: "2026-01-02T00:00:00.000Z" }),
      baseLog({ id: "3", correct: true, answeredAt: "2026-01-03T00:00:00.000Z" })
    ];
    const p1 = calculateBktMastery(logs.slice(0, 1));
    const p2 = calculateBktMastery(logs.slice(0, 2));
    const p3 = calculateBktMastery(logs);
    expect(p1).toBeGreaterThan(DEFAULT_BKT_PARAMETERS.initialMastery);
    expect(p2).toBeGreaterThan(p1);
    expect(p3).toBeGreaterThan(p2);
  });

  it("連続誤答で masteryProbability が低くなる", () => {
    const logs = [
      baseLog({ id: "1", correct: false, answeredAt: "2026-01-01T00:00:00.000Z" }),
      baseLog({ id: "2", correct: false, answeredAt: "2026-01-02T00:00:00.000Z" }),
      baseLog({ id: "3", correct: false, answeredAt: "2026-01-03T00:00:00.000Z" })
    ];
    expect(calculateBktMastery(logs)).toBeLessThan(DEFAULT_BKT_PARAMETERS.initialMastery);
  });

  it("正解後の誤答が mastery に反映される", () => {
    const afterCorrect = calculateBktMastery([
      baseLog({ id: "1", correct: true, answeredAt: "2026-01-01T00:00:00.000Z" })
    ]);
    const afterIncorrect = calculateBktMastery([
      baseLog({ id: "1", correct: true, answeredAt: "2026-01-01T00:00:00.000Z" }),
      baseLog({ id: "2", correct: false, answeredAt: "2026-01-02T00:00:00.000Z" })
    ]);
    expect(afterIncorrect).toBeLessThan(afterCorrect);
  });

  it("誤答後の連続正解で mastery が回復する", () => {
    const afterMiss = calculateBktMastery([
      baseLog({ id: "1", correct: false, answeredAt: "2026-01-01T00:00:00.000Z" })
    ]);
    const recovered = calculateBktMastery([
      baseLog({ id: "1", correct: false, answeredAt: "2026-01-01T00:00:00.000Z" }),
      baseLog({ id: "2", correct: true, answeredAt: "2026-01-02T00:00:00.000Z" }),
      baseLog({ id: "3", correct: true, answeredAt: "2026-01-03T00:00:00.000Z" }),
      baseLog({ id: "4", correct: true, answeredAt: "2026-01-04T00:00:00.000Z" })
    ]);
    expect(recovered).toBeGreaterThan(afterMiss);
  });

  it("入力順に依存せず answeredAt 順で同じ結果になる", () => {
    const chronological = [
      baseLog({ id: "1", correct: false, answeredAt: "2026-01-01T00:00:00.000Z" }),
      baseLog({ id: "2", correct: true, answeredAt: "2026-01-02T00:00:00.000Z" }),
      baseLog({ id: "3", correct: true, answeredAt: "2026-01-03T00:00:00.000Z" })
    ];
    const shuffled = [chronological[2], chronological[0], chronological[1]];
    expect(calculateBktMastery(shuffled)).toBe(calculateBktMastery(chronological));
    expect(shuffled[0].id).toBe("3");
  });
});

describe("getConceptMastery", () => {
  it("回答ログ0件は unlearned / confidence none", () => {
    const mastery = getConceptMastery([], "concept-a");
    expect(mastery.state).toBe("unlearned");
    expect(mastery.confidence).toBe("none");
    expect(mastery.freshness).toBe("never");
    expect(mastery.attemptCount).toBe(0);
  });

  it("1回だけ正解は mastery が上がり、confidence は low、state は insufficient-data", () => {
    const mastery = getConceptMastery(
      [baseLog({ questionConceptId: "concept-a", correct: true })],
      "concept-a"
    );
    expect(mastery.masteryScore).toBeGreaterThan(Math.round(DEFAULT_BKT_PARAMETERS.initialMastery * 100));
    expect(mastery.confidence).toBe("low");
    expect(mastery.state).toBe("insufficient-data");
  });

  it("questionConceptId と correctLinkedConceptId が異なるとき questionConceptId 側へ計上する", () => {
    const logs = [
      baseLog({
        questionConceptId: "asked",
        correctLinkedConceptId: "linked",
        correct: true
      })
    ];
    expect(getConceptMastery(logs, "asked").attemptCount).toBe(1);
    expect(getConceptMastery(logs, "linked").attemptCount).toBe(0);
    expect(getConceptMastery(logs, "linked").state).toBe("unlearned");
  });

  it("questionConceptId なし・conceptId ありは conceptId へ fallback する", () => {
    const logs = [baseLog({ conceptId: "fallback-id", correct: true })];
    expect(getConceptMastery(logs, "fallback-id").attemptCount).toBe(1);
  });

  it("selectedLinkedConceptId のみのログは mastery 対象にしない", () => {
    const logs = [
      baseLog({
        selectedLinkedConceptId: "confused",
        correct: false
      })
    ];
    expect(getConceptMastery(logs, "confused").attemptCount).toBe(0);
    expect(buildConceptMasteryMap(logs).size).toBe(0);
  });

  it("1/1 正解と多数回答で confidence に差が出る", () => {
    const one = getConceptMastery(
      [baseLog({ questionConceptId: "c", correct: true, answeredAt: "2026-01-01T00:00:00.000Z" })],
      "c"
    );
    const manyLogs = Array.from({ length: 8 }, (_, i) =>
      baseLog({
        id: `m-${i}`,
        questionConceptId: "c",
        correct: i !== 1,
        answeredAt: `2026-01-${String(i + 1).padStart(2, "0")}T00:00:00.000Z`
      })
    );
    const many = getConceptMastery(manyLogs, "c");
    expect(one.confidence).toBe("low");
    expect(many.confidence).toBe("high");
  });

  it("長期間未回答でも freshness だけ stale になり masteryScore は変わらない", () => {
    const logs = [
      baseLog({
        questionConceptId: "c",
        correct: true,
        answeredAt: "2026-01-01T00:00:00.000Z"
      })
    ];
    const soon = getConceptMastery(logs, "c", { now: new Date("2026-01-02T00:00:00.000Z") });
    const later = getConceptMastery(logs, "c", { now: new Date("2026-03-15T00:00:00.000Z") });
    expect(soon.freshness).toBe("fresh");
    expect(later.freshness).toBe("stale");
    expect(later.masteryScore).toBe(soon.masteryScore);
    expect(later.masteryProbability).toBe(soon.masteryProbability);
  });

  it("回答時間は masteryScore に含めない", () => {
    const slow = getConceptMastery(
      [baseLog({ questionConceptId: "c", correct: true, timeMs: 60_000 })],
      "c"
    );
    const fast = getConceptMastery(
      [baseLog({ questionConceptId: "c", correct: true, timeMs: 200 })],
      "c"
    );
    expect(slow.masteryScore).toBe(fast.masteryScore);
    expect(slow.avgReactionTimeMs).not.toBe(fast.avgReactionTimeMs);
  });
});
