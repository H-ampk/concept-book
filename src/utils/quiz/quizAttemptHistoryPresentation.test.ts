import { describe, expect, it } from "vitest";
import { QUIZ_ATTEMPT_LOG_SCHEMA_VERSION, type QuizAttemptLog } from "../../types/quiz";
import {
  matchesQuizAttemptHistoryResultFilter,
  matchesQuizAttemptHistorySearch,
  matchesQuizAttemptQuestionTypeFilter,
  presentQuizAttemptHistory,
  quizAttemptHistoryEmptySnapshot,
  resolveQuizAttemptHistoryResultKind,
  summarizeQuizAttemptHistoryOutcomes
} from "./quizAttemptHistoryPresentation";

const baseLog = (overrides: Partial<QuizAttemptLog> = {}): QuizAttemptLog => ({
  id: "log_1",
  questionId: "q1",
  questionType: "multiple-choice",
  questionPromptSnapshot: "問い",
  selectedChoiceId: "c1",
  selectedChoiceTextSnapshot: "A",
  correctChoiceId: "c2",
  correctChoiceTextSnapshot: "B",
  correct: false,
  startedAt: "2026-01-01T00:00:00.000Z",
  answeredAt: "2026-01-01T00:00:01.000Z",
  timeMs: 1000,
  schemaVersion: QUIZ_ATTEMPT_LOG_SCHEMA_VERSION,
  ...overrides
});

describe("presentQuizAttemptHistory", () => {
  it("multiple-choice の選択・正答・不正解を表示する", () => {
    const view = presentQuizAttemptHistory(
      baseLog({
        questionType: "multiple-choice",
        selectedChoiceTextSnapshot: "A",
        correctChoiceTextSnapshot: "B",
        correct: false
      })
    );
    expect(view.formatLabel).toBe("四択（再認）");
    expect(view.answerLabel).toBe("選んだ選択肢");
    expect(view.answerText).toBe("A");
    expect(view.referenceLabel).toBe("正解選択肢");
    expect(view.referenceText).toBe("B");
    expect(view.resultLabel).toBe("不正解");
    expect(view.resultKind).toBe("incorrect");
  });

  it("free-response correct は入力式として正解を表示する", () => {
    const view = presentQuizAttemptHistory(
      baseLog({
        questionType: "free-response",
        userAnswerTextSnapshot: "自分の答え",
        referenceAnswerSnapshot: "模範",
        selfEvaluation: "correct",
        correct: true
      })
    );
    expect(view.formatLabel).toBe("入力式（再生）");
    expect(view.answerLabel).toBe("あなたの回答");
    expect(view.answerText).toBe("自分の答え");
    expect(view.referenceLabel).toBe("模範解答");
    expect(view.referenceText).toBe("模範");
    expect(view.resultHeading).toBe("自己評価");
    expect(view.resultLabel).toBe("正解");
    expect(view.resultKind).toBe("correct");
  });

  it("free-response partial は部分的に正解であり、不正解にしない", () => {
    const view = presentQuizAttemptHistory(
      baseLog({
        questionType: "free-response",
        userAnswerTextSnapshot: "途中まで",
        referenceAnswerSnapshot: "模範",
        selfEvaluation: "partial",
        correct: false
      })
    );
    expect(view.resultKind).toBe("partial");
    expect(view.resultLabel).toBe("部分的に正解");
    expect(view.resultLabel).not.toBe("不正解");
  });

  it("free-response incorrect は不正解になる", () => {
    const view = presentQuizAttemptHistory(
      baseLog({
        questionType: "free-response",
        selfEvaluation: "incorrect",
        correct: false
      })
    );
    expect(view.resultKind).toBe("incorrect");
    expect(view.resultLabel).toBe("不正解");
  });

  it("欠けた optional snapshot は壊れず空表示へ fallback する", () => {
    const view = presentQuizAttemptHistory(
      baseLog({
        questionType: "free-response",
        userAnswerTextSnapshot: undefined,
        referenceAnswerSnapshot: "",
        selfEvaluation: "correct",
        correct: true
      })
    );
    expect(view.answerText).toBe(quizAttemptHistoryEmptySnapshot);
    expect(view.referenceText).toBe(quizAttemptHistoryEmptySnapshot);
    expect(view.resultLabel).toBe("正解");
  });

  it("free-response で selfEvaluation が無い旧データは correct へ fallback する", () => {
    expect(
      resolveQuizAttemptHistoryResultKind(
        baseLog({
          questionType: "free-response",
          selfEvaluation: undefined,
          correct: true
        })
      )
    ).toBe("correct");
    expect(
      resolveQuizAttemptHistoryResultKind(
        baseLog({
          questionType: "free-response",
          selfEvaluation: undefined,
          correct: false
        })
      )
    ).toBe("incorrect");
  });
});

describe("history filters", () => {
  const mixed = [
    baseLog({ id: "mc", questionType: "multiple-choice", correct: false }),
    baseLog({
      id: "fr-ok",
      questionType: "free-response",
      selfEvaluation: "correct",
      correct: true
    }),
    baseLog({
      id: "fr-partial",
      questionType: "free-response",
      selfEvaluation: "partial",
      correct: false
    }),
    baseLog({
      id: "fr-ng",
      questionType: "free-response",
      selfEvaluation: "incorrect",
      correct: false
    })
  ];

  it("partial を incorrect filter に含めない", () => {
    const incorrect = mixed.filter((log) => matchesQuizAttemptHistoryResultFilter(log, "incorrect"));
    expect(incorrect.map((log) => log.id)).toEqual(["mc", "fr-ng"]);
    const partial = mixed.filter((log) => matchesQuizAttemptHistoryResultFilter(log, "partial"));
    expect(partial.map((log) => log.id)).toEqual(["fr-partial"]);
  });

  it("回答形式 filter が四択と入力式を分ける", () => {
    expect(mixed.filter((log) => matchesQuizAttemptQuestionTypeFilter(log, "multiple-choice"))).toHaveLength(1);
    expect(mixed.filter((log) => matchesQuizAttemptQuestionTypeFilter(log, "free-response"))).toHaveLength(3);
    expect(mixed.filter((log) => matchesQuizAttemptQuestionTypeFilter(log, "all"))).toHaveLength(4);
  });

  it("表示上の outcome でサマリを数える", () => {
    expect(summarizeQuizAttemptHistoryOutcomes(mixed)).toEqual({
      total: 4,
      correctCount: 1,
      partialCount: 1,
      incorrectCount: 2
    });
  });
});

describe("matchesQuizAttemptHistorySearch", () => {
  it("free-response の回答と模範解答を検索する", () => {
    const log = baseLog({
      questionType: "free-response",
      userAnswerTextSnapshot: "教師あり学習はラベルを使う",
      referenceAnswerSnapshot: "入力データと正解ラベル"
    });
    expect(matchesQuizAttemptHistorySearch(log, "ラベルを使う")).toBe(true);
    expect(matchesQuizAttemptHistorySearch(log, "正解ラベル")).toBe(true);
    expect(matchesQuizAttemptHistorySearch(log, "存在しない語")).toBe(false);
  });
});
