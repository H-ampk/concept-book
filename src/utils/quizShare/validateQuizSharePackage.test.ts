import { describe, expect, it } from "vitest";
import {
  QUIZ_DECK_SCHEMA_VERSION,
  QUIZ_QUESTION_SCHEMA_VERSION
} from "../../types/quiz";
import { QUIZ_SHARE_FORMAT, QUIZ_SHARE_VERSION } from "../../types/quizShare";
import { validateQuizSharePackage } from "./validateQuizSharePackage";

const iso = "2026-01-01T00:00:00.000Z";

const choice = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  text: id,
  ...extra
});

const question = (overrides: Record<string, unknown> = {}) => ({
  id: "q1",
  questionType: "multiple-choice",
  prompt: "問い",
  choices: [choice("a"), choice("b")],
  correctChoiceId: "a",
  visibility: "shareable",
  schemaVersion: QUIZ_QUESTION_SCHEMA_VERSION,
  createdAt: iso,
  updatedAt: iso,
  ...overrides
});

const deck = (overrides: Record<string, unknown> = {}) => ({
  id: "deck-1",
  title: "共有デッキ",
  questionIds: ["q1"],
  visibility: "shareable",
  schemaVersion: QUIZ_DECK_SCHEMA_VERSION,
  createdAt: iso,
  updatedAt: iso,
  ...overrides
});

const pkg = (overrides: Record<string, unknown> = {}) => ({
  format: QUIZ_SHARE_FORMAT,
  version: QUIZ_SHARE_VERSION,
  exportedAt: iso,
  deck: deck(),
  questions: [question()],
  conceptRefs: [],
  ...overrides
});

describe("validateQuizSharePackage", () => {
  it("最小の valid package を受理する", () => {
    const result = validateQuizSharePackage(pkg());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.format).toBe(QUIZ_SHARE_FORMAT);
      expect(result.data.version).toBe(QUIZ_SHARE_VERSION);
    }
  });

  it("multiple-choice を含む package を受理する", () => {
    const result = validateQuizSharePackage(pkg());
    expect(result.ok).toBe(true);
  });

  it("free-response を含む package を受理する", () => {
    const result = validateQuizSharePackage(
      pkg({
        questions: [
          question({
            questionType: "free-response",
            choices: [],
            correctChoiceId: "",
            referenceAnswer: "模範解答"
          })
        ]
      })
    );
    expect(result.ok).toBe(true);
  });

  it("ConceptRef を含む package を受理する", () => {
    const result = validateQuizSharePackage(
      pkg({
        questions: [question({ conceptId: "c1" })],
        conceptRefs: [{ sourceId: "c1", title: "概念A" }]
      })
    );
    expect(result.ok).toBe(true);
  });

  it("Deck に複数 Question がある package を受理する", () => {
    const result = validateQuizSharePackage(
      pkg({
        deck: deck({ questionIds: ["q1", "q2"] }),
        questions: [question(), question({ id: "q2", prompt: "問い2" })]
      })
    );
    expect(result.ok).toBe(true);
  });

  it("format 不一致を reject する", () => {
    const result = validateQuizSharePackage(pkg({ format: "conceptbook-backup" }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("invalid-format");
    }
  });

  it("format 欠落を reject する", () => {
    const { format: _format, ...rest } = pkg();
    const result = validateQuizSharePackage(rest);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("invalid-format");
    }
  });

  it("version 不一致を reject する", () => {
    const result = validateQuizSharePackage(pkg({ version: 2 }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("unsupported-version");
      expect(result.reason).toContain("未対応のクイズ共有フォーマット");
    }
  });

  it("version 欠落を reject する", () => {
    const { version: _version, ...rest } = pkg();
    const result = validateQuizSharePackage(rest);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("unsupported-version");
    }
  });

  it.each([null, [], "share"])("root が %s のとき reject する", (input) => {
    const result = validateQuizSharePackage(input);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("invalid-root");
    }
  });

  it("exportedAt 欠落を reject する", () => {
    const { exportedAt: _exportedAt, ...rest } = pkg();
    const result = validateQuizSharePackage(rest);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("invalid-exported-at");
    }
  });

  it("不正な exportedAt を reject する", () => {
    const result = validateQuizSharePackage(pkg({ exportedAt: "not-a-date" }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("invalid-exported-at");
    }
  });

  it("deck 欠落を reject する", () => {
    const { deck: _deck, ...rest } = pkg();
    const result = validateQuizSharePackage(rest);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("invalid-deck");
    }
  });

  it("deck.id 欠落を reject する", () => {
    const { id: _id, ...restDeck } = deck();
    const result = validateQuizSharePackage(pkg({ deck: restDeck }));
    expect(result.ok).toBe(false);
  });

  it("deck.title 欠落を reject する", () => {
    const { title: _title, ...restDeck } = deck();
    const result = validateQuizSharePackage(pkg({ deck: restDeck }));
    expect(result.ok).toBe(false);
  });

  it("questionIds が配列でないとき reject する", () => {
    const result = validateQuizSharePackage(pkg({ deck: deck({ questionIds: "q1" }) }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("invalid-deck");
    }
  });

  it("不正な QuizDeck schemaVersion を reject する", () => {
    const result = validateQuizSharePackage(pkg({ deck: deck({ schemaVersion: 99 }) }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("invalid-deck");
    }
  });

  it("deck.questionIds の重複を reject する", () => {
    const result = validateQuizSharePackage(
      pkg({
        deck: deck({ questionIds: ["q1", "q1"] }),
        questions: [question()]
      })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("duplicate-deck-question-id");
    }
  });

  it("questions が配列でないとき reject する", () => {
    const result = validateQuizSharePackage(pkg({ questions: {} }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("invalid-question");
    }
  });

  it("Question の必須フィールド欠落を reject する", () => {
    const { prompt: _prompt, ...rest } = question();
    const result = validateQuizSharePackage(pkg({ questions: [rest] }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("invalid-question");
    }
  });

  it("visibility や questionType を補完せず reject する", () => {
    const withoutVisibility = question();
    delete (withoutVisibility as { visibility?: string }).visibility;
    const withoutType = question();
    delete (withoutType as { questionType?: string }).questionType;
    expect(validateQuizSharePackage(pkg({ questions: [withoutVisibility] })).ok).toBe(false);
    expect(validateQuizSharePackage(pkg({ questions: [withoutType] })).ok).toBe(false);
  });

  it("不正な QuizQuestion schemaVersion を reject する", () => {
    const result = validateQuizSharePackage(
      pkg({ questions: [question({ schemaVersion: 1 })] })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("invalid-question");
    }
  });

  it("multiple-choice の choices 不正を reject する", () => {
    const result = validateQuizSharePackage(
      pkg({ questions: [question({ choices: [choice("a")] })] })
    );
    expect(result.ok).toBe(false);
  });

  it("correctChoiceId 欠落を reject する", () => {
    const { correctChoiceId: _id, ...rest } = question();
    const result = validateQuizSharePackage(pkg({ questions: [rest] }));
    expect(result.ok).toBe(false);
  });

  it("correctChoiceId が choices を指していないとき reject する", () => {
    const result = validateQuizSharePackage(
      pkg({ questions: [question({ correctChoiceId: "missing" })] })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("invalid-question");
    }
  });

  it("free-response に模範解答が無いとき reject する", () => {
    const result = validateQuizSharePackage(
      pkg({
        questions: [
          question({
            questionType: "free-response",
            choices: [],
            correctChoiceId: "",
            referenceAnswer: "   "
          })
        ]
      })
    );
    expect(result.ok).toBe(false);
  });

  it("Question ID 重複を reject する", () => {
    const result = validateQuizSharePackage(
      pkg({
        deck: deck({ questionIds: ["q1"] }),
        questions: [question(), question({ prompt: "別" })]
      })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("duplicate-question-id");
    }
  });

  it("Choice ID 重複を reject する", () => {
    const result = validateQuizSharePackage(
      pkg({
        questions: [question({ choices: [choice("a"), choice("a")] })]
      })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("duplicate-choice-id");
    }
  });

  it("deck.questionIds の Question が package に無いとき reject する", () => {
    const result = validateQuizSharePackage(
      pkg({ deck: deck({ questionIds: ["q1", "q2"] }) })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("missing-question");
    }
  });

  it("Deck から参照されない余剰 Question を reject する", () => {
    const result = validateQuizSharePackage(
      pkg({
        questions: [question(), question({ id: "q-extra", prompt: "余剰" })]
      })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("orphan-question");
    }
  });

  it("conceptRefs が配列でないとき reject する", () => {
    const result = validateQuizSharePackage(pkg({ conceptRefs: {} }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("invalid-concept-ref");
    }
  });

  it("sourceId 欠落を reject する", () => {
    const result = validateQuizSharePackage(
      pkg({
        questions: [question({ conceptId: "c1" })],
        conceptRefs: [{ title: "概念A" }]
      })
    );
    expect(result.ok).toBe(false);
  });

  it("title 欠落を reject する", () => {
    const result = validateQuizSharePackage(
      pkg({
        questions: [question({ conceptId: "c1" })],
        conceptRefs: [{ sourceId: "c1" }]
      })
    );
    expect(result.ok).toBe(false);
  });

  it("sourceId 重複を reject する", () => {
    const result = validateQuizSharePackage(
      pkg({
        questions: [question({ conceptId: "c1" })],
        conceptRefs: [
          { sourceId: "c1", title: "A" },
          { sourceId: "c1", title: "B" }
        ]
      })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("invalid-concept-ref");
    }
  });

  it("Question が参照する ConceptRef が無いとき reject する", () => {
    const result = validateQuizSharePackage(pkg({ questions: [question({ conceptId: "c1" })] }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("missing-concept-ref");
    }
  });

  it("Choice が参照する ConceptRef が無いとき reject する", () => {
    const result = validateQuizSharePackage(
      pkg({
        questions: [
          question({
            choices: [choice("a", { linkedConceptId: "c-link" }), choice("b", { sourceConceptId: "c-src" })]
          })
        ]
      })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("missing-concept-ref");
    }
  });

  it("未使用の ConceptRef を reject する", () => {
    const result = validateQuizSharePackage(
      pkg({ conceptRefs: [{ sourceId: "unused", title: "未使用" }] })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("unused-concept-ref");
    }
  });

  it("Choice の Concept 参照と ConceptRef が一致すれば受理する", () => {
    const result = validateQuizSharePackage(
      pkg({
        questions: [
          question({
            choices: [choice("a", { linkedConceptId: "c-link" }), choice("b", { sourceConceptId: "c-src" })]
          })
        ],
        conceptRefs: [
          { sourceId: "c-link", title: "リンク" },
          { sourceId: "c-src", title: "出典" }
        ]
      })
    );
    expect(result.ok).toBe(true);
  });

  it("Backup payload を Quiz Share として reject する", () => {
    const result = validateQuizSharePackage({
      concepts: [],
      contextCards: [],
      quizQuestions: [],
      quizDecks: []
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("invalid-format");
    }
  });
});
