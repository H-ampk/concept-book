import { describe, expect, it } from "vitest";
import { createEmptyConceptInput, type Concept } from "../types/concept";
import { QUIZ_QUESTION_SCHEMA_VERSION, type QuizChoice, type QuizQuestion } from "../types/quiz";
import {
  applyAutoLinkedConceptIdsToChoices,
  stripInvalidQuizReferences
} from "./quizConceptLink";

const iso = "2026-01-01T00:00:00.000Z";

const concept = (id: string, title: string): Concept => ({
  ...createEmptyConceptInput(),
  id,
  title,
  createdAt: iso,
  updatedAt: iso
});

const provenanceMetadata = {
  displayText: "○○条件づけ",
  sourceConceptId: "c_a",
  contextDefinitionId: "ctx_1",
  sourceStrategy: "same-context" as const
};

const manualMetadata = {
  displayText: "○○条件づけ",
  contextDefinitionId: "ctx_1",
  sourceStrategy: "same-context" as const
};

const provenanceChoice = (overrides: Partial<QuizChoice> = {}): QuizChoice => ({
  id: "choice_a",
  text: "オペラント条件づけ",
  linkedConceptId: "c_a",
  ...provenanceMetadata,
  ...overrides
});

const manualChoice = (overrides: Partial<QuizChoice> = {}): QuizChoice => ({
  id: "choice_a",
  text: "オペラント条件づけ",
  linkedConceptId: "c_old",
  ...manualMetadata,
  ...overrides
});

const questionWithChoices = (choices: QuizChoice[]): QuizQuestion => ({
  id: "q1",
  questionType: "multiple-choice",
  prompt: "問い",
  choices,
  correctChoiceId: choices[0]?.id ?? "choice_a",
  visibility: "private",
  schemaVersion: QUIZ_QUESTION_SCHEMA_VERSION,
  createdAt: iso,
  updatedAt: iso
});

const expectProvenanceMetadataPreserved = (choice: QuizChoice | undefined) => {
  expect(choice?.displayText).toBe(provenanceMetadata.displayText);
  expect(choice?.sourceConceptId).toBe(provenanceMetadata.sourceConceptId);
  expect(choice?.contextDefinitionId).toBe(provenanceMetadata.contextDefinitionId);
  expect(choice?.sourceStrategy).toBe(provenanceMetadata.sourceStrategy);
};

const expectManualMetadataPreserved = (choice: QuizChoice | undefined) => {
  expect(choice?.displayText).toBe(manualMetadata.displayText);
  expect(choice).not.toHaveProperty("sourceConceptId");
  expect(choice?.contextDefinitionId).toBe(manualMetadata.contextDefinitionId);
  expect(choice?.sourceStrategy).toBe(manualMetadata.sourceStrategy);
};

describe("applyAutoLinkedConceptIdsToChoices", () => {
  it("displayText / sourceConceptId / contextDefinitionId / sourceStrategy を保持する", () => {
    const [next] = applyAutoLinkedConceptIdsToChoices(
      [provenanceChoice()],
      [concept("c_a", "オペラント条件づけ")]
    );
    expectProvenanceMetadataPreserved(next);
  });

  it("sourceConceptId のない手動 Choice はテキストが一意一致したら linkedConceptId を付与する", () => {
    const [next] = applyAutoLinkedConceptIdsToChoices(
      [manualChoice({ linkedConceptId: "c_old" })],
      [concept("c_operant", "オペラント条件づけ")]
    );
    expect(next?.linkedConceptId).toBe("c_operant");
    expectManualMetadataPreserved(next);
  });

  it("sourceConceptId のない手動 Choice は一致しなければ既存の linkedConceptId を外し、他 metadata は残す", () => {
    const [next] = applyAutoLinkedConceptIdsToChoices(
      [manualChoice({ text: "一致しない選択肢" })],
      [concept("c_operant", "オペラント条件づけ")]
    );
    expect(next).not.toHaveProperty("linkedConceptId");
    expect(next?.text).toBe("一致しない選択肢");
    expectManualMetadataPreserved(next);
  });

  it("sourceConceptId のない手動 Choice は ambiguous なら linkedConceptId を付けず、他 metadata は残す", () => {
    const [next] = applyAutoLinkedConceptIdsToChoices(
      [manualChoice()],
      [concept("c_a", "オペラント条件づけ"), concept("c_b", "オペラント条件づけ")]
    );
    expect(next).not.toHaveProperty("linkedConceptId");
    expectManualMetadataPreserved(next);
  });

  it("provenance 付き Choice は Concept が rename されても既存 linkedConceptId を保持する", () => {
    const [next] = applyAutoLinkedConceptIdsToChoices(
      [provenanceChoice({ text: "AI" })],
      [concept("c_a", "人工知能")]
    );
    expect(next?.linkedConceptId).toBe("c_a");
    expectProvenanceMetadataPreserved(next);
  });

  it("provenance 付き Choice は ambiguous でも有効な既存 linkedConceptId を保持する", () => {
    const [next] = applyAutoLinkedConceptIdsToChoices(
      [provenanceChoice()],
      [concept("c_a", "オペラント条件づけ"), concept("c_b", "オペラント条件づけ")]
    );
    expect(next?.linkedConceptId).toBe("c_a");
    expectProvenanceMetadataPreserved(next);
  });

  it("provenance 付き Choice は text を別 Concept 名へ変えても自動付け替えしない", () => {
    const [next] = applyAutoLinkedConceptIdsToChoices(
      [provenanceChoice({ text: "古典的条件づけ" })],
      [concept("c_a", "オペラント条件づけ"), concept("c_b", "古典的条件づけ")]
    );
    expect(next?.linkedConceptId).toBe("c_a");
    expect(next?.sourceConceptId).toBe("c_a");
    expectProvenanceMetadataPreserved(next);
  });

  it("provenance 付き Choice の dangling linkedConceptId は除去し、タイトル照合で付け替えない", () => {
    const [next] = applyAutoLinkedConceptIdsToChoices(
      [provenanceChoice({ linkedConceptId: "missing", text: "古典的条件づけ" })],
      [concept("c_a", "オペラント条件づけ"), concept("c_b", "古典的条件づけ")]
    );
    expect(next).not.toHaveProperty("linkedConceptId");
    expect(next?.text).toBe("古典的条件づけ");
    expectProvenanceMetadataPreserved(next);
  });

  it("{ id, text } だけの旧 Choice も従来通り動作し、不要な undefined フィールドを足さない", () => {
    const [next] = applyAutoLinkedConceptIdsToChoices(
      [{ id: "legacy", text: "古典的条件づけ" }],
      [concept("c_classical", "古典的条件づけ")]
    );
    expect(next).toEqual({
      id: "legacy",
      text: "古典的条件づけ",
      linkedConceptId: "c_classical"
    });
    expect(next).not.toHaveProperty("displayText");
    expect(next).not.toHaveProperty("sourceConceptId");
    expect(next).not.toHaveProperty("contextDefinitionId");
    expect(next).not.toHaveProperty("sourceStrategy");
  });
});

describe("stripInvalidQuizReferences", () => {
  it("有効な linkedConceptId と Choice metadata を保持する", () => {
    const stripped = stripInvalidQuizReferences(
      questionWithChoices([provenanceChoice({ linkedConceptId: "c_operant" })]),
      new Set(["c_operant", "c_source"])
    );
    const choice = stripped.choices[0];
    expect(choice?.linkedConceptId).toBe("c_operant");
    expect(choice?.id).toBe("choice_a");
    expect(choice?.text).toBe("オペラント条件づけ");
    expectProvenanceMetadataPreserved(choice);
  });

  it("無効な linkedConceptId だけを除去し、他 metadata は残す", () => {
    const stripped = stripInvalidQuizReferences(
      questionWithChoices([provenanceChoice({ linkedConceptId: "missing_concept" })]),
      new Set(["c_source"])
    );
    const choice = stripped.choices[0];
    expect(choice).not.toHaveProperty("linkedConceptId");
    expect(choice?.id).toBe("choice_a");
    expect(choice?.text).toBe("オペラント条件づけ");
    expectProvenanceMetadataPreserved(choice);
  });

  it("空文字の linkedConceptId を除去する", () => {
    const stripped = stripInvalidQuizReferences(
      questionWithChoices([provenanceChoice({ linkedConceptId: "   " })]),
      new Set(["c_operant"])
    );
    expect(stripped.choices[0]).not.toHaveProperty("linkedConceptId");
    expectProvenanceMetadataPreserved(stripped.choices[0]);
  });

  it("sourceConceptId は参照整合性チェックせず保持する", () => {
    const stripped = stripInvalidQuizReferences(
      questionWithChoices([provenanceChoice({ sourceConceptId: "orphan_source" })]),
      new Set(["c_operant"])
    );
    expect(stripped.choices[0]?.sourceConceptId).toBe("orphan_source");
  });

  it("{ id, text } だけの旧 Choice を従来通り通す", () => {
    const stripped = stripInvalidQuizReferences(
      questionWithChoices([{ id: "legacy", text: "本文" }]),
      new Set(["c_operant"])
    );
    expect(stripped.choices[0]).toEqual({ id: "legacy", text: "本文" });
  });
});
