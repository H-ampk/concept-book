import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AIError, AI_SETTINGS_STORAGE_KEY, DEFAULT_AI_SETTINGS } from "../features/ai";
import { createEmptyConceptInput, type Concept } from "../types/concept";
import { AIRelatedConceptSuggestions } from "./AIRelatedConceptSuggestions";

const { suggestRelatedConceptsWithAI } = vi.hoisted(() => ({
  suggestRelatedConceptsWithAI: vi.fn()
}));

vi.mock("../features/ai/relatedConcepts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../features/ai/relatedConcepts")>();
  return {
    ...actual,
    suggestRelatedConceptsWithAI
  };
});

const concept = (overrides: Partial<Concept>): Concept => ({
  ...createEmptyConceptInput(),
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides
});

const allConcepts = [
  concept({ id: "self", title: "実存主義", definition: "存在" }),
  concept({ id: "c2", title: "現象学", definition: "経験" })
];

const stubClipboard = () => {
  const writeText = vi.fn(async () => undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText }
  });
  return writeText;
};

const renderSuggestions = (onAdd = vi.fn()) =>
  render(
    <AIRelatedConceptSuggestions
      allConcepts={allConcepts}
      selectedIds={[]}
      currentConceptId="self"
      inputTitle="実存主義"
      inputDefinition="存在"
      inputMyInterpretation="選択"
      onAdd={onAdd}
    />
  );

describe("AIRelatedConceptSuggestions", () => {
  beforeEach(() => {
    localStorage.clear();
    suggestRelatedConceptsWithAI.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("検索ボタンを表示し、初期表示ではAI通信しない", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderSuggestions();
    expect(screen.getByRole("button", { name: "AIで候補を探す" })).toBeInTheDocument();
    expect(suggestRelatedConceptsWithAI).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("クリック時のみAI通信し、loading / 候補 / reason / similarity を表示する", async () => {
    const user = userEvent.setup();
    let resolveSearch: ((value: unknown) => void) | undefined;
    suggestRelatedConceptsWithAI.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSearch = resolve;
        })
    );
    renderSuggestions();
    await user.click(screen.getByRole("button", { name: "AIで候補を探す" }));
    expect(screen.getByText(/AI候補を検索中/)).toBeInTheDocument();
    resolveSearch?.({
      existing: [
        { conceptId: "c2", title: "現象学", similarity: 0.82, reason: "経験を扱う点で関連します" }
      ],
      new: [{ title: "解釈学", reason: "別の観点として関連します" }],
      failedEmbeddingCount: 0
    });
    expect(await screen.findByText("現象学")).toBeInTheDocument();
    expect(screen.getByText("経験を扱う点で関連します")).toBeInTheDocument();
    expect(screen.getByText("類似度 0.82")).toBeInTheDocument();
    expect(screen.getByText("未登録の参考候補")).toBeInTheDocument();
    expect(screen.getByText("解釈学")).toBeInTheDocument();
    expect(suggestRelatedConceptsWithAI).toHaveBeenCalledTimes(1);
  });

  it("追加ボタンで onAdd が呼ばれる", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    suggestRelatedConceptsWithAI.mockResolvedValue({
      existing: [{ conceptId: "c2", title: "現象学", similarity: 0.7, reason: "関連" }],
      new: [],
      failedEmbeddingCount: 0
    });
    renderSuggestions(onAdd);
    await user.click(screen.getByRole("button", { name: "AIで候補を探す" }));
    await user.click(await screen.findByRole("button", { name: "現象学 をAI候補から追加" }));
    expect(onAdd).toHaveBeenCalledWith("c2");
  });

  it("未登録候補から Concept を自動作成せず、コピーできる", async () => {
    const user = userEvent.setup();
    const writeText = stubClipboard();
    suggestRelatedConceptsWithAI.mockResolvedValue({
      existing: [],
      new: [{ title: "解釈学", reason: "参考" }],
      failedEmbeddingCount: 0
    });
    renderSuggestions();
    await user.click(screen.getByRole("button", { name: "AIで候補を探す" }));
    await user.click(await screen.findByRole("button", { name: "解釈学 のタイトルをコピー" }));
    expect(writeText).toHaveBeenCalledWith("解釈学");
    expect(screen.queryByRole("button", { name: /をAI候補から追加/ })).not.toBeInTheDocument();
  });

  it("AI無効時はエラーを表示する", async () => {
    const user = userEvent.setup();
    localStorage.setItem(AI_SETTINGS_STORAGE_KEY, JSON.stringify({ ...DEFAULT_AI_SETTINGS, enabled: false }));
    suggestRelatedConceptsWithAI.mockRejectedValue(
      new AIError("disabled", "AI機能が無効です。設定からローカルAIを有効にしてください。")
    );
    renderSuggestions();
    await user.click(screen.getByRole("button", { name: "AIで候補を探す" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("AI機能が無効です");
  });
});
