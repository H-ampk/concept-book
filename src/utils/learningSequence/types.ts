import type { ConceptPrerequisiteIndex } from "../conceptPrerequisites";

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
