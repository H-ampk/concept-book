import { describe, expect, it } from "vitest";
import { QUIZ_ATTEMPT_LOG_SCHEMA_VERSION, type QuizAttemptLog } from "../../types/quiz";
import { calculateBktMastery, calculateBktMasteryAfterObservation } from "./bkt";
import { DEFAULT_BKT_PARAMETERS } from "./constants";
import { getConceptMastery } from "./getConceptMastery";
import { getConceptMasteryHistory } from "./getConceptMasteryHistory";
import { resolveConceptIdFromLog } from "../quiz/resolveConceptIdFromLog";
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

describe("getConceptMasteryHistory", () => {
  it("入力 logs が逆順でも answeredAt 昇順で処理する", () => {
    const logs = [
      baseLog({
        id: "later",
        questionConceptId: "c",
        correct: true,
        answeredAt: "2026-01-03T00:00:00.000Z"
      }),
      baseLog({
        id: "earlier",
        questionConceptId: "c",
        correct: false,
        answeredAt: "2026-01-01T00:00:00.000Z"
      })
    ];
    const history = getConceptMasteryHistory(logs, "c");
    expect(history.map((point) => point.quizAttemptLogId)).toEqual(["earlier", "later"]);
    expect(history.map((point) => point.correct)).toEqual([false, true]);
  });

  it("attemptIndex は 1 始まりになる", () => {
    const logs = [
      baseLog({ id: "1", questionConceptId: "c", answeredAt: "2026-01-01T00:00:00.000Z" }),
      baseLog({ id: "2", questionConceptId: "c", answeredAt: "2026-01-02T00:00:00.000Z" }),
      baseLog({ id: "3", questionConceptId: "c", answeredAt: "2026-01-03T00:00:00.000Z" })
    ];
    expect(getConceptMasteryHistory(logs, "c").map((point) => point.attemptIndex)).toEqual([1, 2, 3]);
  });

  it("各 point の correct が元ログと一致する", () => {
    const logs = [
      baseLog({
        id: "1",
        questionConceptId: "c",
        correct: true,
        answeredAt: "2026-01-01T00:00:00.000Z"
      }),
      baseLog({
        id: "2",
        questionConceptId: "c",
        correct: false,
        answeredAt: "2026-01-02T00:00:00.000Z"
      }),
      baseLog({
        id: "3",
        questionConceptId: "c",
        correct: true,
        answeredAt: "2026-01-03T00:00:00.000Z"
      })
    ];
    expect(getConceptMasteryHistory(logs, "c").map((point) => point.correct)).toEqual([true, false, true]);
  });

  it("各回答の previous → current mastery が 1 回答分の BKT 更新と一致する", () => {
    const logs = [
      baseLog({
        id: "1",
        questionConceptId: "c",
        correct: false,
        answeredAt: "2026-01-01T00:00:00.000Z"
      }),
      baseLog({
        id: "2",
        questionConceptId: "c",
        correct: true,
        answeredAt: "2026-01-02T00:00:00.000Z"
      })
    ];
    const history = getConceptMasteryHistory(logs, "c");
    const initial = calculateBktMastery([]);
    expect(history[0].previousMasteryProbability).toBe(initial);
    expect(history[0].masteryProbability).toBe(
      calculateBktMasteryAfterObservation(initial, false, DEFAULT_BKT_PARAMETERS)
    );
    expect(history[1].previousMasteryProbability).toBe(history[0].masteryProbability);
    expect(history[1].masteryProbability).toBe(
      calculateBktMasteryAfterObservation(history[0].masteryProbability, true, DEFAULT_BKT_PARAMETERS)
    );
    expect(history[0].masteryScore).toBe(Math.round(history[0].masteryProbability * 100));
    expect(history[0].masteryDelta).toBe(history[0].masteryScore - history[0].previousMasteryScore);
  });

  it("履歴の最後の mastery が calculateBktMastery / getConceptMastery と一致する", () => {
    const logs = [
      baseLog({
        id: "2",
        questionConceptId: "c",
        correct: true,
        answeredAt: "2026-01-02T00:00:00.000Z"
      }),
      baseLog({
        id: "1",
        questionConceptId: "c",
        correct: false,
        answeredAt: "2026-01-01T00:00:00.000Z"
      }),
      baseLog({
        id: "3",
        questionConceptId: "c",
        correct: true,
        answeredAt: "2026-01-03T00:00:00.000Z"
      })
    ];
    const history = getConceptMasteryHistory(logs, "c");
    const last = history.at(-1);
    expect(last?.masteryProbability).toBe(calculateBktMastery(logs));
    expect(last?.masteryProbability).toBe(getConceptMastery(logs, "c").masteryProbability);
    expect(last?.masteryScore).toBe(getConceptMastery(logs, "c").masteryScore);
  });

  it("入力配列を破壊しない", () => {
    const logs = [
      baseLog({
        id: "2",
        questionConceptId: "c",
        correct: true,
        answeredAt: "2026-01-02T00:00:00.000Z"
      }),
      baseLog({
        id: "1",
        questionConceptId: "c",
        correct: false,
        answeredAt: "2026-01-01T00:00:00.000Z"
      })
    ];
    const snapshot = logs.map((log) => ({ ...log }));
    getConceptMasteryHistory(logs, "c");
    expect(logs).toEqual(snapshot);
    expect(logs[0].id).toBe("2");
  });

  it("指定した BktParameters が現在値と履歴の両方へ反映される", () => {
    const logs = [
      baseLog({
        id: "1",
        questionConceptId: "c",
        correct: true,
        answeredAt: "2026-01-01T00:00:00.000Z"
      }),
      baseLog({
        id: "2",
        questionConceptId: "c",
        correct: false,
        answeredAt: "2026-01-02T00:00:00.000Z"
      })
    ];
    const custom: BktParameters = {
      initialMastery: 0.5,
      learnProbability: 0.2,
      guessProbability: 0.05,
      slipProbability: 0.05
    };
    const defaultHistory = getConceptMasteryHistory(logs, "c");
    const customHistory = getConceptMasteryHistory(logs, "c", { parameters: custom });
    expect(customHistory.at(-1)?.masteryProbability).not.toBe(defaultHistory.at(-1)?.masteryProbability);
    expect(customHistory.at(-1)?.masteryProbability).toBe(calculateBktMastery(logs, custom));
    expect(customHistory.at(-1)?.masteryProbability).toBe(
      getConceptMastery(logs, "c", { parameters: custom }).masteryProbability
    );
    expect(customHistory[0].previousMasteryProbability).toBe(custom.initialMastery);
  });

  it("別 Concept のログが混ざっていても対象 Concept のみ使う", () => {
    const logs = [
      baseLog({
        id: "a1",
        questionConceptId: "a",
        correct: true,
        answeredAt: "2026-01-01T00:00:00.000Z"
      }),
      baseLog({
        id: "b1",
        questionConceptId: "b",
        correct: false,
        answeredAt: "2026-01-02T00:00:00.000Z"
      }),
      baseLog({
        id: "a2",
        questionConceptId: "a",
        correct: true,
        answeredAt: "2026-01-03T00:00:00.000Z"
      })
    ];
    const history = getConceptMasteryHistory(logs, "a");
    expect(history).toHaveLength(2);
    expect(history.map((point) => point.quizAttemptLogId)).toEqual(["a1", "a2"]);
    expect(history.at(-1)?.masteryProbability).toBe(
      calculateBktMastery(logs.filter((log) => log.questionConceptId === "a"))
    );
    expect(getConceptMasteryHistory(logs, "b")).toHaveLength(1);
  });

  it("resolveConceptIdFromLog の legacy / fallback と同じ Concept 帰属になる", () => {
    const logs = [
      baseLog({
        id: "asked",
        questionConceptId: "asked",
        conceptId: "fallback",
        correctLinkedConceptId: "linked",
        selectedLinkedConceptId: "selected",
        answeredAt: "2026-01-01T00:00:00.000Z"
      }),
      baseLog({
        id: "fallback",
        conceptId: "fallback",
        correctLinkedConceptId: "linked",
        answeredAt: "2026-01-02T00:00:00.000Z"
      }),
      baseLog({
        id: "unresolved",
        selectedLinkedConceptId: "selected",
        answeredAt: "2026-01-03T00:00:00.000Z"
      })
    ];
    expect(resolveConceptIdFromLog(logs[0])).toBe("asked");
    expect(resolveConceptIdFromLog(logs[1])).toBe("fallback");
    expect(resolveConceptIdFromLog(logs[2])).toBeNull();
    expect(getConceptMasteryHistory(logs, "asked").map((point) => point.quizAttemptLogId)).toEqual(["asked"]);
    expect(getConceptMasteryHistory(logs, "fallback").map((point) => point.quizAttemptLogId)).toEqual([
      "fallback"
    ]);
    expect(getConceptMasteryHistory(logs, "linked")).toEqual([]);
    expect(getConceptMasteryHistory(logs, "selected")).toEqual([]);
  });

  it("回答日時に大きな空白があっても mastery を減衰させず疑似点も作らない", () => {
    const logs = [
      baseLog({
        id: "sep",
        questionConceptId: "c",
        correct: true,
        answeredAt: "2026-09-01T00:00:00.000Z"
      }),
      baseLog({
        id: "oct",
        questionConceptId: "c",
        correct: true,
        answeredAt: "2026-10-01T00:00:00.000Z"
      })
    ];
    const history = getConceptMasteryHistory(logs, "c");
    expect(history).toHaveLength(2);
    expect(history[1].previousMasteryProbability).toBe(history[0].masteryProbability);
    expect(history[1].masteryProbability).toBe(
      calculateBktMasteryAfterObservation(history[0].masteryProbability, true)
    );
    expect(history[1].masteryProbability).toBeGreaterThan(history[0].masteryProbability);
    expect(history.map((point) => point.answeredAt)).toEqual([
      "2026-09-01T00:00:00.000Z",
      "2026-10-01T00:00:00.000Z"
    ]);
  });

  it("sessionId があるログでは履歴 point に保持する", () => {
    const logs = [
      baseLog({
        id: "with-session",
        questionConceptId: "c",
        sessionId: "session-1"
      })
    ];
    expect(getConceptMasteryHistory(logs, "c")[0].sessionId).toBe("session-1");
    expect(getConceptMasteryHistory([baseLog({ questionConceptId: "c" })], "c")[0].sessionId).toBeUndefined();
  });
});
