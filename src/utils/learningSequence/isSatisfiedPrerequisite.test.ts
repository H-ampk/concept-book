import { describe, expect, it } from "vitest";
import type { ConceptMastery, MasteryConfidence, MasteryFreshness, MasteryState } from "../mastery/types";
import {
  getPersonalizedLearningSequenceReason,
  getPrerequisiteSatisfactionReason,
  isSatisfiedPrerequisite
} from "./isSatisfiedPrerequisite";

const mastery = (
  state: MasteryState,
  confidence: MasteryConfidence,
  extras: Partial<ConceptMastery> = {}
): ConceptMastery => ({
  conceptId: "c",
  masteryProbability: 0.85,
  masteryScore: 85,
  state,
  attemptCount: 8,
  correctCount: 7,
  incorrectCount: 1,
  accuracy: 0.875,
  confidence,
  lastAnsweredAt: "2026-09-01T00:00:00.000Z",
  freshness: "fresh",
  recentResults: [true, true, true],
  avgReactionTimeMs: 1200,
  ...extras
});

describe("isSatisfiedPrerequisite", () => {
  it("mastered + high は true", () => {
    expect(isSatisfiedPrerequisite(mastery("mastered", "high"))).toBe(true);
  });

  it("mastered + medium は true", () => {
    expect(isSatisfiedPrerequisite(mastery("mastered", "medium"))).toBe(true);
  });

  it("mastered + low は false", () => {
    expect(isSatisfiedPrerequisite(mastery("mastered", "low"))).toBe(false);
  });

  it("developing は false", () => {
    expect(isSatisfiedPrerequisite(mastery("developing", "medium"))).toBe(false);
  });

  it("learning は false", () => {
    expect(isSatisfiedPrerequisite(mastery("learning", "medium"))).toBe(false);
  });

  it("insufficient-data は false", () => {
    expect(isSatisfiedPrerequisite(mastery("insufficient-data", "low"))).toBe(false);
  });

  it("unlearned は false", () => {
    expect(isSatisfiedPrerequisite(mastery("unlearned", "none", { attemptCount: 0 }))).toBe(false);
  });

  it("undefined は false", () => {
    expect(isSatisfiedPrerequisite(undefined)).toBe(false);
  });

  it.each<[MasteryFreshness]>([["fresh"], ["aging"], ["stale"], ["never"]])(
    "mastered + high は freshness=%s でも true",
    (freshness) => {
      expect(isSatisfiedPrerequisite(mastery("mastered", "high", { freshness }))).toBe(true);
    }
  );

  it.each<[MasteryFreshness]>([["fresh"], ["stale"]])(
    "developing は freshness=%s でも false",
    (freshness) => {
      expect(isSatisfiedPrerequisite(mastery("developing", "medium", { freshness }))).toBe(false);
    }
  );

  it("masteryScore / lastAnsweredAt が高くても state が developing なら false", () => {
    expect(
      isSatisfiedPrerequisite(
        mastery("developing", "high", {
          masteryScore: 99,
          masteryProbability: 0.99,
          lastAnsweredAt: "2026-09-12T00:00:00.000Z"
        })
      )
    ).toBe(false);
  });
});

describe("getPrerequisiteSatisfactionReason", () => {
  it("mastered + medium/high は satisfied-prerequisite", () => {
    expect(getPrerequisiteSatisfactionReason(mastery("mastered", "high"))).toBe(
      "satisfied-prerequisite"
    );
    expect(getPrerequisiteSatisfactionReason(mastery("mastered", "medium"))).toBe(
      "satisfied-prerequisite"
    );
  });

  it("unlearned / learning / developing は needs-learning", () => {
    expect(getPrerequisiteSatisfactionReason(mastery("unlearned", "none"))).toBe("needs-learning");
    expect(getPrerequisiteSatisfactionReason(mastery("learning", "medium"))).toBe("needs-learning");
    expect(getPrerequisiteSatisfactionReason(mastery("developing", "medium"))).toBe(
      "needs-learning"
    );
  });

  it("insufficient-data / missing / mastered+low は insufficient-evidence", () => {
    expect(getPrerequisiteSatisfactionReason(mastery("insufficient-data", "low"))).toBe(
      "insufficient-evidence"
    );
    expect(getPrerequisiteSatisfactionReason(undefined)).toBe("insufficient-evidence");
    expect(getPrerequisiteSatisfactionReason(mastery("mastered", "low"))).toBe(
      "insufficient-evidence"
    );
  });

  it("freshness は reason に影響しない", () => {
    expect(
      getPrerequisiteSatisfactionReason(mastery("mastered", "high", { freshness: "stale" }))
    ).toBe("satisfied-prerequisite");
  });
});

describe("getPersonalizedLearningSequenceReason", () => {
  it("target は mastery に関係なく target", () => {
    expect(getPersonalizedLearningSequenceReason(true, mastery("mastered", "high"))).toBe("target");
    expect(getPersonalizedLearningSequenceReason(true, undefined)).toBe("target");
  });
});
