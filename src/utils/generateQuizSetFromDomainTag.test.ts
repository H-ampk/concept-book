import { describe, expect, it } from "vitest";
import { createEmptyConceptInput, type Concept } from "../types/concept";
import { QUIZ_QUESTION_SCHEMA_VERSION, type QuizQuestion } from "../types/quiz";
import {
  generateForConcept,
  generateQuizSetFromDomainTag
} from "./generateQuizSetFromDomainTag";
import {
  collectExistingDuplicateKeys,
  collectExistingGeneratedQuestionConceptIds,
  isLegacyConceptGeneralQuestion
} from "./quizQuestionSource";

const iso = "2026-01-01T00:00:00.000Z";

const concept = (id: string, extras: Partial<Concept> = {}): Concept => ({
  ...createEmptyConceptInput(),
  id,
  title: extras.title ?? id,
  definition: extras.definition ?? `${id} の一般定義。他と区別できる説明です。`,
  domainTags: extras.domainTags ?? ["情報科学"],
  createdAt: iso,
  updatedAt: iso,
  ...extras
});

const distractors = (): Concept[] => [
  concept("b", {
    title: "概念B",
    definition: "Bの別説明。十分な長さの定義文です。",
    domainTags: ["その他"]
  }),
  concept("c", {
    title: "概念C",
    definition: "Cの別説明。十分な長さの定義文です。",
    domainTags: ["その他"]
  }),
  concept("d", {
    title: "概念D",
    definition: "Dの別説明。十分な長さの定義文です。",
    domainTags: ["その他"]
  })
];

const conceptA = (extras: Partial<Concept> = {}): Concept =>
  concept("a", {
    title: "概念A",
    definition: "Aの一般定義。十分な長さの定義文です。",
    domainTags: ["AI", "情報科学"],
    ...extras
  });

const allConcepts = (target: Concept): Concept[] => [target, ...distractors()];

const question = (overrides: Partial<QuizQuestion> = {}): QuizQuestion => ({
  id: "q-1",
  questionType: "multiple-choice",
  prompt: "問い",
  choices: [
    { id: "a", text: "A" },
    { id: "b", text: "B" }
  ],
  correctChoiceId: "a",
  visibility: "private",
  schemaVersion: QUIZ_QUESTION_SCHEMA_VERSION,
  createdAt: iso,
  updatedAt: iso,
  ...overrides
});

describe("concept-general source と duplicate 判定", () => {
  it("concept-general 生成 Question に conceptGeneral source を付ける", () => {
    const target = conceptA();
    const preview = generateQuizSetFromDomainTag({
      quizSetTitle: "情報科学セット",
      targetDomainTag: "情報科学",
      generationMode: "concept-general",
      allConcepts: allConcepts(target),
      allContextCards: []
    });
    expect(preview.questions).toHaveLength(1);
    expect(preview.questions[0]?.question.source).toEqual({
      type: "conceptGeneral",
      sourceId: "a",
      sourceTitle: "概念A",
      fieldName: "情報科学"
    });
  });

  it("fieldName は targetDomainTag であり domainTags[0] ではない", () => {
    const target = conceptA();
    const outcome = generateForConcept(
      target,
      "concept-general",
      allConcepts(target),
      [],
      { targetDomainTag: "情報科学" }
    );
    expect("failed" in outcome).toBe(false);
    if ("failed" in outcome) {
      return;
    }
    expect(outcome.question.source?.fieldName).toBe("情報科学");
    expect(outcome.question.source?.fieldName).not.toBe("AI");
  });

  it("同じ Concept の concept-general を再生成しても新規問題は 0 件", () => {
    const target = conceptA();
    const first = generateQuizSetFromDomainTag({
      quizSetTitle: "1",
      targetDomainTag: "情報科学",
      generationMode: "concept-general",
      allConcepts: allConcepts(target),
      allContextCards: []
    });
    expect(first.questions).toHaveLength(1);
    const second = generateQuizSetFromDomainTag({
      quizSetTitle: "2",
      targetDomainTag: "情報科学",
      generationMode: "concept-general",
      allConcepts: allConcepts(target),
      allContextCards: [],
      existingQuestions: first.questions.map((item) => item.question)
    });
    expect(second.questions.filter((item) => item.conceptId === "a")).toHaveLength(0);
  });

  it("legacy source-less general があると同じ Concept の再生成を skip する", () => {
    const target = conceptA();
    const legacy = question({
      id: "legacy-a",
      conceptId: "a",
      choices: [
        {
          id: "correct",
          text: "Aの一般定義。十分な長さの定義文です。",
          sourceConceptId: "a",
          contextDefinitionId: "general_a",
          sourceStrategy: "correct"
        },
        { id: "x", text: "誤答" }
      ],
      correctChoiceId: "correct"
    });
    expect(isLegacyConceptGeneralQuestion(legacy)).toBe(true);
    const preview = generateQuizSetFromDomainTag({
      quizSetTitle: "legacy",
      targetDomainTag: "情報科学",
      generationMode: "concept-general",
      allConcepts: allConcepts(target),
      allContextCards: [],
      existingQuestions: [legacy]
    });
    expect(preview.questions.filter((item) => item.conceptId === "a")).toHaveLength(0);
  });

  it("別 Concept は既存 general があっても生成できる", () => {
    const a = conceptA();
    const b = concept("b", {
      title: "概念B",
      definition: "Bの別説明。十分な長さの定義文です。",
      domainTags: ["情報科学"]
    });
    const extra = [
      concept("c", { title: "概念C", definition: "Cの別説明。十分な長さの定義文です。" }),
      concept("d", { title: "概念D", definition: "Dの別説明。十分な長さの定義文です。" }),
      concept("e", { title: "概念E", definition: "Eの別説明。十分な長さの定義文です。" })
    ];
    const first = generateQuizSetFromDomainTag({
      quizSetTitle: "1",
      targetDomainTag: "情報科学",
      generationMode: "concept-general",
      allConcepts: [a, b, ...extra],
      allContextCards: []
    });
    const existingA = first.questions.filter((item) => item.conceptId === "a").map((item) => item.question);
    expect(existingA.length).toBeGreaterThan(0);
    const second = generateQuizSetFromDomainTag({
      quizSetTitle: "2",
      targetDomainTag: "情報科学",
      generationMode: "concept-general",
      allConcepts: [b, ...extra],
      allContextCards: [],
      existingQuestions: existingA
    });
    expect(second.questions.some((item) => item.conceptId === "b")).toBe(true);
    expect(second.questions.some((item) => item.conceptId === "a")).toBe(false);
  });

  it("auto は既存 contextual があると general fallback しない", () => {
    const target = conceptA({
      contextDefinitions: [
        { id: "ctx-a", context: "統計", definition: "Aの文脈別定義。十分な長さです。" }
      ]
    });
    const existing = question({
      id: "ctx-q",
      conceptId: "a",
      source: {
        type: "contextualConceptCard",
        sourceId: "a:ctx-a",
        sourceTitle: "概念A",
        fieldName: "統計"
      }
    });
    const preview = generateQuizSetFromDomainTag({
      quizSetTitle: "auto",
      targetDomainTag: "情報科学",
      generationMode: "auto",
      allConcepts: allConcepts(target),
      allContextCards: [],
      existingQuestions: [existing]
    });
    expect(preview.questions.filter((item) => item.conceptId === "a")).toHaveLength(0);
  });

  it("auto は既存 conceptGeneral があると fallback しない", () => {
    const target = conceptA();
    const existing = question({
      id: "gen-q",
      conceptId: "a",
      source: {
        type: "conceptGeneral",
        sourceId: "a",
        sourceTitle: "概念A",
        fieldName: "情報科学"
      }
    });
    const preview = generateQuizSetFromDomainTag({
      quizSetTitle: "auto",
      targetDomainTag: "情報科学",
      generationMode: "auto",
      allConcepts: allConcepts(target),
      allContextCards: [],
      existingQuestions: [existing]
    });
    expect(preview.questions.filter((item) => item.conceptId === "a")).toHaveLength(0);
  });

  it("auto は legacy general があっても fallback しない", () => {
    const target = conceptA();
    const legacy = question({
      id: "legacy-a",
      conceptId: "a",
      choices: [
        {
          id: "correct",
          text: "Aの一般定義",
          sourceConceptId: "a",
          contextDefinitionId: "general_a",
          sourceStrategy: "correct"
        },
        { id: "x", text: "誤答" }
      ],
      correctChoiceId: "correct"
    });
    const preview = generateQuizSetFromDomainTag({
      quizSetTitle: "auto",
      targetDomainTag: "情報科学",
      generationMode: "auto",
      allConcepts: allConcepts(target),
      allContextCards: [],
      existingQuestions: [legacy]
    });
    expect(preview.questions.filter((item) => item.conceptId === "a")).toHaveLength(0);
  });

  it("auto は既存 generated が無ければ concept-general fallback する", () => {
    const target = conceptA();
    const preview = generateQuizSetFromDomainTag({
      quizSetTitle: "auto",
      targetDomainTag: "情報科学",
      generationMode: "auto",
      allConcepts: allConcepts(target),
      allContextCards: []
    });
    expect(preview.questions).toHaveLength(1);
    expect(preview.questions[0]?.modeUsed).toBe("concept-general");
    expect(preview.questions[0]?.question.source?.type).toBe("conceptGeneral");
  });

  it("明示 concept-general は既存 contextual だけでは禁止しない", () => {
    const target = conceptA({
      contextDefinitions: [
        { id: "ctx-a", context: "統計", definition: "Aの文脈別定義。十分な長さです。" }
      ]
    });
    const existing = question({
      id: "ctx-q",
      conceptId: "a",
      source: {
        type: "contextualConceptCard",
        sourceId: "a:ctx-a",
        sourceTitle: "概念A"
      }
    });
    const preview = generateQuizSetFromDomainTag({
      quizSetTitle: "explicit",
      targetDomainTag: "情報科学",
      generationMode: "concept-general",
      allConcepts: allConcepts(target),
      allContextCards: [],
      existingQuestions: [existing]
    });
    expect(preview.questions.filter((item) => item.conceptId === "a")).toHaveLength(1);
    expect(preview.questions[0]?.question.source?.type).toBe("conceptGeneral");
  });

  it("collectExistingDuplicateKeys は conceptGeneral と legacy を同じ key 空間に載せる", () => {
    const modern = question({
      id: "modern",
      conceptId: "a",
      source: { type: "conceptGeneral", sourceId: "a", sourceTitle: "概念A" }
    });
    const legacy = question({
      id: "legacy",
      conceptId: "a",
      choices: [
        {
          id: "correct",
          text: "A",
          sourceConceptId: "a",
          contextDefinitionId: "general_a"
        }
      ],
      correctChoiceId: "correct"
    });
    const keys = collectExistingDuplicateKeys([modern, legacy]);
    expect(keys.has("conceptGeneral:a:a")).toBe(true);
    expect(collectExistingGeneratedQuestionConceptIds([modern, legacy]).has("a")).toBe(true);
  });

  it("manual Question は Concept ID だけでは duplicate にしない", () => {
    const target = conceptA();
    const manual = question({
      id: "manual",
      conceptId: "a",
      prompt: "手作業の問題",
      choices: [
        { id: "correct", text: "手作業の正解" },
        { id: "x", text: "誤答" }
      ],
      correctChoiceId: "correct"
    });
    expect(isLegacyConceptGeneralQuestion(manual)).toBe(false);
    const preview = generateQuizSetFromDomainTag({
      quizSetTitle: "manual",
      targetDomainTag: "情報科学",
      generationMode: "concept-general",
      allConcepts: allConcepts(target),
      allContextCards: [],
      existingQuestions: [manual]
    });
    expect(preview.questions.filter((item) => item.conceptId === "a")).toHaveLength(1);
  });
});
