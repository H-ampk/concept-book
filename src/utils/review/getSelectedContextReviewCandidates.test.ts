import { describe, expect, it } from "vitest";
import { createEmptyConceptInput, type Concept } from "../../types/concept";
import {
  QUIZ_QUESTION_SCHEMA_VERSION,
  type QuizQuestion
} from "../../types/quiz";
import { buildConceptPrerequisiteIndex } from "../conceptPrerequisites";
import { buildPersonalizedConceptLearningSequence } from "../learningSequence";
import type { ConceptMastery, MasteryConfidence, MasteryState } from "../mastery/types";
import { buildQuizQuestionConceptIdSet } from "./buildQuizQuestionConceptIdSet";
import { getSelectedContextReviewCandidates } from "./getSelectedContextReviewCandidates";
import type { SelectedContextReviewResult } from "./types";

const concept = (id: string, extras: Partial<Concept> = {}): Concept => ({
  ...createEmptyConceptInput(),
  id,
  title: extras.title ?? id,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...extras
});

const mastery = (
  conceptId: string,
  state: MasteryState,
  confidence: MasteryConfidence,
  extras: Partial<ConceptMastery> = {}
): ConceptMastery => ({
  conceptId,
  masteryProbability: state === "mastered" ? 0.9 : 0.4,
  masteryScore: state === "mastered" ? 90 : 40,
  state,
  attemptCount: confidence === "none" ? 0 : 6,
  correctCount: 3,
  incorrectCount: 3,
  accuracy: 0.5,
  confidence,
  lastAnsweredAt: "2026-09-01T00:00:00.000Z",
  freshness: "fresh",
  recentResults: [true, false],
  avgReactionTimeMs: 1100,
  ...extras
});

const masteryMap = (...entries: ConceptMastery[]): Map<string, ConceptMastery> =>
  new Map(entries.map((item) => [item.conceptId, item]));

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

const candidatesOf = (result: SelectedContextReviewResult): string[] =>
  result.candidates.map((item) => item.conceptId);

const reviewFrom = (
  targetConceptId: string,
  concepts: Concept[],
  masteryByConceptId: ReadonlyMap<string, ConceptMastery>,
  quizQuestionConceptIds: ReadonlySet<string> = new Set()
) => {
  const personalizedSequence = buildPersonalizedConceptLearningSequence({
    targetConceptId,
    prerequisiteIndex: buildConceptPrerequisiteIndex(concepts),
    masteryByConceptId
  });
  return {
    personalizedSequence,
    result: getSelectedContextReviewCandidates({
      personalizedSequence,
      masteryByConceptId,
      quizQuestionConceptIds
    })
  };
};

describe("getSelectedContextReviewCandidates", () => {
  it("A → B → C → Target で B が satisfied なら C だけを candidate にする", () => {
    const concepts = [
      concept("A"),
      concept("B", { prerequisiteIds: ["A"] }),
      concept("C", { prerequisiteIds: ["B"] }),
      concept("Target", { prerequisiteIds: ["C"] })
    ];
    const masteryByConceptId = masteryMap(
      mastery("A", "unlearned", "none"),
      mastery("B", "mastered", "high"),
      mastery("C", "developing", "medium"),
      mastery("Target", "unlearned", "none")
    );
    const { personalizedSequence, result } = reviewFrom("Target", concepts, masteryByConceptId);

    expect(personalizedSequence.status).toBe("ok");
    expect(personalizedSequence.items.map((item) => item.conceptId)).toEqual(["C", "Target"]);
    expect(result.status).toBe("ok");
    expect(candidatesOf(result)).toEqual(["C"]);
    expect(candidatesOf(result)).not.toContain("A");
    expect(candidatesOf(result)).not.toContain("B");
    expect(candidatesOf(result)).not.toContain("Target");
    expect(result.candidates[0]?.reason).toMatchObject({
      type: "weak-prerequisite",
      targetConceptId: "Target",
      prerequisiteId: "C",
      satisfactionReason: "needs-learning",
      state: "developing",
      confidence: "medium"
    });
  });

  it("shared ancestor は別 branch が active なら残し、satisfied な B は candidate にしない", () => {
    const concepts = [
      concept("A"),
      concept("B", { prerequisiteIds: ["A"] }),
      concept("C", { prerequisiteIds: ["A"] }),
      concept("Target", { prerequisiteIds: ["B", "C"] })
    ];
    const masteryByConceptId = masteryMap(
      mastery("A", "unlearned", "none"),
      mastery("B", "mastered", "high"),
      mastery("C", "developing", "medium"),
      mastery("Target", "unlearned", "none")
    );
    const { personalizedSequence, result } = reviewFrom("Target", concepts, masteryByConceptId);

    expect(personalizedSequence.items.map((item) => item.conceptId)).toEqual(["A", "C", "Target"]);
    expect(candidatesOf(result)).toEqual(["A", "C"]);
    expect(candidatesOf(result)).not.toContain("B");
  });

  it("すべて未充足なら #121 の target 以外と同じ順になる", () => {
    const concepts = [
      concept("A"),
      concept("B", { prerequisiteIds: ["A"] }),
      concept("C", { prerequisiteIds: ["B"] }),
      concept("Target", { prerequisiteIds: ["C"] })
    ];
    const masteryByConceptId = masteryMap(
      mastery("A", "unlearned", "none"),
      mastery("B", "learning", "medium"),
      mastery("C", "developing", "medium"),
      mastery("Target", "unlearned", "none")
    );
    const { personalizedSequence, result } = reviewFrom("Target", concepts, masteryByConceptId);

    expect(personalizedSequence.items.map((item) => item.conceptId)).toEqual([
      "A",
      "B",
      "C",
      "Target"
    ]);
    expect(candidatesOf(result)).toEqual(["A", "B", "C"]);
  });

  it("直接の前提がすべて satisfied なら candidate は空", () => {
    const concepts = [
      concept("A"),
      concept("B"),
      concept("Target", { prerequisiteIds: ["A", "B"] })
    ];
    const masteryByConceptId = masteryMap(
      mastery("A", "mastered", "high"),
      mastery("B", "mastered", "high"),
      mastery("Target", "unlearned", "none")
    );
    const { result } = reviewFrom("Target", concepts, masteryByConceptId);
    expect(result.status).toBe("ok");
    expect(result.candidates).toEqual([]);
  });

  it("target が mastered/high なら candidate は空", () => {
    const concepts = [
      concept("A"),
      concept("Target", { prerequisiteIds: ["A"] })
    ];
    const masteryByConceptId = masteryMap(
      mastery("A", "unlearned", "none"),
      mastery("Target", "mastered", "high")
    );
    const { personalizedSequence, result } = reviewFrom("Target", concepts, masteryByConceptId);
    expect(personalizedSequence.status).toBe("ok");
    expect(personalizedSequence.items.map((item) => item.conceptId)).toEqual(["Target"]);
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.targetAlreadyMastered).toBe(true);
    }
    expect(result.candidates).toEqual([]);
  });

  it("formal prerequisite が無ければ candidate は空", () => {
    const concepts = [concept("Target")];
    const { result } = reviewFrom("Target", concepts, masteryMap());
    expect(result.status).toBe("ok");
    expect(result.candidates).toEqual([]);
  });

  it("cycle-detected は candidate なしで status を伝播する", () => {
    const concepts = [
      concept("A", { prerequisiteIds: ["C"] }),
      concept("B", { prerequisiteIds: ["A"] }),
      concept("C", { prerequisiteIds: ["B"] })
    ];
    const { personalizedSequence, result } = reviewFrom("C", concepts, masteryMap());
    expect(personalizedSequence.status).toBe("cycle-detected");
    expect(result).toEqual({
      status: "cycle-detected",
      targetConceptId: "C",
      candidates: []
    });
  });

  it("target-not-found は candidate なしで status を伝播する", () => {
    const concepts = [concept("A")];
    const { personalizedSequence, result } = reviewFrom("missing", concepts, masteryMap());
    expect(personalizedSequence.status).toBe("target-not-found");
    expect(result).toEqual({
      status: "target-not-found",
      targetConceptId: "missing",
      candidates: []
    });
  });

  it("candidate 順は #121 personalized sequence の順を維持する", () => {
    const concepts = [
      concept("A"),
      concept("B"),
      concept("C", { prerequisiteIds: ["A", "B"] }),
      concept("Target", { prerequisiteIds: ["C"] })
    ];
    const masteryByConceptId = masteryMap(
      mastery("A", "unlearned", "none"),
      mastery("B", "learning", "medium"),
      mastery("C", "developing", "high"),
      mastery("Target", "unlearned", "none")
    );
    const { personalizedSequence, result } = reviewFrom("Target", concepts, masteryByConceptId);
    expect(personalizedSequence.items.map((item) => item.conceptId)).toEqual([
      "A",
      "B",
      "C",
      "Target"
    ]);
    expect(candidatesOf(result)).toEqual(["A", "B", "C"]);
  });

  it("QuizQuestion がなくても candidate は残し hasQuizQuestion=false にする", () => {
    const concepts = [
      concept("A"),
      concept("Target", { prerequisiteIds: ["A"] })
    ];
    const masteryByConceptId = masteryMap(
      mastery("A", "developing", "medium"),
      mastery("Target", "unlearned", "none")
    );
    const { result } = reviewFrom("Target", concepts, masteryByConceptId, new Set());
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({
      conceptId: "A",
      hasQuizQuestion: false
    });
  });

  it("question.conceptId があれば hasQuizQuestion=true", () => {
    const concepts = [
      concept("A"),
      concept("Target", { prerequisiteIds: ["A"] })
    ];
    const masteryByConceptId = masteryMap(
      mastery("A", "developing", "medium"),
      mastery("Target", "unlearned", "none")
    );
    const quizQuestionConceptIds = buildQuizQuestionConceptIdSet([
      question({ conceptId: "A" })
    ]);
    const { result } = reviewFrom("Target", concepts, masteryByConceptId, quizQuestionConceptIds);
    expect(result.candidates[0]?.hasQuizQuestion).toBe(true);
  });

  it("正解選択肢の sourceConceptId fallback でも hasQuizQuestion=true", () => {
    const concepts = [
      concept("A"),
      concept("Target", { prerequisiteIds: ["A"] })
    ];
    const masteryByConceptId = masteryMap(
      mastery("A", "developing", "medium"),
      mastery("Target", "unlearned", "none")
    );
    const quizQuestionConceptIds = buildQuizQuestionConceptIdSet([
      question({
        choices: [
          { id: "a", text: "正解", sourceConceptId: "A" },
          { id: "b", text: "誤答", linkedConceptId: "other" }
        ]
      })
    ]);
    const { result } = reviewFrom("Target", concepts, masteryByConceptId, quizQuestionConceptIds);
    expect(result.candidates[0]?.hasQuizQuestion).toBe(true);
  });

  it("distractor の linkedConceptId だけでは hasQuizQuestion=true にしない", () => {
    const concepts = [
      concept("A"),
      concept("Target", { prerequisiteIds: ["A"] })
    ];
    const masteryByConceptId = masteryMap(
      mastery("A", "developing", "medium"),
      mastery("Target", "unlearned", "none")
    );
    const quizQuestionConceptIds = buildQuizQuestionConceptIdSet([
      question({
        choices: [
          { id: "a", text: "正解" },
          { id: "b", text: "誤答", linkedConceptId: "A" }
        ]
      })
    ]);
    expect(quizQuestionConceptIds.has("A")).toBe(false);
    const { result } = reviewFrom("Target", concepts, masteryByConceptId, quizQuestionConceptIds);
    expect(result.candidates[0]?.hasQuizQuestion).toBe(false);
  });

  it("mastery 欠損は insufficient-evidence の candidate として残す", () => {
    const concepts = [
      concept("A"),
      concept("Target", { prerequisiteIds: ["A"] })
    ];
    const { result } = reviewFrom("Target", concepts, masteryMap());
    expect(result.candidates[0]?.reason).toMatchObject({
      type: "weak-prerequisite",
      prerequisiteId: "A",
      satisfactionReason: "insufficient-evidence"
    });
    expect(result.candidates[0]?.mastery).toBeUndefined();
    expect(result.candidates[0]?.reason.state).toBeUndefined();
  });

  it("unlearned は needs-learning の candidate", () => {
    const concepts = [
      concept("A"),
      concept("Target", { prerequisiteIds: ["A"] })
    ];
    const { result } = reviewFrom(
      "Target",
      concepts,
      masteryMap(mastery("A", "unlearned", "none"), mastery("Target", "unlearned", "none"))
    );
    expect(result.candidates[0]?.reason.satisfactionReason).toBe("needs-learning");
    expect(result.candidates[0]?.reason.state).toBe("unlearned");
  });

  it("insufficient-data は insufficient-evidence の candidate", () => {
    const concepts = [
      concept("A"),
      concept("Target", { prerequisiteIds: ["A"] })
    ];
    const { result } = reviewFrom(
      "Target",
      concepts,
      masteryMap(
        mastery("A", "insufficient-data", "low", { attemptCount: 1 }),
        mastery("Target", "unlearned", "none")
      )
    );
    expect(result.candidates[0]?.reason.satisfactionReason).toBe("insufficient-evidence");
    expect(result.candidates[0]?.reason.state).toBe("insufficient-data");
  });

  it("mastered + low は insufficient-evidence の candidate", () => {
    const concepts = [
      concept("A"),
      concept("Target", { prerequisiteIds: ["A"] })
    ];
    const { result } = reviewFrom(
      "Target",
      concepts,
      masteryMap(
        mastery("A", "mastered", "low"),
        mastery("Target", "unlearned", "none")
      )
    );
    expect(result.candidates[0]?.reason.satisfactionReason).toBe("insufficient-evidence");
    expect(result.candidates[0]?.reason.state).toBe("mastered");
    expect(result.candidates[0]?.reason.confidence).toBe("low");
  });

  it("developing / learning は needs-learning の candidate", () => {
    const concepts = [
      concept("A"),
      concept("B"),
      concept("Target", { prerequisiteIds: ["A", "B"] })
    ];
    const { result } = reviewFrom(
      "Target",
      concepts,
      masteryMap(
        mastery("A", "developing", "medium"),
        mastery("B", "learning", "medium"),
        mastery("Target", "unlearned", "none")
      )
    );
    expect(result.candidates.map((item) => item.reason.satisfactionReason)).toEqual([
      "needs-learning",
      "needs-learning"
    ]);
  });

  it("mastered + medium/high は freshness stale でも candidate にしない", () => {
    const concepts = [
      concept("A"),
      concept("Target", { prerequisiteIds: ["A"] })
    ];
    const { result } = reviewFrom(
      "Target",
      concepts,
      masteryMap(
        mastery("A", "mastered", "high", { freshness: "stale" }),
        mastery("Target", "unlearned", "none")
      )
    );
    expect(result.candidates).toEqual([]);
  });

  it("priority フィールドを持たない", () => {
    const concepts = [
      concept("A"),
      concept("Target", { prerequisiteIds: ["A"] })
    ];
    const { result } = reviewFrom(
      "Target",
      concepts,
      masteryMap(mastery("A", "developing", "medium"), mastery("Target", "unlearned", "none"))
    );
    expect(result.candidates[0]).not.toHaveProperty("priority");
  });
});
