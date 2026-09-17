import { describe, expect, it } from "vitest";
import { createEmptyConceptInput, type Concept } from "../types/concept";
import type { QuizChoice, QuizQuestionSource } from "../types/quiz";
import { resolveQuizContextDefinition } from "./resolveQuizContextDefinition";

const iso = "2026-01-01T00:00:00.000Z";

const concept = (overrides: Partial<Concept> = {}): Concept => ({
  ...createEmptyConceptInput(),
  id: "concept-a",
  title: "Concept A",
  createdAt: iso,
  updatedAt: iso,
  ...overrides
});

const choice = (
  overrides: Partial<
    Pick<
      QuizChoice,
      "text" | "displayText" | "linkedConceptId" | "sourceConceptId" | "contextDefinitionId"
    >
  > = {}
) => ({
  text: "D1 snapshot",
  displayText: "D1 snapshot",
  sourceConceptId: "concept-a",
  contextDefinitionId: "d1",
  ...overrides
});

const contextualSource = (sourceId = "concept-a:d1"): QuizQuestionSource => ({
  type: "contextualConceptCard",
  sourceId,
  sourceTitle: "Concept A"
});

describe("resolveQuizContextDefinition", () => {
  it("明示 ID の定義が削除されても別の contextDefinition へ fallback しない", () => {
    const result = resolveQuizContextDefinition(
      choice(),
      [
        concept({
          contextDefinitions: [{ id: "d2", context: "文脈B", definition: "D2 live" }]
        })
      ],
      "Concept A",
      contextualSource()
    );

    expect(result.status).toBe("ok");
    expect(result.definition).toBe("D1 snapshot");
    expect(result.definition).not.toBe("D2 live");
  });

  it("同一 ID の本文が編集されていれば live 定義を使う", () => {
    const result = resolveQuizContextDefinition(
      choice({ text: "D1 snapshot", displayText: "D1 snapshot" }),
      [
        concept({
          contextDefinitions: [
            { id: "d1", context: "文脈A", definition: "D1 live edited" },
            { id: "d2", context: "文脈B", definition: "D2 live" }
          ]
        })
      ],
      "Concept A",
      contextualSource()
    );

    expect(result.status).toBe("ok");
    expect(result.definition).toBe("D1 live edited");
  });

  it("contextDefinitionId がない legacy Quiz は source fallback を維持する", () => {
    const result = resolveQuizContextDefinition(
      choice({ contextDefinitionId: undefined, text: "Concept A" }),
      [
        concept({
          contextDefinitions: [
            { id: "d1", context: "文脈A", definition: "D1 live" },
            { id: "d2", context: "文脈B", definition: "D2 live" }
          ]
        })
      ],
      "Concept A",
      contextualSource()
    );

    expect(result.status).toBe("ok");
    expect(result.definition).toBe("D1 live");
  });

  it("Concept 自体が削除済みなら no-concept を返す", () => {
    const result = resolveQuizContextDefinition(choice(), [], "Concept A", contextualSource());

    expect(result.status).toBe("no-concept");
    expect(result.definition).toBeUndefined();
  });

  it("指定 ID が存在するが本文が空なら別定義へ fallback せず snapshot を使う", () => {
    const result = resolveQuizContextDefinition(
      choice(),
      [
        concept({
          contextDefinitions: [
            { id: "d1", context: "文脈A", definition: "" },
            { id: "d2", context: "文脈B", definition: "別定義" }
          ]
        })
      ],
      "Concept A",
      contextualSource()
    );

    expect(result.status).toBe("ok");
    expect(result.definition).toBe("D1 snapshot");
    expect(result.definition).not.toBe("別定義");
  });
});
