import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ConceptMastery } from "../../utils/mastery/types";
import type { GlobalReviewCandidate } from "../../utils/review";
import { GlobalReviewCandidatesSection } from "./GlobalReviewCandidatesSection";

const mastery = (overrides: Partial<ConceptMastery> = {}): ConceptMastery => ({
  conceptId: "social-loafing",
  masteryProbability: 0.34,
  masteryScore: 34,
  state: "learning",
  attemptCount: 4,
  correctCount: 1,
  incorrectCount: 3,
  accuracy: 0.25,
  confidence: "high",
  lastAnsweredAt: "2026-09-10T00:00:00.000Z",
  freshness: "fresh",
  recentResults: [true, false, false],
  avgReactionTimeMs: 1200,
  ...overrides
});

const candidate = (overrides: Partial<GlobalReviewCandidate> = {}): GlobalReviewCandidate => ({
  conceptId: "social-loafing",
  mastery: mastery(),
  priority: "high",
  reasons: [
    { type: "low-mastery", masteryScore: 34, state: "learning", confidence: "high" },
    { type: "recent-errors", recentAttemptCount: 3, recentIncorrectCount: 2 }
  ],
  hasQuizQuestion: true,
  ...overrides
});

describe("GlobalReviewCandidatesSection", () => {
  it("Concept 名、理解度、優先度、理由を表示する", () => {
    render(
      <GlobalReviewCandidatesSection
        candidates={[candidate()]}
        titleById={new Map([["social-loafing", "社会的手抜き"]])}
      />
    );
    expect(screen.getByRole("heading", { name: "今日の復習候補" })).toBeInTheDocument();
    const card = screen.getByTestId("review-candidate-social-loafing");
    expect(card).toHaveTextContent("社会的手抜き");
    expect(card).toHaveTextContent("理解度 34");
    expect(card).toHaveTextContent("優先度 高");
    expect(card).toHaveTextContent("安定して正答できていません");
    expect(card).toHaveTextContent("最近3回中2回誤答");
  });

  it("混同とデータ不足、問題なしを表示する", () => {
    render(
      <GlobalReviewCandidatesSection
        candidates={[
          candidate({
            conceptId: "classical",
            mastery: mastery({ conceptId: "classical", state: "developing", masteryScore: 60 }),
            priority: "medium",
            reasons: [{ type: "frequent-confusion", otherConceptId: "operant", confusionCount: 2 }],
            hasQuizQuestion: true
          }),
          candidate({
            conceptId: "dissonance",
            mastery: mastery({
              conceptId: "dissonance",
              state: "insufficient-data",
              confidence: "low",
              attemptCount: 1,
              masteryScore: 78
            }),
            priority: "low",
            reasons: [{ type: "insufficient-data", attemptCount: 1, confidence: "low" }],
            hasQuizQuestion: false
          })
        ]}
        titleById={
          new Map([
            ["classical", "古典的条件づけ"],
            ["operant", "オペラント条件づけ"],
            ["dissonance", "認知的不協和"]
          ])
        }
      />
    );
    expect(screen.getByTestId("review-candidate-classical")).toHaveTextContent(
      "オペラント条件づけと2回混同しています"
    );
    const thin = screen.getByTestId("review-candidate-dissonance");
    expect(thin).toHaveTextContent("認知的不協和");
    expect(thin).toHaveTextContent("回答 1回");
    expect(thin).toHaveTextContent("学習データが不足しています");
    expect(thin).toHaveTextContent("復習が必要ですが、対応する問題がありません");
  });

  it("Concept 詳細を開く導線を呼ぶ", async () => {
    const onOpenConcept = vi.fn();
    const user = userEvent.setup();
    render(
      <GlobalReviewCandidatesSection
        candidates={[candidate()]}
        titleById={new Map([["social-loafing", "社会的手抜き"]])}
        onOpenConcept={onOpenConcept}
      />
    );
    await user.click(screen.getByRole("button", { name: "Concept 詳細を開く" }));
    expect(onOpenConcept).toHaveBeenCalledWith("social-loafing");
  });
});
