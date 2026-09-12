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

const metadataFields = {
  displayText: "○○条件づけ",
  sourceConceptId: "c_source",
  contextDefinitionId: "ctx_1",
  sourceStrategy: "same-context" as const
};

const fullChoice = (overrides: Partial<QuizChoice> = {}): QuizChoice => ({
  id: "choice_a",
  text: "オペラント条件づけ",
  linkedConceptId: "c_old",
  ...metadataFields,
  ...overrides
});

const questionWithChoices = (choices: QuizChoice[]): QuizQuestion => ({
  id: "q1",
  prompt: "問い",
  choices,
  correctChoiceId: choices[0]?.id ?? "choice_a",
  visibility: "private",
  schemaVersion: QUIZ_QUESTION_SCHEMA_VERSION,
  createdAt: iso,
  updatedAt: iso
});

const expectMetadataPreserved = (choice: QuizChoice | undefined) => {
  expect(choice?.displayText).toBe(metadataFields.displayText);
  expect(choice?.sourceConceptId).toBe(metadataFields.sourceConceptId);
  expect(choice?.contextDefinitionId).toBe(metadataFields.contextDefinitionId);
  expect(choice?.sourceStrategy).toBe(metadataFields.sourceStrategy);
};

describe("applyAutoLinkedConceptIdsToChoices", () => {
  it("displayText / sourceConceptId / contextDefinitionId / sourceStrategy を保持する", () => {
    const [next] = applyAutoLinkedConceptIdsToChoices(
      [fullChoice()],
      [concept("c_operant", "オペラント条件づけ")]
    );
    expectMetadataPreserved(next);
  });

  it("テキストが一意に Concept タイトルと一致したら linkedConceptId を付与する", () => {
    const [next] = applyAutoLinkedConceptIdsToChoices(
      [fullChoice({ linkedConceptId: "c_old" })],
      [concept("c_operant", "オペラント条件づけ")]
    );
    expect(next?.linkedConceptId).toBe("c_operant");
    expectMetadataPreserved(next);
  });

  it("一致しない Choice では既存の linkedConceptId を外し、他 metadata は残す", () => {
    const [next] = applyAutoLinkedConceptIdsToChoices(
      [fullChoice({ text: "一致しない選択肢" })],
      [concept("c_operant", "オペラント条件づけ")]
    );
    expect(next).not.toHaveProperty("linkedConceptId");
    expect(next?.text).toBe("一致しない選択肢");
    expectMetadataPreserved(next);
  });

  it("ambiguous な Choice では linkedConceptId を付けず、他 metadata は残す", () => {
    const [next] = applyAutoLinkedConceptIdsToChoices(
      [fullChoice()],
      [concept("c_a", "オペラント条件づけ"), concept("c_b", "オペラント条件づけ")]
    );
    expect(next).not.toHaveProperty("linkedConceptId");
    expectMetadataPreserved(next);
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
      questionWithChoices([fullChoice({ linkedConceptId: "c_operant" })]),
      new Set(["c_operant", "c_source"])
    );
    const choice = stripped.choices[0];
    expect(choice?.linkedConceptId).toBe("c_operant");
    expect(choice?.id).toBe("choice_a");
    expect(choice?.text).toBe("オペラント条件づけ");
    expectMetadataPreserved(choice);
  });

  it("無効な linkedConceptId だけを除去し、他 metadata は残す", () => {
    const stripped = stripInvalidQuizReferences(
      questionWithChoices([fullChoice({ linkedConceptId: "missing_concept" })]),
      new Set(["c_source"])
    );
    const choice = stripped.choices[0];
    expect(choice).not.toHaveProperty("linkedConceptId");
    expect(choice?.id).toBe("choice_a");
    expect(choice?.text).toBe("オペラント条件づけ");
    expectMetadataPreserved(choice);
  });

  it("空文字の linkedConceptId を除去する", () => {
    const stripped = stripInvalidQuizReferences(
      questionWithChoices([fullChoice({ linkedConceptId: "   " })]),
      new Set(["c_operant"])
    );
    expect(stripped.choices[0]).not.toHaveProperty("linkedConceptId");
    expectMetadataPreserved(stripped.choices[0]);
  });

  it("sourceConceptId は参照整合性チェックせず保持する", () => {
    const stripped = stripInvalidQuizReferences(
      questionWithChoices([fullChoice({ sourceConceptId: "orphan_source" })]),
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
