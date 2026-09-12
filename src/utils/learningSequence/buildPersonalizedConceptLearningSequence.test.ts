import { describe, expect, it } from "vitest";
import { createEmptyConceptInput, type Concept } from "../../types/concept";
import { buildConceptPrerequisiteIndex } from "../conceptPrerequisites";
import type { ConceptMastery, MasteryConfidence, MasteryState } from "../mastery/types";
import { buildConceptLearningSequence } from "./buildConceptLearningSequence";
import { buildPersonalizedConceptLearningSequence } from "./buildPersonalizedConceptLearningSequence";
import { collectPersonalizedPrerequisiteClosure } from "./collectPersonalizedPrerequisiteClosure";
import { isSatisfiedPrerequisite } from "./isSatisfiedPrerequisite";
import type { PersonalizedConceptLearningSequenceResult } from "./types";

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

const idsOf = (result: PersonalizedConceptLearningSequenceResult): string[] =>
  result.items.map((item) => item.conceptId);

const boundaryIds = (result: PersonalizedConceptLearningSequenceResult): string[] =>
  result.satisfiedBoundaries.map((item) => item.conceptId);

const reasonOf = (
  result: PersonalizedConceptLearningSequenceResult,
  id: string
): string | undefined => result.items.find((item) => item.conceptId === id)?.reason;

describe("collectPersonalizedPrerequisiteClosure", () => {
  it("satisfied boundary より先を enqueue せず、shared ancestor は別 branch から残す", () => {
    const index = buildConceptPrerequisiteIndex([
      concept("A"),
      concept("B", { prerequisiteIds: ["A"] }),
      concept("C", { prerequisiteIds: ["A"] }),
      concept("Target", { prerequisiteIds: ["B", "C"] })
    ]);
    const satisfied = new Set(["B"]);
    const closure = collectPersonalizedPrerequisiteClosure({
      prerequisiteIndex: index,
      targetConceptId: "Target",
      isSatisfiedConcept: (id) => satisfied.has(id)
    });
    expect(closure).not.toBeNull();
    expect([...closure!.activeConceptIds].sort()).toEqual(["A", "C", "Target"]);
    expect([...closure!.satisfiedBoundaryConceptIds]).toEqual(["B"]);
  });

  it("cycle でも expanded active だけを visited にして停止する", () => {
    const index = buildConceptPrerequisiteIndex([
      concept("A", { prerequisiteIds: ["C"] }),
      concept("B", { prerequisiteIds: ["A"] }),
      concept("C", { prerequisiteIds: ["B"] })
    ]);
    const closure = collectPersonalizedPrerequisiteClosure({
      prerequisiteIndex: index,
      targetConceptId: "C",
      isSatisfiedConcept: () => false
    });
    expect(closure).not.toBeNull();
    expect(closure!.activeConceptIds.size).toBe(3);
  });
});

describe("buildPersonalizedConceptLearningSequence", () => {
  it("simple chain: B が satisfied なら A は入らず C と Target が残る", () => {
    const index = buildConceptPrerequisiteIndex([
      concept("A"),
      concept("B", { prerequisiteIds: ["A"] }),
      concept("C", { prerequisiteIds: ["B"] }),
      concept("Target", { prerequisiteIds: ["C"] })
    ]);
    const masteryByConceptId = masteryMap(
      mastery("A", "unlearned", "none"),
      mastery("B", "mastered", "high"),
      mastery("C", "developing", "medium"),
      mastery("Target", "unlearned", "none")
    );
    const result = buildPersonalizedConceptLearningSequence({
      targetConceptId: "Target",
      prerequisiteIndex: index,
      masteryByConceptId
    });
    expect(result.status).toBe("ok");
    expect(idsOf(result)).toEqual(["C", "Target"]);
    expect(boundaryIds(result)).toEqual(["B"]);
    expect(idsOf(result)).not.toContain("A");
    expect(result.satisfiedBoundaries[0]).toMatchObject({
      conceptId: "B",
      reason: "satisfied-prerequisite",
      masteryState: "mastered",
      confidence: "high"
    });

    const full = buildConceptLearningSequence({
      targetConceptId: "Target",
      prerequisiteIndex: index
    });
    expect(full.items.map((item) => item.conceptId)).toEqual(["A", "B", "C", "Target"]);
  });

  it("satisfied が無ければ #120 full sequence と items の順序が一致する", () => {
    const index = buildConceptPrerequisiteIndex([
      concept("A"),
      concept("B"),
      concept("C", { prerequisiteIds: ["A", "B"] }),
      concept("Target", { prerequisiteIds: ["C"] })
    ]);
    const masteryByConceptId = masteryMap(
      mastery("A", "unlearned", "none"),
      mastery("B", "learning", "medium"),
      mastery("C", "developing", "high"),
      mastery("Target", "unlearned", "none")
    );
    const full = buildConceptLearningSequence({
      targetConceptId: "Target",
      prerequisiteIndex: index
    });
    const personalized = buildPersonalizedConceptLearningSequence({
      targetConceptId: "Target",
      prerequisiteIndex: index,
      masteryByConceptId,
      fullSequence: full
    });
    expect(personalized.status).toBe("ok");
    expect(idsOf(personalized)).toEqual(full.items.map((item) => item.conceptId));
    expect(personalized.items.map((item) => item.prerequisiteDepth)).toEqual(
      full.items.map((item) => item.prerequisiteDepth)
    );
    expect(boundaryIds(personalized)).toEqual([]);
  });

  it("直接の前提がすべて satisfied なら target のみ", () => {
    const index = buildConceptPrerequisiteIndex([
      concept("A"),
      concept("B"),
      concept("Target", { prerequisiteIds: ["A", "B"] })
    ]);
    const result = buildPersonalizedConceptLearningSequence({
      targetConceptId: "Target",
      prerequisiteIndex: index,
      masteryByConceptId: masteryMap(
        mastery("A", "mastered", "high"),
        mastery("B", "mastered", "high"),
        mastery("Target", "unlearned", "none")
      )
    });
    expect(idsOf(result)).toEqual(["Target"]);
    expect(boundaryIds(result)).toEqual(["A", "B"]);
  });

  it("target が mastered/high なら items は target のみで traversal しない", () => {
    const index = buildConceptPrerequisiteIndex([
      concept("A"),
      concept("Target", { prerequisiteIds: ["A"] })
    ]);
    const result = buildPersonalizedConceptLearningSequence({
      targetConceptId: "Target",
      prerequisiteIndex: index,
      masteryByConceptId: masteryMap(
        mastery("A", "unlearned", "none"),
        mastery("Target", "mastered", "high")
      )
    });
    expect(result).toMatchObject({
      status: "ok",
      items: [{ conceptId: "Target", isTarget: true, reason: "target" }],
      satisfiedBoundaries: [],
      targetAlreadyMastered: true
    });
    expect(idsOf(result)).toEqual(["Target"]);
  });

  it("target が mastered/medium でも targetAlreadyMastered", () => {
    const index = buildConceptPrerequisiteIndex([
      concept("A"),
      concept("Target", { prerequisiteIds: ["A"] })
    ]);
    const result = buildPersonalizedConceptLearningSequence({
      targetConceptId: "Target",
      prerequisiteIndex: index,
      masteryByConceptId: masteryMap(
        mastery("A", "developing", "medium"),
        mastery("Target", "mastered", "medium")
      )
    });
    expect(result.targetAlreadyMastered).toBe(true);
    expect(idsOf(result)).toEqual(["Target"]);
    expect(boundaryIds(result)).toEqual([]);
  });

  it("target が mastered/low なら trusted mastered ではなく traversal する", () => {
    const index = buildConceptPrerequisiteIndex([
      concept("A"),
      concept("Target", { prerequisiteIds: ["A"] })
    ]);
    const result = buildPersonalizedConceptLearningSequence({
      targetConceptId: "Target",
      prerequisiteIndex: index,
      masteryByConceptId: masteryMap(
        mastery("A", "unlearned", "none"),
        mastery("Target", "mastered", "low")
      )
    });
    expect(result.targetAlreadyMastered).toBe(false);
    expect(idsOf(result)).toEqual(["A", "Target"]);
    expect(reasonOf(result, "A")).toBe("needs-learning");
    expect(reasonOf(result, "Target")).toBe("target");
  });

  it("shared ancestor: B が satisfied でも C branch から A を残す", () => {
    const index = buildConceptPrerequisiteIndex([
      concept("A"),
      concept("B", { prerequisiteIds: ["A"] }),
      concept("C", { prerequisiteIds: ["A"] }),
      concept("Target", { prerequisiteIds: ["B", "C"] })
    ]);
    const result = buildPersonalizedConceptLearningSequence({
      targetConceptId: "Target",
      prerequisiteIndex: index,
      masteryByConceptId: masteryMap(
        mastery("A", "unlearned", "none"),
        mastery("B", "mastered", "high"),
        mastery("C", "developing", "medium"),
        mastery("Target", "unlearned", "none")
      )
    });
    expect(idsOf(result)).toEqual(["A", "C", "Target"]);
    expect(boundaryIds(result)).toEqual(["B"]);
  });

  it("複数 satisfied boundary では祖先まで遡らない", () => {
    const index = buildConceptPrerequisiteIndex([
      concept("A"),
      concept("B", { prerequisiteIds: ["A"] }),
      concept("C"),
      concept("D", { prerequisiteIds: ["C"] }),
      concept("Target", { prerequisiteIds: ["B", "D"] })
    ]);
    const result = buildPersonalizedConceptLearningSequence({
      targetConceptId: "Target",
      prerequisiteIndex: index,
      masteryByConceptId: masteryMap(
        mastery("A", "unlearned", "none"),
        mastery("B", "mastered", "high"),
        mastery("C", "unlearned", "none"),
        mastery("D", "mastered", "high"),
        mastery("Target", "learning", "medium")
      )
    });
    expect(idsOf(result)).toEqual(["Target"]);
    expect(boundaryIds(result)).toEqual(["B", "D"]);
    expect(idsOf(result)).not.toContain("A");
    expect(idsOf(result)).not.toContain("C");
  });

  it("insufficient-data は active で insufficient-evidence", () => {
    const index = buildConceptPrerequisiteIndex([
      concept("A"),
      concept("Target", { prerequisiteIds: ["A"] })
    ]);
    const result = buildPersonalizedConceptLearningSequence({
      targetConceptId: "Target",
      prerequisiteIndex: index,
      masteryByConceptId: masteryMap(
        mastery("A", "insufficient-data", "low"),
        mastery("Target", "unlearned", "none")
      )
    });
    expect(idsOf(result)).toEqual(["A", "Target"]);
    expect(reasonOf(result, "A")).toBe("insufficient-evidence");
    expect(boundaryIds(result)).toEqual([]);
  });

  it("map に無い prerequisite は active / insufficient-evidence", () => {
    const index = buildConceptPrerequisiteIndex([
      concept("A"),
      concept("Target", { prerequisiteIds: ["A"] })
    ]);
    const result = buildPersonalizedConceptLearningSequence({
      targetConceptId: "Target",
      prerequisiteIndex: index,
      masteryByConceptId: masteryMap(mastery("Target", "unlearned", "none"))
    });
    expect(idsOf(result)).toEqual(["A", "Target"]);
    expect(reasonOf(result, "A")).toBe("insufficient-evidence");
    expect(isSatisfiedPrerequisite(undefined)).toBe(false);
  });

  it("unlearned は active / needs-learning で boundary にしない", () => {
    const index = buildConceptPrerequisiteIndex([
      concept("A"),
      concept("Target", { prerequisiteIds: ["A"] })
    ]);
    const result = buildPersonalizedConceptLearningSequence({
      targetConceptId: "Target",
      prerequisiteIndex: index,
      masteryByConceptId: masteryMap(
        mastery("A", "unlearned", "none"),
        mastery("Target", "unlearned", "none")
      )
    });
    expect(idsOf(result)).toEqual(["A", "Target"]);
    expect(reasonOf(result, "A")).toBe("needs-learning");
    expect(boundaryIds(result)).toEqual([]);
  });

  it("mastered + low は active / insufficient-evidence", () => {
    const index = buildConceptPrerequisiteIndex([
      concept("A"),
      concept("Target", { prerequisiteIds: ["A"] })
    ]);
    const result = buildPersonalizedConceptLearningSequence({
      targetConceptId: "Target",
      prerequisiteIndex: index,
      masteryByConceptId: masteryMap(
        mastery("A", "mastered", "low"),
        mastery("Target", "unlearned", "none")
      )
    });
    expect(idsOf(result)).toEqual(["A", "Target"]);
    expect(reasonOf(result, "A")).toBe("insufficient-evidence");
    expect(boundaryIds(result)).toEqual([]);
  });

  it("stale な mastered/high は satisfied boundary", () => {
    const index = buildConceptPrerequisiteIndex([
      concept("A"),
      concept("Target", { prerequisiteIds: ["A"] })
    ]);
    const result = buildPersonalizedConceptLearningSequence({
      targetConceptId: "Target",
      prerequisiteIndex: index,
      masteryByConceptId: masteryMap(
        mastery("A", "mastered", "high", { freshness: "stale" }),
        mastery("Target", "unlearned", "none")
      )
    });
    expect(idsOf(result)).toEqual(["Target"]);
    expect(boundaryIds(result)).toEqual(["A"]);
    expect(result.satisfiedBoundaries[0]?.reason).toBe("satisfied-prerequisite");
  });

  it("active に残った P → D は必ず index(P) < index(D)", () => {
    const index = buildConceptPrerequisiteIndex([
      concept("A"),
      concept("B", { prerequisiteIds: ["A"] }),
      concept("C", { prerequisiteIds: ["A"] }),
      concept("Target", { prerequisiteIds: ["B", "C"] })
    ]);
    const result = buildPersonalizedConceptLearningSequence({
      targetConceptId: "Target",
      prerequisiteIndex: index,
      masteryByConceptId: masteryMap(
        mastery("A", "unlearned", "none"),
        mastery("B", "developing", "medium"),
        mastery("C", "learning", "medium"),
        mastery("Target", "unlearned", "none")
      )
    });
    expect(result.status).toBe("ok");
    const order = new Map(result.items.map((item, itemIndex) => [item.conceptId, itemIndex]));
    const included = new Set(idsOf(result));
    for (const dependentId of included) {
      const prerequisites = index.prerequisitesByConceptId.get(dependentId) ?? [];
      for (const prerequisiteId of prerequisites) {
        if (!included.has(prerequisiteId)) {
          continue;
        }
        expect(order.get(prerequisiteId)!).toBeLessThan(order.get(dependentId)!);
      }
    }
    expect(idsOf(result).at(-1)).toBe("Target");
  });

  it("同一 input なら items も boundary も毎回同じ", () => {
    const index = buildConceptPrerequisiteIndex([
      concept("C"),
      concept("B"),
      concept("A"),
      concept("Target", { prerequisiteIds: ["B", "A"] })
    ]);
    const masteryByConceptId = masteryMap(
      mastery("A", "mastered", "high"),
      mastery("B", "mastered", "medium"),
      mastery("C", "unlearned", "none"),
      mastery("Target", "developing", "medium")
    );
    const first = buildPersonalizedConceptLearningSequence({
      targetConceptId: "Target",
      prerequisiteIndex: index,
      masteryByConceptId
    });
    const second = buildPersonalizedConceptLearningSequence({
      targetConceptId: "Target",
      prerequisiteIndex: index,
      masteryByConceptId
    });
    expect(first).toEqual(second);
    expect(boundaryIds(first)).toEqual(["B", "A"]);
  });

  it("boundary は originalIndex 順で、masteryScore では並べない", () => {
    const index = buildConceptPrerequisiteIndex([
      concept("low-score"),
      concept("high-score"),
      concept("Target", { prerequisiteIds: ["high-score", "low-score"] })
    ]);
    const result = buildPersonalizedConceptLearningSequence({
      targetConceptId: "Target",
      prerequisiteIndex: index,
      masteryByConceptId: masteryMap(
        mastery("low-score", "mastered", "high", { masteryScore: 80 }),
        mastery("high-score", "mastered", "medium", { masteryScore: 99 }),
        mastery("Target", "unlearned", "none")
      )
    });
    expect(boundaryIds(result)).toEqual(["low-score", "high-score"]);
  });

  it("relatedIds だけの Concept は active prerequisite にしない", () => {
    const result = buildPersonalizedConceptLearningSequence({
      targetConceptId: "B",
      prerequisiteIndex: buildConceptPrerequisiteIndex([
        concept("A", { relatedIds: ["B"] }),
        concept("B", { relatedIds: ["A"] })
      ]),
      masteryByConceptId: masteryMap(
        mastery("A", "unlearned", "none"),
        mastery("B", "unlearned", "none")
      )
    });
    expect(idsOf(result)).toEqual(["B"]);
  });

  it("target 不存在は throw せず target-not-found", () => {
    const result = buildPersonalizedConceptLearningSequence({
      targetConceptId: "missing",
      prerequisiteIndex: buildConceptPrerequisiteIndex([concept("A")]),
      masteryByConceptId: new Map()
    });
    expect(result).toEqual({
      status: "target-not-found",
      targetConceptId: "missing",
      items: [],
      satisfiedBoundaries: [],
      targetAlreadyMastered: false
    });
  });

  it("target closure の cycle は cycle-detected で空 items", () => {
    const result = buildPersonalizedConceptLearningSequence({
      targetConceptId: "C",
      prerequisiteIndex: buildConceptPrerequisiteIndex([
        concept("A", { prerequisiteIds: ["C"] }),
        concept("B", { prerequisiteIds: ["A"] }),
        concept("C", { prerequisiteIds: ["B"] })
      ]),
      masteryByConceptId: masteryMap(
        mastery("A", "unlearned", "none"),
        mastery("B", "unlearned", "none"),
        mastery("C", "unlearned", "none")
      )
    });
    expect(result).toEqual({
      status: "cycle-detected",
      targetConceptId: "C",
      items: [],
      satisfiedBoundaries: [],
      targetAlreadyMastered: false
    });
  });

  it("target 外の cycle では personalized を失敗させない", () => {
    const result = buildPersonalizedConceptLearningSequence({
      targetConceptId: "Target",
      prerequisiteIndex: buildConceptPrerequisiteIndex([
        concept("A"),
        concept("Target", { prerequisiteIds: ["A"] }),
        concept("X", { prerequisiteIds: ["Y"] }),
        concept("Y", { prerequisiteIds: ["X"] })
      ]),
      masteryByConceptId: masteryMap(
        mastery("A", "unlearned", "none"),
        mastery("Target", "unlearned", "none")
      )
    });
    expect(result.status).toBe("ok");
    expect(idsOf(result)).toEqual(["A", "Target"]);
  });

  it("空の mastery map なら #120 と同じ sequence", () => {
    const index = buildConceptPrerequisiteIndex([
      concept("A"),
      concept("B", { prerequisiteIds: ["A"] }),
      concept("Target", { prerequisiteIds: ["B"] })
    ]);
    const full = buildConceptLearningSequence({
      targetConceptId: "Target",
      prerequisiteIndex: index
    });
    const personalized = buildPersonalizedConceptLearningSequence({
      targetConceptId: "Target",
      prerequisiteIndex: index,
      masteryByConceptId: new Map()
    });
    expect(idsOf(personalized)).toEqual(full.items.map((item) => item.conceptId));
  });
});
