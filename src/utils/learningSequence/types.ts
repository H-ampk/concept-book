import type { ConceptPrerequisiteIndex } from "../conceptPrerequisites";
import type { ConceptMastery, MasteryConfidence, MasteryState } from "../mastery/types";

export type PrerequisiteClosure = {
  conceptIds: Set<string>;
  depthByConceptId: Map<string, number>;
};

export type ConceptLearningSequenceItem = {
  conceptId: string;
  prerequisiteDepth: number;
  isTarget: boolean;
};

export type ConceptLearningSequenceOk = {
  status: "ok";
  targetConceptId: string;
  items: ConceptLearningSequenceItem[];
};

export type ConceptLearningSequenceTargetNotFound = {
  status: "target-not-found";
  targetConceptId: string;
  items: [];
};

export type ConceptLearningSequenceCycleDetected = {
  status: "cycle-detected";
  targetConceptId: string;
  items: [];
};

export type ConceptLearningSequenceOrderResult =
  | ConceptLearningSequenceOk
  | ConceptLearningSequenceCycleDetected;

export type ConceptLearningSequenceResult =
  | ConceptLearningSequenceOrderResult
  | ConceptLearningSequenceTargetNotFound;

export type OrderConceptLearningClosureInput = {
  prerequisiteIndex: ConceptPrerequisiteIndex;
  includedConceptIds: ReadonlySet<string>;
  depthByConceptId: ReadonlyMap<string, number>;
  targetConceptId: string;
};

export type BuildConceptLearningSequenceInput = {
  targetConceptId: string;
  prerequisiteIndex: ConceptPrerequisiteIndex;
};

export type LearningSequenceCandidateKey = {
  conceptId: string;
  prerequisiteDepth: number;
};

export type PersonalizedPrerequisiteClosure = {
  activeConceptIds: Set<string>;
  satisfiedBoundaryConceptIds: Set<string>;
  /**
   * Active 経路上の最短 prerequisiteDepth（target = 0）。
   * Adapter は可能な限り #120 full sequence の depth で上書きする。
   */
  depthByConceptId: Map<string, number>;
};

export type CollectPersonalizedPrerequisiteClosureInput = {
  prerequisiteIndex: ConceptPrerequisiteIndex;
  targetConceptId: string;
  isSatisfiedConcept: (conceptId: string) => boolean;
};

export type PersonalizedLearningSequenceReason =
  | "target"
  | "needs-learning"
  | "insufficient-evidence";

export type PersonalizedConceptLearningSequenceItem = {
  conceptId: string;
  prerequisiteDepth: number;
  isTarget: boolean;
  reason: PersonalizedLearningSequenceReason;
  masteryState?: MasteryState;
  confidence?: MasteryConfidence;
};

export type SatisfiedPrerequisiteBoundary = {
  conceptId: string;
  reason: "satisfied-prerequisite";
  masteryState: MasteryState;
  confidence: MasteryConfidence;
};

export type PersonalizedConceptLearningSequenceOk = {
  status: "ok";
  targetConceptId: string;
  items: PersonalizedConceptLearningSequenceItem[];
  satisfiedBoundaries: SatisfiedPrerequisiteBoundary[];
  targetAlreadyMastered: boolean;
};

export type PersonalizedConceptLearningSequenceUnavailable = {
  status: "target-not-found" | "cycle-detected";
  targetConceptId: string;
  items: [];
  satisfiedBoundaries: [];
  targetAlreadyMastered: false;
};

export type PersonalizedConceptLearningSequenceResult =
  | PersonalizedConceptLearningSequenceOk
  | PersonalizedConceptLearningSequenceUnavailable;

export type BuildPersonalizedConceptLearningSequenceInput = {
  targetConceptId: string;
  prerequisiteIndex: ConceptPrerequisiteIndex;
  masteryByConceptId: ReadonlyMap<string, ConceptMastery>;
  /** 既に計算した #120 full sequence。cycle / depth の再利用に使う。 */
  fullSequence?: ConceptLearningSequenceResult;
};
