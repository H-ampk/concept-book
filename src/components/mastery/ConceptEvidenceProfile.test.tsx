import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ConceptMasteryPoint } from "../../utils/mastery/types";
import { ConceptEvidenceProfile } from "./ConceptEvidenceProfile";

const point = (overrides: Partial<ConceptMasteryPoint> = {}): ConceptMasteryPoint => ({
  conceptId: "c1",
  attemptIndex: 1,
  answeredAt: "2026-09-10T05:32:00.000Z",
  correct: true,
  masteryProbability: 0.5,
  masteryScore: 50,
  previousMasteryProbability: 0.2,
  previousMasteryScore: 20,
  masteryDelta: 30,
  quizAttemptLogId: "log-1",
  questionId: "q-1",
  questionPromptSnapshot: "prompt",
  timeMs: 4200,
  questionType: "multiple-choice",
  evidenceKind: "recognition",
  observationOutcome: "correct",
  ...overrides
});

describe("ConceptEvidenceProfile", () => {
  it("観測なしでは未確認メッセージを出す", () => {
    render(<ConceptEvidenceProfile history={[]} />);
    expect(screen.getByText("再認・再生ともまだ確認されていません")).toBeInTheDocument();
    expect(screen.getByText("再認（四択）")).toBeInTheDocument();
    expect(screen.getByText("再生（入力式）")).toBeInTheDocument();
    expect(screen.getAllByText("未確認")).toHaveLength(2);
  });

  it("recognition only では再生を未確認とし、弱いとは書かない", () => {
    render(
      <ConceptEvidenceProfile
        history={[
          point({ observationOutcome: "correct" }),
          point({
            attemptIndex: 2,
            quizAttemptLogId: "log-2",
            answeredAt: "2026-09-11T05:32:00.000Z",
            observationOutcome: "incorrect",
            correct: false
          })
        ]}
      />
    );
    expect(screen.getByText("再認は確認済み / 再生は未確認")).toBeInTheDocument();
    expect(screen.getByText("再認（四択）")).toBeInTheDocument();
    expect(screen.getByText("再生（入力式）")).toBeInTheDocument();
    expect(screen.getByText("未確認")).toBeInTheDocument();
    expect(screen.queryByText(/再生が低い/)).not.toBeInTheDocument();
  });

  it("recognition-ahead の説明を出す", () => {
    render(
      <ConceptEvidenceProfile
        history={[
          point({ observationOutcome: "correct" }),
          point({
            attemptIndex: 2,
            quizAttemptLogId: "log-2",
            answeredAt: "2026-09-11T05:32:00.000Z",
            questionType: "free-response",
            evidenceKind: "recall",
            observationOutcome: "incorrect",
            correct: false
          })
        ]}
      />
    );
    expect(screen.getByText("直近では「見れば分かる」傾向があります")).toBeInTheDocument();
    expect(
      screen.getByText("四択では正解していますが、入力式では再生が十分に確認できていません。")
    ).toBeInTheDocument();
  });

  it("partial を部分的に正解として表示する", () => {
    render(
      <ConceptEvidenceProfile
        history={[
          point({ observationOutcome: "correct" }),
          point({
            attemptIndex: 2,
            quizAttemptLogId: "log-2",
            answeredAt: "2026-09-11T05:32:00.000Z",
            questionType: "free-response",
            evidenceKind: "recall",
            observationOutcome: "partial",
            correct: false,
            selfEvaluation: "partial"
          })
        ]}
      />
    );
    expect(screen.getByText("直近: 部分的に正解")).toBeInTheDocument();
  });

  it("正解・部分・誤答の件数を表示する", () => {
    render(
      <ConceptEvidenceProfile
        history={[
          point({
            attemptIndex: 1,
            quizAttemptLogId: "r1",
            answeredAt: "2026-01-01T00:00:00.000Z",
            observationOutcome: "correct"
          }),
          point({
            attemptIndex: 2,
            quizAttemptLogId: "r2",
            answeredAt: "2026-01-02T00:00:00.000Z",
            observationOutcome: "incorrect",
            correct: false
          }),
          point({
            attemptIndex: 3,
            quizAttemptLogId: "c1",
            answeredAt: "2026-01-03T00:00:00.000Z",
            questionType: "free-response",
            evidenceKind: "recall",
            observationOutcome: "correct"
          }),
          point({
            attemptIndex: 4,
            quizAttemptLogId: "c2",
            answeredAt: "2026-01-04T00:00:00.000Z",
            questionType: "free-response",
            evidenceKind: "recall",
            observationOutcome: "partial",
            correct: false,
            selfEvaluation: "partial"
          }),
          point({
            attemptIndex: 5,
            quizAttemptLogId: "c3",
            answeredAt: "2026-01-05T00:00:00.000Z",
            questionType: "free-response",
            evidenceKind: "recall",
            observationOutcome: "incorrect",
            correct: false
          })
        ]}
      />
    );
    expect(screen.getByText(/2回.*正解1 \/ 誤答1/)).toBeInTheDocument();
    expect(screen.getByText(/3回.*正解1 \/ 部分1 \/ 誤答1/)).toBeInTheDocument();
  });
});
