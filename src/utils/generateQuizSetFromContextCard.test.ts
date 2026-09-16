import { describe, expect, it } from "vitest";
import { createEmptyConceptInput, type Concept } from "../types/concept";
import type { ContextCard } from "../types/contextCard";
import { generateQuizSetFromContextCard } from "./generateQuizSetFromContextCard";

const iso = "2026-01-01T00:00:00.000Z";
const domain = "情報科学";

const concept = (id: string, title: string, extras: Partial<Concept> = {}): Concept => ({
  ...createEmptyConceptInput(),
  id,
  title,
  domainTags: extras.domainTags ?? [domain],
  createdAt: extras.createdAt ?? iso,
  updatedAt: extras.updatedAt ?? iso,
  contextDefinitions: extras.contextDefinitions ?? [
    {
      id: `${id}-ctx`,
      context: domain,
      definition: `${title} は文脈別定義として十分な長さの説明です。`
    }
  ],
  ...extras
});

const uniqueSupportConcepts = (): Concept[] => [
  concept("concept-db", "DB"),
  concept("concept-os", "OS"),
  concept("concept-cpu", "CPU"),
  concept("concept-ram", "RAM")
];

const contextCard = (keyConcepts: string): ContextCard => ({
  id: "card-1",
  title: domain,
  domain,
  domainTags: [domain],
  centralQuestion: "",
  background: "",
  flow: "",
  keyConcepts,
  linkedConcepts: [],
  createdAt: iso,
  updatedAt: iso
});

const generate = (allConcepts: Concept[], keyConcepts: string) =>
  generateQuizSetFromContextCard({
    contextCard: contextCard(keyConcepts),
    allConcepts,
    existingQuestions: []
  });

const questionTerms = (preview: ReturnType<typeof generate>) =>
  preview.questions.map((draft) => draft.term);

describe("generateQuizSetFromContextCard 同名 Concept 解決", () => {
  it("同名 Concept が2件ある重要語句からは Quiz を生成しない", () => {
    const preview = generate(
      [
        concept("concept-ai-1", "AI"),
        concept("concept-ai-2", "AI"),
        ...uniqueSupportConcepts()
      ],
      "AI"
    );

    expect(preview.questions.some((draft) => draft.term === "AI")).toBe(false);
    expect(preview.excludedTerms).toContainEqual({
      term: "AI",
      reason: "ambiguous-concept"
    });
  });

  it("同名 Concept の配列順を逆転しても AI の Quiz は生成されない", () => {
    const a1 = concept("concept-ai-1", "AI");
    const a2 = concept("concept-ai-2", "AI");
    const support = uniqueSupportConcepts();

    const first = generate([a1, a2, ...support], "AI");
    const second = generate([a2, a1, ...support], "AI");

    expect(questionTerms(first)).not.toContain("AI");
    expect(questionTerms(second)).not.toContain("AI");
    expect(first.excludedTerms).toContainEqual({
      term: "AI",
      reason: "ambiguous-concept"
    });
    expect(second.excludedTerms).toContainEqual({
      term: "AI",
      reason: "ambiguous-concept"
    });
  });

  it("同名 Concept の updatedAt を逆転しても AI の Quiz は生成されない", () => {
    const support = uniqueSupportConcepts();
    const newerFirst = generate(
      [
        concept("concept-ai-1", "AI", { updatedAt: "2026-02-01T00:00:00.000Z" }),
        concept("concept-ai-2", "AI", { updatedAt: "2026-01-01T00:00:00.000Z" }),
        ...support
      ],
      "AI"
    );
    const newerSecond = generate(
      [
        concept("concept-ai-1", "AI", { updatedAt: "2026-01-01T00:00:00.000Z" }),
        concept("concept-ai-2", "AI", { updatedAt: "2026-02-01T00:00:00.000Z" }),
        ...support
      ],
      "AI"
    );

    expect(questionTerms(newerFirst)).not.toContain("AI");
    expect(questionTerms(newerSecond)).not.toContain("AI");
    expect(newerFirst.excludedTerms).toContainEqual({
      term: "AI",
      reason: "ambiguous-concept"
    });
    expect(newerSecond.excludedTerms).toContainEqual({
      term: "AI",
      reason: "ambiguous-concept"
    });
  });

  it("正規化タイトルが一致する同名 Concept も ambiguous として生成しない", () => {
    const preview = generate(
      [
        concept("concept-ai-1", "AI"),
        concept("concept-ai-2", "ＡＩ"),
        concept("concept-ai-3", "AI "),
        ...uniqueSupportConcepts()
      ],
      "AI"
    );

    expect(questionTerms(preview)).not.toContain("AI");
    expect(preview.excludedTerms).toContainEqual({
      term: "AI",
      reason: "ambiguous-concept"
    });
  });

  it("タイトルが一意な Concept は従来どおり生成し provenance を対象 ID にする", () => {
    const db = concept("concept-db", "DB");
    const preview = generate(
      [db, concept("concept-os", "OS"), concept("concept-cpu", "CPU"), concept("concept-ram", "RAM")],
      "DB\nOS\nCPU\nRAM"
    );

    const dbDraft = preview.questions.find((draft) => draft.term === "DB");
    expect(dbDraft).toBeDefined();
    expect(dbDraft?.question.conceptId).toBe("concept-db");

    const correctChoice = dbDraft?.question.choices.find(
      (choice) => choice.id === dbDraft.question.correctChoiceId
    );
    expect(correctChoice?.linkedConceptId).toBe("concept-db");
    expect(correctChoice?.sourceConceptId).toBe("concept-db");
  });

  it("ambiguous な語句と一意な語句が混在しても一意な語句だけ生成する", () => {
    const preview = generate(
      [
        concept("concept-ai-1", "AI"),
        concept("concept-ai-2", "AI"),
        ...uniqueSupportConcepts()
      ],
      "AI\nDB\nOS\nCPU\nRAM"
    );

    expect(questionTerms(preview)).not.toContain("AI");
    expect(preview.excludedTerms).toContainEqual({
      term: "AI",
      reason: "ambiguous-concept"
    });
    expect(questionTerms(preview)).toEqual(expect.arrayContaining(["DB", "OS", "CPU", "RAM"]));
    expect(preview.emptyStateMessage).toBeUndefined();
  });
});
