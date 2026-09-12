import { describe, expect, it } from "vitest";
import {
  QUIZ_QUESTION_SCHEMA_VERSION,
  type QuizQuestion
} from "../../types/quiz";
import type { ConceptMastery } from "../mastery/types";
import { collectGlobalReviewReasons } from "./collectGlobalReviewReasons";
import { MIN_FREQUENT_CONFUSION_COUNT, RECENT_ERROR_WINDOW } from "./constants";
import { getGlobalReviewCandidates } from "./getGlobalReviewCandidates";
import { getReviewPriority } from "./getReviewPriority";
import type { GlobalReviewReason, GlobalReviewReasonDetail } from "./types";

const NOW = new Date("2026-09-12T00:00:00.000Z");

const mastery = (overrides: Partial<ConceptMastery> = {}): ConceptMastery => ({
  conceptId: "c",
  masteryProbability: 0.34,
  masteryScore: 34,
  state: "learning",
  attemptCount: 4,
  correctCount: 1,
  incorrectCount: 3,
  accuracy: 0.25,
  confidence: "medium",
  lastAnsweredAt: "2026-09-10T00:00:00.000Z",
  freshness: "fresh",
  recentResults: [true, false, false, false],
  avgReactionTimeMs: 1200,
  ...overrides
});

const question = (overrides: Partial<QuizQuestion> = {}): QuizQuestion => ({
  id: "q-1",
  prompt: "問い",
  choices: [
    { id: "a", text: "A" },
    { id: "b", text: "B" }
  ],
  correctChoiceId: "a",
  visibility: "private",
  schemaVersion: QUIZ_QUESTION_SCHEMA_VERSION,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides
});

const reasonTypes = (reasons: readonly GlobalReviewReasonDetail[]): GlobalReviewReason[] =>
  reasons.map((reason) => reason.type);

const reasonsFor = (
  overrides: Partial<ConceptMastery>,
  extra?: { frequentConfusion?: Parameters<typeof collectGlobalReviewReasons>[1]["frequentConfusion"] }
): GlobalReviewReasonDetail[] =>
  collectGlobalReviewReasons(mastery(overrides), {
    now: NOW,
    frequentConfusion: extra?.frequentConfusion
  });

describe("collectGlobalReviewReasons / low-mastery", () => {
  it("learning + medium → low-mastery", () => {
    expect(reasonTypes(reasonsFor({ state: "learning", confidence: "medium" }))).toContain(
      "low-mastery"
    );
  });

  it("learning + high → low-mastery", () => {
    expect(
      reasonTypes(reasonsFor({ state: "learning", confidence: "high", attemptCount: 8 }))
    ).toContain("low-mastery");
  });

  it("insufficient-data → low-mastery にならない", () => {
    expect(
      reasonTypes(
        reasonsFor({
          state: "insufficient-data",
          confidence: "low",
          attemptCount: 1,
          recentResults: [true]
        })
      )
    ).not.toContain("low-mastery");
  });

  it("unlearned → low-mastery にならない", () => {
    expect(
      reasonTypes(
        reasonsFor({
          state: "unlearned",
          confidence: "none",
          attemptCount: 0,
          recentResults: [],
          lastAnsweredAt: null,
          freshness: "never"
        })
      )
    ).not.toContain("low-mastery");
  });
});

describe("collectGlobalReviewReasons / insufficient-data", () => {
  it("confidence low / state insufficient-data → reason", () => {
    const reasons = reasonsFor({
      state: "insufficient-data",
      confidence: "low",
      attemptCount: 1,
      recentResults: [false]
    });
    expect(reasons).toContainEqual({
      type: "insufficient-data",
      attemptCount: 1,
      confidence: "low"
    });
  });

  it("unlearned は含まれない", () => {
    expect(
      reasonTypes(
        reasonsFor({
          state: "unlearned",
          confidence: "none",
          attemptCount: 0,
          recentResults: [],
          lastAnsweredAt: null,
          freshness: "never"
        })
      )
    ).toEqual([]);
  });
});

describe("collectGlobalReviewReasons / stale", () => {
  it("stale → stale reason", () => {
    const reasons = reasonsFor({
      state: "mastered",
      confidence: "high",
      masteryScore: 86,
      freshness: "stale",
      lastAnsweredAt: "2026-07-20T00:00:00.000Z"
    });
    expect(reasons).toContainEqual({
      type: "stale",
      lastAnsweredAt: "2026-07-20T00:00:00.000Z",
      daysSinceLastAnswer: 54
    });
  });

  it("fresh → stale reason なし", () => {
    expect(
      reasonTypes(
        reasonsFor({
          state: "mastered",
          confidence: "high",
          freshness: "fresh",
          lastAnsweredAt: "2026-09-10T00:00:00.000Z"
        })
      )
    ).not.toContain("stale");
  });

  it("never → stale reason なし", () => {
    expect(
      reasonTypes(
        reasonsFor({
          state: "unlearned",
          confidence: "none",
          attemptCount: 0,
          recentResults: [],
          lastAnsweredAt: null,
          freshness: "never"
        })
      )
    ).not.toContain("stale");
  });
});

describe("collectGlobalReviewReasons / recent-errors", () => {
  it("[true, false, false] → reasonあり", () => {
    const reasons = reasonsFor({
      recentResults: [true, false, false],
      state: "learning",
      confidence: "medium"
    });
    expect(reasons).toContainEqual({
      type: "recent-errors",
      recentAttemptCount: 3,
      recentIncorrectCount: 2
    });
  });

  it("[false, true, false] → reasonあり", () => {
    expect(
      reasonTypes(
        reasonsFor({
          recentResults: [false, true, false],
          state: "developing",
          confidence: "medium",
          masteryScore: 60
        })
      )
    ).toContain("recent-errors");
  });

  it("[true, true, false] → reasonなし", () => {
    expect(
      reasonTypes(
        reasonsFor({
          recentResults: [true, true, false],
          state: "developing",
          confidence: "medium",
          masteryScore: 60
        })
      )
    ).not.toContain("recent-errors");
  });

  it("2件しか回答なし → reasonなし", () => {
    expect(
      reasonTypes(
        reasonsFor({
          recentResults: [false, false],
          state: "insufficient-data",
          confidence: "low",
          attemptCount: 2
        })
      )
    ).not.toContain("recent-errors");
  });

  it(`直近は ${RECENT_ERROR_WINDOW} 件の末尾を見る`, () => {
    const reasons = reasonsFor({
      recentResults: [false, false, true, true, false],
      state: "developing",
      confidence: "high",
      masteryScore: 70
    });
    expect(reasonTypes(reasons)).not.toContain("recent-errors");
  });
});

describe("getGlobalReviewCandidates / frequent-confusion", () => {
  const baseMastery = mastery({
    conceptId: "a",
    state: "developing",
    confidence: "high",
    masteryScore: 70,
    recentResults: [true, true, true]
  });

  it("pair count 2 → reasonあり", () => {
    const candidates = getGlobalReviewCandidates({
      concepts: [{ id: "a" }, { id: "b" }],
      masteryByConceptId: new Map([
        ["a", { ...baseMastery, conceptId: "a" }],
        [
          "b",
          mastery({
            conceptId: "b",
            state: "developing",
            confidence: "high",
            masteryScore: 72,
            recentResults: [true, true, true]
          })
        ]
      ]),
      confusionStats: [
        {
          correctConceptId: "a",
          selectedConceptId: "b",
          confusionCount: 2
        }
      ],
      quizQuestions: [],
      now: NOW
    });
    const a = candidates.find((row) => row.conceptId === "a");
    expect(a?.reasons).toContainEqual({
      type: "frequent-confusion",
      otherConceptId: "b",
      confusionCount: 2
    });
    expect(candidates.find((row) => row.conceptId === "b")?.reasons).toContainEqual({
      type: "frequent-confusion",
      otherConceptId: "a",
      confusionCount: MIN_FREQUENT_CONFUSION_COUNT
    });
  });

  it("pair count 1 → reasonなし", () => {
    const candidates = getGlobalReviewCandidates({
      concepts: [{ id: "a" }, { id: "b" }],
      masteryByConceptId: new Map([
        ["a", { ...baseMastery, conceptId: "a" }],
        ["b", { ...baseMastery, conceptId: "b", masteryScore: 72 }]
      ]),
      confusionStats: [
        {
          correctConceptId: "a",
          selectedConceptId: "b",
          confusionCount: 1
        }
      ],
      quizQuestions: [],
      now: NOW
    });
    expect(candidates).toEqual([]);
  });

  it("self pair →除外", () => {
    const candidates = getGlobalReviewCandidates({
      concepts: [{ id: "a" }],
      masteryByConceptId: new Map([["a", { ...baseMastery, conceptId: "a" }]]),
      confusionStats: [
        {
          correctConceptId: "a",
          selectedConceptId: "a",
          confusionCount: 4
        }
      ],
      quizQuestions: [],
      now: NOW
    });
    expect(candidates).toEqual([]);
  });

  it("missing linked ID →安全に無視", () => {
    const candidates = getGlobalReviewCandidates({
      concepts: [{ id: "a" }],
      masteryByConceptId: new Map([["a", { ...baseMastery, conceptId: "a" }]]),
      confusionStats: [
        {
          correctConceptId: "a",
          selectedConceptId: null,
          confusionCount: 4
        },
        {
          correctConceptId: "",
          selectedConceptId: "a",
          confusionCount: 4
        }
      ],
      quizQuestions: [],
      now: NOW
    });
    expect(candidates).toEqual([]);
  });

  it("削除済み Concept との pair は除外", () => {
    const candidates = getGlobalReviewCandidates({
      concepts: [{ id: "a" }],
      masteryByConceptId: new Map([["a", { ...baseMastery, conceptId: "a" }]]),
      confusionStats: [
        {
          correctConceptId: "a",
          selectedConceptId: "gone",
          confusionCount: 3
        }
      ],
      quizQuestions: [],
      now: NOW
    });
    expect(candidates).toEqual([]);
  });

  it("A→B と B→A は無向 pair として合算する", () => {
    const candidates = getGlobalReviewCandidates({
      concepts: [{ id: "a" }, { id: "b" }],
      masteryByConceptId: new Map([
        ["a", { ...baseMastery, conceptId: "a" }],
        ["b", { ...baseMastery, conceptId: "b", masteryScore: 72 }]
      ]),
      confusionStats: [
        { correctConceptId: "a", selectedConceptId: "b", confusionCount: 1 },
        { correctConceptId: "b", selectedConceptId: "a", confusionCount: 1 }
      ],
      quizQuestions: [],
      now: NOW
    });
    expect(candidates.find((row) => row.conceptId === "a")?.reasons).toContainEqual({
      type: "frequent-confusion",
      otherConceptId: "b",
      confusionCount: 2
    });
  });
});

describe("getGlobalReviewCandidates / multiple reasons", () => {
  it("同一 Concept に low-mastery / recent-errors / frequent-confusion が共存できる", () => {
    const candidates = getGlobalReviewCandidates({
      concepts: [{ id: "a" }, { id: "b" }],
      masteryByConceptId: new Map([
        [
          "a",
          mastery({
            conceptId: "a",
            state: "learning",
            confidence: "medium",
            recentResults: [true, false, false]
          })
        ],
        [
          "b",
          mastery({
            conceptId: "b",
            state: "developing",
            confidence: "high",
            masteryScore: 70,
            recentResults: [true, true, true]
          })
        ]
      ]),
      confusionStats: [
        { correctConceptId: "a", selectedConceptId: "b", confusionCount: 2 }
      ],
      quizQuestions: [],
      now: NOW
    });
    expect(reasonTypes(candidates[0].reasons)).toEqual([
      "low-mastery",
      "recent-errors",
      "frequent-confusion"
    ]);
    expect(candidates[0].priority).toBe("high");
  });
});

describe("getReviewPriority", () => {
  it("low-mastery + recent-errors → high", () => {
    expect(getReviewPriority([{ type: "low-mastery" }, { type: "recent-errors" }])).toBe("high");
  });

  it("stale only → medium", () => {
    expect(getReviewPriority([{ type: "stale" }])).toBe("medium");
  });

  it("insufficient-data only → low", () => {
    expect(getReviewPriority([{ type: "insufficient-data" }])).toBe("low");
  });

  it("insufficient-data + frequent-confusion → medium", () => {
    expect(getReviewPriority([{ type: "insufficient-data" }, { type: "frequent-confusion" }])).toBe(
      "medium"
    );
  });

  it("数値 magic score に依存していない", () => {
    const highScoreInsufficient = getGlobalReviewCandidates({
      concepts: [
        { id: "thin-high-score" },
        { id: "stale-mastered" }
      ],
      masteryByConceptId: new Map([
        [
          "thin-high-score",
          mastery({
            conceptId: "thin-high-score",
            state: "insufficient-data",
            confidence: "low",
            masteryScore: 5,
            attemptCount: 1,
            recentResults: [true],
            freshness: "fresh"
          })
        ],
        [
          "stale-mastered",
          mastery({
            conceptId: "stale-mastered",
            state: "mastered",
            confidence: "high",
            masteryScore: 90,
            freshness: "stale",
            lastAnsweredAt: "2026-07-01T00:00:00.000Z",
            recentResults: [true, true, true]
          })
        ]
      ]),
      confusionStats: [],
      quizQuestions: [],
      now: NOW
    });
    expect(highScoreInsufficient.map((row) => row.conceptId)).toEqual([
      "stale-mastered",
      "thin-high-score"
    ]);
    expect(highScoreInsufficient[0].priority).toBe("medium");
    expect(highScoreInsufficient[1].priority).toBe("low");
  });
});

describe("getGlobalReviewCandidates / QuizQuestion", () => {
  it("review candidate だが question なし → candidate は残る / hasQuizQuestion false", () => {
    const [candidate] = getGlobalReviewCandidates({
      concepts: [{ id: "a" }],
      masteryByConceptId: new Map([["a", mastery({ conceptId: "a" })]]),
      confusionStats: [],
      quizQuestions: [],
      now: NOW
    });
    expect(candidate).toMatchObject({ conceptId: "a", hasQuizQuestion: false });
  });

  it("question あり → true", () => {
    const [candidate] = getGlobalReviewCandidates({
      concepts: [{ id: "a" }],
      masteryByConceptId: new Map([["a", mastery({ conceptId: "a" })]]),
      confusionStats: [],
      quizQuestions: [question({ conceptId: "a" })],
      now: NOW
    });
    expect(candidate.hasQuizQuestion).toBe(true);
  });

  it("正解選択肢の sourceConceptId でも hasQuizQuestion になる", () => {
    const [candidate] = getGlobalReviewCandidates({
      concepts: [{ id: "a" }],
      masteryByConceptId: new Map([["a", mastery({ conceptId: "a" })]]),
      confusionStats: [],
      quizQuestions: [
        question({
          choices: [
            { id: "a", text: "A", sourceConceptId: "a" },
            { id: "b", text: "B" }
          ]
        })
      ],
      now: NOW
    });
    expect(candidate.hasQuizQuestion).toBe(true);
  });
});

describe("getGlobalReviewCandidates / determinism", () => {
  it("同一入力で順序が安定", () => {
    const input = {
      concepts: [{ id: "b" }, { id: "a" }, { id: "c" }],
      masteryByConceptId: new Map([
        [
          "a",
          mastery({
            conceptId: "a",
            state: "learning",
            confidence: "medium",
            masteryScore: 40,
            recentResults: [true, true, true]
          })
        ],
        [
          "b",
          mastery({
            conceptId: "b",
            state: "learning",
            confidence: "medium",
            masteryScore: 40,
            recentResults: [true, true, true]
          })
        ],
        [
          "c",
          mastery({
            conceptId: "c",
            state: "insufficient-data",
            confidence: "low",
            masteryScore: 10,
            attemptCount: 1,
            recentResults: [false]
          })
        ]
      ]),
      confusionStats: [],
      quizQuestions: [] as QuizQuestion[],
      now: NOW
    };
    const first = getGlobalReviewCandidates(input).map((row) => row.conceptId);
    const second = getGlobalReviewCandidates(input).map((row) => row.conceptId);
    expect(first).toEqual(["b", "a", "c"]);
    expect(second).toEqual(first);
  });

  it("insufficient-data の masteryScore では並べない", () => {
    const candidates = getGlobalReviewCandidates({
      concepts: [{ id: "first" }, { id: "second" }],
      masteryByConceptId: new Map([
        [
          "first",
          mastery({
            conceptId: "first",
            state: "insufficient-data",
            confidence: "low",
            masteryScore: 90,
            attemptCount: 1,
            recentResults: [true]
          })
        ],
        [
          "second",
          mastery({
            conceptId: "second",
            state: "insufficient-data",
            confidence: "low",
            masteryScore: 5,
            attemptCount: 1,
            recentResults: [false]
          })
        ]
      ]),
      confusionStats: [],
      quizQuestions: [],
      now: NOW
    });
    expect(candidates.map((row) => row.conceptId)).toEqual(["first", "second"]);
  });

  it("weak-prerequisite は生成しない", () => {
    const candidates = getGlobalReviewCandidates({
      concepts: [{ id: "a" }],
      masteryByConceptId: new Map([["a", mastery({ conceptId: "a" })]]),
      confusionStats: [],
      quizQuestions: [],
      now: NOW
    });
    const types: string[] = candidates.flatMap((row) => row.reasons.map((reason) => reason.type));
    expect(types).not.toContain("weak-prerequisite");
  });
});
