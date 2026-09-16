import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyConceptInput, type Concept } from "../types/concept";
import type { QuizQuestion } from "../types/quiz";
import { QUIZ_QUESTION_SCHEMA_VERSION } from "../types/quiz";

const { saveQuizQuestion, getAllContextCards } = vi.hoisted(() => ({
  saveQuizQuestion: vi.fn(async () => undefined),
  getAllContextCards: vi.fn(async () => [])
}));

vi.mock("../storage", () => {
  const storage = {
    saveQuizQuestion,
    getAllContextCards
  };
  return {
    getStorage: () => storage,
    getContextStorage: () => storage
  };
});

import { QuizQuestionFormModal } from "./QuizQuestionFormModal";

const concept = (overrides: Partial<Concept>): Concept => ({
  ...createEmptyConceptInput(),
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides
});

const concepts: Concept[] = [
  concept({
    id: "bayes",
    title: "ベイズ推論",
    domainTags: ["統計", "機械学習"]
  }),
  concept({
    id: "mle",
    title: "最尤推定",
    domainTags: ["統計"]
  })
];

const existingQuestion: QuizQuestion = {
  id: "q1",
  conceptId: "bayes",
  questionType: "multiple-choice",
  prompt: "既存の問題",
  choices: [
    { id: "ch1", text: "選択肢A" },
    { id: "ch2", text: "選択肢B" }
  ],
  correctChoiceId: "ch1",
  visibility: "private",
  schemaVersion: QUIZ_QUESTION_SCHEMA_VERSION,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
};

describe("QuizQuestionFormModal concept picker", () => {
  beforeEach(() => {
    saveQuizQuestion.mockClear();
    getAllContextCards.mockClear();
  });

  it("edit mode で既存の conceptId が選択中として表示される", () => {
    render(
      <QuizQuestionFormModal
        open
        mode="edit"
        question={existingQuestion}
        concepts={concepts}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );

    expect(screen.getByText("選択中")).toBeInTheDocument();
    expect(screen.getByText("ベイズ推論")).toBeInTheDocument();
    expect(screen.getByText("統計 / 機械学習")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).toBeInTheDocument();
    expect(document.querySelectorAll("select#quiz-form-related-concept")).toHaveLength(0);
  });

  it("Concept を選んで保存すると payload.conceptId が Concept ID になる", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(
      <QuizQuestionFormModal
        open
        mode="create"
        concepts={concepts}
        onClose={vi.fn()}
        onSaved={onSaved}
      />
    );

    await user.type(
      screen.getByRole("combobox", { name: "Conceptを検索（タイトル・分野タグで絞り込み）" }),
      "ベイズ"
    );
    await waitFor(() => {
      expect(screen.getByRole("option", { name: /ベイズ推論/ })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("option", { name: /ベイズ推論/ }));

    await user.type(screen.getByPlaceholderText("問いを入力…"), "問題文");
    const choiceInputs = screen.getAllByPlaceholderText(/選択肢の本文/);
    await user.type(choiceInputs[0]!, "正解");
    await user.type(choiceInputs[1]!, "誤答");

    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(saveQuizQuestion).toHaveBeenCalledTimes(1);
    });
    const payload = saveQuizQuestion.mock.calls[0]?.[0] as QuizQuestion;
    expect(payload.conceptId).toBe("bayes");
    expect(onSaved).toHaveBeenCalled();
  });

  it("Concept をなしに戻して保存すると conceptId を付けない", async () => {
    const user = userEvent.setup();
    render(
      <QuizQuestionFormModal
        open
        mode="edit"
        question={existingQuestion}
        concepts={concepts}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: "クリア" }));
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(saveQuizQuestion).toHaveBeenCalledTimes(1);
    });
    const payload = saveQuizQuestion.mock.calls[0]?.[0] as QuizQuestion;
    expect(payload.conceptId).toBeUndefined();
  });

  it("入力式を選ぶと選択肢UIを隠し、模範解答必須で保存する", async () => {
    const user = userEvent.setup();
    render(
      <QuizQuestionFormModal
        open
        mode="create"
        concepts={concepts}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: "入力式" }));
    expect(screen.queryByText("選択肢 *（2件以上）")).not.toBeInTheDocument();
    await user.type(screen.getByPlaceholderText("問いを入力…"), "教師あり学習とは？");
    await user.click(screen.getByRole("button", { name: "保存" }));
    expect(saveQuizQuestion).not.toHaveBeenCalled();
    expect(screen.getByText("模範解答を入力してください。")).toBeInTheDocument();

    await user.type(screen.getByLabelText("模範解答"), "ラベル付きデータで学習する");
    await user.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => {
      expect(saveQuizQuestion).toHaveBeenCalledTimes(1);
    });
    const payload = saveQuizQuestion.mock.calls[0]?.[0] as QuizQuestion;
    expect(payload.questionType).toBe("free-response");
    expect(payload.choices).toEqual([]);
    expect(payload.correctChoiceId).toBe("");
    expect(payload.referenceAnswer).toBe("ラベル付きデータで学習する");
    expect(payload.keywords).toBeUndefined();
    expect(payload.schemaVersion).toBe(QUIZ_QUESTION_SCHEMA_VERSION);
  });

  it("入力式の採点補助キーワードを1行1件で正規化して保存する", async () => {
    const user = userEvent.setup();
    render(
      <QuizQuestionFormModal
        open
        mode="create"
        concepts={concepts}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: "入力式" }));
    await user.type(screen.getByPlaceholderText("問いを入力…"), "教師あり学習とは？");
    await user.type(screen.getByLabelText("模範解答"), "ラベル付きデータで学習する");
    await user.type(screen.getByLabelText("採点補助キーワード"), " 学習 \n入力\n\n学習");
    await user.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => {
      expect(saveQuizQuestion).toHaveBeenCalledTimes(1);
    });
    const payload = saveQuizQuestion.mock.calls[0]?.[0] as QuizQuestion;
    expect(payload.keywords).toEqual(["学習", "入力"]);
  });

  it("入力式から四択へ切り替えて保存すると keywords を残さない", async () => {
    const user = userEvent.setup();
    const freeResponse: QuizQuestion = {
      ...existingQuestion,
      questionType: "free-response",
      referenceAnswer: "模範",
      keywords: ["入力", "学習"],
      schemaVersion: 2
    };
    render(
      <QuizQuestionFormModal
        open
        mode="edit"
        question={freeResponse}
        concepts={concepts}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );

    expect(screen.getByLabelText("採点補助キーワード")).toHaveValue("入力\n学習");
    await user.click(screen.getByRole("button", { name: "四択" }));
    await user.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => {
      expect(saveQuizQuestion).toHaveBeenCalledTimes(1);
    });
    const payload = saveQuizQuestion.mock.calls[0]?.[0] as QuizQuestion;
    expect(payload.questionType).toBe("multiple-choice");
    expect(payload.keywords).toBeUndefined();
    expect(payload.schemaVersion).toBe(QUIZ_QUESTION_SCHEMA_VERSION);
  });


  it("候補が開いている Escape では Modal を閉じず、もう一度 Escape で閉じる", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <QuizQuestionFormModal
        open
        mode="create"
        concepts={concepts}
        onClose={onClose}
        onSaved={vi.fn()}
      />
    );

    const dialog = screen.getByRole("dialog", { name: "クイズを作成" });
    await user.type(
      within(dialog).getByRole("combobox", { name: "Conceptを検索（タイトル・分野タグで絞り込み）" }),
      "ベイズ"
    );
    await waitFor(() => {
      expect(screen.getByRole("option", { name: /ベイズ推論/ })).toBeInTheDocument();
    });

    await user.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
    expect(dialog).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("QuizQuestionFormModal answer-type sections", () => {
  beforeEach(() => {
    saveQuizQuestion.mockClear();
    getAllContextCards.mockClear();
  });

  it("四択選択時は選択肢 UI を出し、入力式欄は出さない", () => {
    render(
      <QuizQuestionFormModal
        open
        mode="create"
        concepts={concepts}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "四択" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "入力式" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("選択肢から正解を選ぶ形式です。")).toBeInTheDocument();
    expect(screen.getByText("回答設定（四択）")).toBeInTheDocument();
    expect(screen.getByText("選択肢 *（2件以上）")).toBeInTheDocument();
    expect(screen.getByText(/選択肢のテキストが Concept タイトルと一致/)).toBeInTheDocument();
    expect(screen.queryByLabelText("模範解答")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("採点補助キーワード")).not.toBeInTheDocument();
    expect(screen.queryByText("文脈別定義から選択肢を生成")).not.toBeInTheDocument();
  });

  it("入力式へ切り替えると模範解答欄だけを出し、四択固有 UI を隠す", async () => {
    const user = userEvent.setup();
    render(
      <QuizQuestionFormModal
        open
        mode="create"
        concepts={concepts}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: "入力式" }));

    expect(screen.getByRole("button", { name: "入力式" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "四択" })).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.getByText("回答を自分で入力し、模範解答を確認して自己評価する形式です。")
    ).toBeInTheDocument();
    expect(screen.getByText("回答設定（入力式）")).toBeInTheDocument();
    expect(screen.getByLabelText("模範解答")).toBeInTheDocument();
    expect(screen.getByLabelText("採点補助キーワード")).toBeInTheDocument();
    expect(screen.queryByText("選択肢 *（2件以上）")).not.toBeInTheDocument();
    expect(screen.queryByText("文脈別定義から選択肢を生成")).not.toBeInTheDocument();
    expect(screen.queryByText(/選択肢のテキストが Concept タイトルと一致/)).not.toBeInTheDocument();
    expect(screen.queryByText(/概念がまだありません。選択肢と Concept タイトルの自動リンクは/)).not.toBeInTheDocument();
  });

  it("形式切替では modal 内 draft を保持し、保存時は選択中の形式だけを残す", async () => {
    const user = userEvent.setup();
    render(
      <QuizQuestionFormModal
        open
        mode="create"
        concepts={concepts}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );

    const choiceInputs = screen.getAllByPlaceholderText(/選択肢の本文/);
    await user.type(choiceInputs[0]!, "四択の正解");
    await user.type(choiceInputs[1]!, "四択の誤答");

    await user.click(screen.getByRole("button", { name: "入力式" }));
    await user.type(screen.getByLabelText("模範解答"), "入力式の模範");
    await user.type(screen.getByLabelText("採点補助キーワード"), "キーワードA");

    await user.click(screen.getByRole("button", { name: "四択" }));
    expect(screen.getByDisplayValue("四択の正解")).toBeInTheDocument();
    expect(screen.getByDisplayValue("四択の誤答")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "入力式" }));
    expect(screen.getByLabelText("模範解答")).toHaveValue("入力式の模範");
    expect(screen.getByLabelText("採点補助キーワード")).toHaveValue("キーワードA");

    await user.type(screen.getByPlaceholderText("問いを入力…"), "問題文");
    await user.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => {
      expect(saveQuizQuestion).toHaveBeenCalledTimes(1);
    });
    const freePayload = saveQuizQuestion.mock.calls[0]?.[0] as QuizQuestion;
    expect(freePayload.questionType).toBe("free-response");
    expect(freePayload.choices).toEqual([]);
    expect(freePayload.correctChoiceId).toBe("");
    expect(freePayload.referenceAnswer).toBe("入力式の模範");
    expect(freePayload.keywords).toEqual(["キーワードA"]);
  });

  it("四択として保存すると referenceAnswer と keywords を残さない", async () => {
    const user = userEvent.setup();
    render(
      <QuizQuestionFormModal
        open
        mode="create"
        concepts={concepts}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: "入力式" }));
    await user.type(screen.getByLabelText("模範解答"), "残してはいけない模範");
    await user.type(screen.getByLabelText("採点補助キーワード"), "残してはいけない");
    await user.click(screen.getByRole("button", { name: "四択" }));
    await user.type(screen.getByPlaceholderText("問いを入力…"), "問題文");
    const choiceInputs = screen.getAllByPlaceholderText(/選択肢の本文/);
    await user.type(choiceInputs[0]!, "正解");
    await user.type(choiceInputs[1]!, "誤答");
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(saveQuizQuestion).toHaveBeenCalledTimes(1);
    });
    const payload = saveQuizQuestion.mock.calls[0]?.[0] as QuizQuestion;
    expect(payload.questionType).toBe("multiple-choice");
    expect(payload.choices.map((choice) => choice.text)).toEqual(["正解", "誤答"]);
    expect(payload).not.toHaveProperty("referenceAnswer");
    expect(payload).not.toHaveProperty("keywords");
  });

  it("既存の入力式問題を開くと模範解答と keywords を初期表示する", () => {
    const freeResponse: QuizQuestion = {
      ...existingQuestion,
      questionType: "free-response",
      choices: [],
      correctChoiceId: "",
      referenceAnswer: "既存の模範解答",
      keywords: ["既存", "キーワード"]
    };
    render(
      <QuizQuestionFormModal
        open
        mode="edit"
        question={freeResponse}
        concepts={concepts}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "入力式" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("模範解答")).toHaveValue("既存の模範解答");
    expect(screen.getByLabelText("採点補助キーワード")).toHaveValue("既存\nキーワード");
    expect(screen.queryByText("選択肢 *（2件以上）")).not.toBeInTheDocument();
  });

  it("source 付き Question を編集保存しても source を保持する", async () => {
    const user = userEvent.setup();
    const originalSource = {
      type: "contextualConceptCard" as const,
      sourceId: "contextual-card-1",
      sourceTitle: "ベイズ推論 / 医療診断",
      fieldName: "統計"
    };
    const withSource: QuizQuestion = {
      ...existingQuestion,
      source: originalSource,
      choices: [
        {
          id: "ch1",
          text: "選択肢A",
          displayText: "表示A",
          sourceConceptId: "bayes",
          contextDefinitionId: "def1",
          sourceStrategy: "correct"
        },
        {
          id: "ch2",
          text: "選択肢B",
          displayText: "表示B",
          sourceConceptId: "mle",
          contextDefinitionId: "def2",
          sourceStrategy: "same-domain"
        }
      ]
    };
    render(
      <QuizQuestionFormModal
        open
        mode="edit"
        question={withSource}
        concepts={concepts}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );

    const promptInput = screen.getByPlaceholderText("問いを入力…");
    await user.clear(promptInput);
    await user.type(promptInput, "編集後の問題");
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(saveQuizQuestion).toHaveBeenCalledTimes(1);
    });
    const payload = saveQuizQuestion.mock.calls[0]?.[0] as QuizQuestion;
    expect(payload.prompt).toBe("編集後の問題");
    expect(payload.source).toEqual(originalSource);
    expect(payload.source?.type).toBe("contextualConceptCard");
    expect(payload.source?.sourceId).toBe("contextual-card-1");
    expect(payload.source?.sourceTitle).toBe("ベイズ推論 / 医療診断");
    expect(payload.source?.fieldName).toBe("統計");
    expect(payload.choices[0]).toMatchObject({
      displayText: "表示A",
      sourceConceptId: "bayes",
      contextDefinitionId: "def1",
      sourceStrategy: "correct"
    });
    expect(payload.choices[1]).toMatchObject({
      displayText: "表示B",
      sourceConceptId: "mle",
      contextDefinitionId: "def2",
      sourceStrategy: "same-domain"
    });
  });

  it("conceptGeneral source 付き Question を編集保存しても source を保持する", async () => {
    const user = userEvent.setup();
    const originalSource = {
      type: "conceptGeneral" as const,
      sourceId: "concept-a",
      sourceTitle: "概念A",
      fieldName: "情報科学"
    };
    const withSource: QuizQuestion = {
      ...existingQuestion,
      conceptId: "concept-a",
      source: originalSource,
      choices: [
        {
          id: "ch1",
          text: "選択肢A",
          displayText: "表示A",
          sourceConceptId: "concept-a",
          contextDefinitionId: "general_concept-a",
          sourceStrategy: "correct"
        },
        {
          id: "ch2",
          text: "選択肢B",
          displayText: "表示B",
          sourceConceptId: "mle",
          contextDefinitionId: "def2",
          sourceStrategy: "same-domain"
        }
      ]
    };
    render(
      <QuizQuestionFormModal
        open
        mode="edit"
        question={withSource}
        concepts={concepts}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );

    const promptInput = screen.getByPlaceholderText("問いを入力…");
    await user.clear(promptInput);
    await user.type(promptInput, "編集後の一般問題");
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(saveQuizQuestion).toHaveBeenCalledTimes(1);
    });
    const payload = saveQuizQuestion.mock.calls[0]?.[0] as QuizQuestion;
    expect(payload.source).toEqual(originalSource);
    expect(payload.source?.type).toBe("conceptGeneral");
    expect(payload.source?.sourceId).toBe("concept-a");
    expect(payload.source?.sourceTitle).toBe("概念A");
    expect(payload.source?.fieldName).toBe("情報科学");
    expect(payload.choices[0]).toMatchObject({
      sourceConceptId: "concept-a",
      contextDefinitionId: "general_concept-a",
      sourceStrategy: "correct"
    });
  });

  it("source 無し Question を編集保存しても source を付与しない", async () => {
    const user = userEvent.setup();
    const withoutSource: QuizQuestion = {
      ...existingQuestion,
      source: undefined
    };
    render(
      <QuizQuestionFormModal
        open
        mode="edit"
        question={withoutSource}
        concepts={concepts}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => {
      expect(saveQuizQuestion).toHaveBeenCalledTimes(1);
    });
    const payload = saveQuizQuestion.mock.calls[0]?.[0] as QuizQuestion;
    expect(payload.source).toBeUndefined();
    expect(payload).not.toHaveProperty("source");
  });

  it("既存の四択問題を開くと choices を編集できる", () => {
    render(
      <QuizQuestionFormModal
        open
        mode="edit"
        question={existingQuestion}
        concepts={concepts}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "四択" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByDisplayValue("選択肢A")).toBeInTheDocument();
    expect(screen.getByDisplayValue("選択肢B")).toBeInTheDocument();
    expect(screen.queryByLabelText("模範解答")).not.toBeInTheDocument();
  });

  it("Concept 選択後の四択では文脈別定義からの生成 UI が入力できる", async () => {
    const user = userEvent.setup();
    const withContext = [
      concept({
        id: "bayes",
        title: "ベイズ推論",
        domainTags: ["統計"],
        contextDefinitions: [
          { id: "def1", context: "統計", definition: "事前分布を更新する" }
        ]
      })
    ];
    render(
      <QuizQuestionFormModal
        open
        mode="create"
        concepts={withContext}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );

    await user.type(
      screen.getByRole("combobox", { name: "Conceptを検索（タイトル・分野タグで絞り込み）" }),
      "ベイズ"
    );
    await waitFor(() => {
      expect(screen.getByRole("option", { name: /ベイズ推論/ })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("option", { name: /ベイズ推論/ }));

    expect(screen.getByText("文脈別定義から選択肢を生成")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "文脈別定義から生成" })).toBeEnabled();
  });
});

describe("QuizQuestionFormModal provenance linkedConceptId", () => {
  const contextCardSource = {
    type: "contextCard" as const,
    sourceId: "card-1",
    sourceTitle: "文脈カード",
    fieldName: "統計"
  };

  const provenanceQuestion = (overrides: Partial<QuizQuestion> = {}): QuizQuestion => ({
    id: "q-context",
    conceptId: "concept-a",
    questionType: "multiple-choice",
    prompt: "文脈カード由来の問題",
    source: contextCardSource,
    choices: [
      {
        id: "ch1",
        text: "Concept A",
        linkedConceptId: "concept-a",
        sourceConceptId: "concept-a",
        contextDefinitionId: "def-a",
        sourceStrategy: "correct"
      },
      {
        id: "ch2",
        text: "Concept B",
        linkedConceptId: "concept-b",
        sourceConceptId: "concept-b",
        contextDefinitionId: "def-b",
        sourceStrategy: "same-context"
      }
    ],
    correctChoiceId: "ch1",
    visibility: "private",
    schemaVersion: QUIZ_QUESTION_SCHEMA_VERSION,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides
  });

  beforeEach(() => {
    saveQuizQuestion.mockClear();
    getAllContextCards.mockClear();
  });

  it("問題文だけ編集保存しても生成由来 Choice の linkedConceptId / metadata / source を維持する", async () => {
    const user = userEvent.setup();
    const question = provenanceQuestion();
    render(
      <QuizQuestionFormModal
        open
        mode="edit"
        question={question}
        concepts={[
          concept({ id: "concept-a", title: "Concept A" }),
          concept({ id: "concept-b", title: "Concept B" })
        ]}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );

    const promptInput = screen.getByPlaceholderText("問いを入力…");
    await user.clear(promptInput);
    await user.type(promptInput, "問題文だけ変更");
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(saveQuizQuestion).toHaveBeenCalledTimes(1);
    });
    const payload = saveQuizQuestion.mock.calls[0]?.[0] as QuizQuestion;
    expect(payload.prompt).toBe("問題文だけ変更");
    expect(payload.source).toEqual(contextCardSource);
    expect(payload.choices[0]).toMatchObject({
      linkedConceptId: "concept-a",
      sourceConceptId: "concept-a",
      contextDefinitionId: "def-a",
      sourceStrategy: "correct"
    });
    expect(payload.choices[1]).toMatchObject({
      linkedConceptId: "concept-b",
      sourceConceptId: "concept-b",
      contextDefinitionId: "def-b",
      sourceStrategy: "same-context"
    });
  });

  it("Concept が rename されても既存 linkedConceptId を維持する", async () => {
    const user = userEvent.setup();
    render(
      <QuizQuestionFormModal
        open
        mode="edit"
        question={provenanceQuestion({
          choices: [
            {
              id: "ch1",
              text: "AI",
              linkedConceptId: "concept-a",
              sourceConceptId: "concept-a",
              contextDefinitionId: "def-a",
              sourceStrategy: "correct"
            },
            {
              id: "ch2",
              text: "Concept B",
              linkedConceptId: "concept-b",
              sourceConceptId: "concept-b",
              contextDefinitionId: "def-b",
              sourceStrategy: "same-context"
            }
          ]
        })}
        concepts={[
          concept({ id: "concept-a", title: "人工知能" }),
          concept({ id: "concept-b", title: "Concept B" })
        ]}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => {
      expect(saveQuizQuestion).toHaveBeenCalledTimes(1);
    });
    const payload = saveQuizQuestion.mock.calls[0]?.[0] as QuizQuestion;
    expect(payload.choices[0]?.linkedConceptId).toBe("concept-a");
    expect(payload.choices[0]?.sourceConceptId).toBe("concept-a");
    expect(payload.source).toEqual(contextCardSource);
  });

  it("同名 Concept が複数あっても既存 linkedConceptId を維持する", async () => {
    const user = userEvent.setup();
    render(
      <QuizQuestionFormModal
        open
        mode="edit"
        question={provenanceQuestion()}
        concepts={[
          concept({ id: "concept-a", title: "Concept A" }),
          concept({ id: "concept-a-dup", title: "Concept A" }),
          concept({ id: "concept-b", title: "Concept B" })
        ]}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => {
      expect(saveQuizQuestion).toHaveBeenCalledTimes(1);
    });
    const payload = saveQuizQuestion.mock.calls[0]?.[0] as QuizQuestion;
    expect(payload.choices[0]?.linkedConceptId).toBe("concept-a");
    expect(payload.choices[0]?.sourceConceptId).toBe("concept-a");
  });

  it("Choice text を別 Concept 名へ変えても生成由来 Choice は付け替えない", async () => {
    const user = userEvent.setup();
    render(
      <QuizQuestionFormModal
        open
        mode="edit"
        question={provenanceQuestion()}
        concepts={[
          concept({ id: "concept-a", title: "Concept A" }),
          concept({ id: "concept-b", title: "Concept B" })
        ]}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );

    const firstChoice = screen.getByDisplayValue("Concept A");
    await user.clear(firstChoice);
    await user.type(firstChoice, "Concept B");
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(saveQuizQuestion).toHaveBeenCalledTimes(1);
    });
    const payload = saveQuizQuestion.mock.calls[0]?.[0] as QuizQuestion;
    expect(payload.choices[0]?.text).toBe("Concept B");
    expect(payload.choices[0]?.linkedConceptId).toBe("concept-a");
    expect(payload.choices[0]?.sourceConceptId).toBe("concept-a");
  });
});

describe("QuizQuestionFormModal persistQuestion", () => {
  beforeEach(() => {
    saveQuizQuestion.mockClear();
    getAllContextCards.mockClear();
  });

  it("persistQuestion が reject するとエラーを表示し modal を閉じない", async () => {
    const user = userEvent.setup();
    const persistQuestion = vi.fn(async () => {
      throw new Error("injected persist failure");
    });
    const onSaved = vi.fn();
    const onClose = vi.fn();

    render(
      <QuizQuestionFormModal
        open
        mode="edit"
        question={existingQuestion}
        concepts={concepts}
        persistQuestion={persistQuestion}
        onClose={onClose}
        onSaved={onSaved}
      />
    );

    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(screen.getByText("保存に失敗しました。")).toBeInTheDocument();
    });
    expect(persistQuestion).toHaveBeenCalledTimes(1);
    expect(saveQuizQuestion).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("persistQuestion 成功時は単独 save せず保存完了後に閉じる", async () => {
    const user = userEvent.setup();
    const persistQuestion = vi.fn(async () => undefined);
    const onSaved = vi.fn();
    const onClose = vi.fn();

    render(
      <QuizQuestionFormModal
        open
        mode="edit"
        question={existingQuestion}
        concepts={concepts}
        persistQuestion={persistQuestion}
        onClose={onClose}
        onSaved={onSaved}
      />
    );

    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(persistQuestion).toHaveBeenCalledTimes(1);
    });
    expect(saveQuizQuestion).not.toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

