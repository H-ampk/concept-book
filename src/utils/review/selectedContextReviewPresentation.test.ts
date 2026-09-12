import { describe, expect, it } from "vitest";
import {
  formatWeakPrerequisiteReason,
  formatWeakPrerequisiteState
} from "./selectedContextReviewPresentation";
import type { WeakPrerequisiteReason } from "./types";

const reason = (overrides: Partial<WeakPrerequisiteReason> = {}): WeakPrerequisiteReason => ({
  type: "weak-prerequisite",
  targetConceptId: "Target",
  prerequisiteId: "B",
  prerequisiteDepth: 1,
  satisfactionReason: "needs-learning",
  state: "developing",
  confidence: "medium",
  ...overrides
});

describe("selectedContextReviewPresentation", () => {
  it("needs-learning は前提不足として説明する", () => {
    expect(formatWeakPrerequisiteReason(reason())).toBe("前提としてまだ十分ではありません");
  });

  it("insufficient-evidence はデータ不足として説明し苦手と断定しない", () => {
    expect(
      formatWeakPrerequisiteReason(
        reason({
          satisfactionReason: "insufficient-evidence",
          state: "insufficient-data",
          confidence: "low"
        })
      )
    ).toBe("前提を満たしたと判断するにはデータが不足しています");
  });

  it("developing の状態表示", () => {
    expect(formatWeakPrerequisiteState(reason())).toBe("理解が進んでいる / 信頼度 中");
  });

  it("unlearned は未学習", () => {
    expect(
      formatWeakPrerequisiteState(reason({ state: "unlearned", confidence: "none" }))
    ).toBe("未学習");
  });

  it("insufficient-data と mastery 欠損はデータ不足", () => {
    expect(
      formatWeakPrerequisiteState(
        reason({
          satisfactionReason: "insufficient-evidence",
          state: "insufficient-data",
          confidence: "low"
        })
      )
    ).toBe("データ不足");
    expect(
      formatWeakPrerequisiteState(
        reason({
          satisfactionReason: "insufficient-evidence",
          state: undefined,
          confidence: undefined
        })
      )
    ).toBe("データ不足");
  });

  it("mastered + low は習得済みと表示しない", () => {
    const text = formatWeakPrerequisiteState(
      reason({
        satisfactionReason: "insufficient-evidence",
        state: "mastered",
        confidence: "low"
      })
    );
    expect(text).not.toContain("習得済み");
    expect(text).toBe("おおむね理解 / 信頼度 データ不足");
  });
});
