import { describe, expect, it } from "vitest";
import { formatReviewPriorityLabel, formatReviewReasonDetail } from "./reviewPresentation";

describe("reviewPresentation", () => {
  it("優先度ラベルを出す", () => {
    expect(formatReviewPriorityLabel("high")).toBe("高");
    expect(formatReviewPriorityLabel("medium")).toBe("中");
    expect(formatReviewPriorityLabel("low")).toBe("低");
  });

  it("各 reason を説明文にする", () => {
    const titles = new Map([
      ["operant", "オペラント条件づけ"],
      ["classical", "古典的条件づけ"]
    ]);
    expect(formatReviewReasonDetail({ type: "low-mastery", masteryScore: 34, state: "learning", confidence: "high" }, titles)).toBe(
      "安定して正答できていません"
    );
    expect(
      formatReviewReasonDetail({ type: "insufficient-data", attemptCount: 1, confidence: "low" }, titles)
    ).toBe("学習データが不足しています");
    expect(
      formatReviewReasonDetail(
        { type: "stale", lastAnsweredAt: "2026-07-01T00:00:00.000Z", daysSinceLastAnswer: 45 },
        titles
      )
    ).toBe("長期間確認していません");
    expect(
      formatReviewReasonDetail({ type: "recent-errors", recentAttemptCount: 3, recentIncorrectCount: 2 }, titles)
    ).toBe("最近3回中2回誤答");
    expect(
      formatReviewReasonDetail(
        { type: "frequent-confusion", otherConceptId: "operant", confusionCount: 2 },
        titles
      )
    ).toBe("オペラント条件づけと2回混同しています");
  });
});
