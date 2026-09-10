import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyConceptInput, type Concept } from "../types/concept";
import { RelatedConceptPicker } from "./RelatedConceptPicker";

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
  concept({
    id: "self",
    title: "実存主義",
    definition: "人間の存在を問う",
    myInterpretation: "選択"
  }),
  concept({
    id: "c2",
    title: "現象学",
    definition: "実存主義に近い経験の記述",
    domainTags: ["哲学"]
  }),
  concept({
    id: "c3",
    title: "集合論",
    definition: "集合と要素"
  })
];

const stubClipboard = () => {
  const writeText = vi.fn(async () => undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText }
  });
  return writeText;
};

describe("RelatedConceptPicker AI統合", () => {
  beforeEach(() => {
    suggestRelatedConceptsWithAI.mockReset();
  });

  it("既存ローカル候補とAI検索ボタンを同時に表示し、初期表示ではAI通信しない", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(
      <RelatedConceptPicker
        allConcepts={allConcepts}
        selectedIds={[]}
        currentConceptId="self"
        inputTitle="実存主義"
        inputDefinition="人間の存在を問う"
        inputMyInterpretation="選択"
        inputTags={["哲学"]}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByText(/関連概念候補/)).toBeInTheDocument();
    expect(screen.getByText("現象学")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "AIで候補を探す" })).toBeInTheDocument();
    expect(suggestRelatedConceptsWithAI).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("AI追加は既存 onChange を呼び、Storage 書き込みや未登録候補の自動作成をしない", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onBulkAddTitles = vi.fn();
    const writeText = stubClipboard();
    suggestRelatedConceptsWithAI.mockResolvedValue({
      existing: [{ conceptId: "c3", title: "集合論", similarity: 0.64, reason: "構造の点で関連" }],
      new: [{ title: "解釈学", reason: "参考" }],
      failedEmbeddingCount: 0
    });
    render(
      <RelatedConceptPicker
        allConcepts={allConcepts}
        selectedIds={[]}
        currentConceptId="self"
        inputTitle="実存主義"
        inputDefinition="人間の存在を問う"
        inputMyInterpretation="選択"
        inputTags={[]}
        onChange={onChange}
        onBulkAddTitles={onBulkAddTitles}
      />
    );
    await user.click(screen.getByRole("button", { name: "AIで候補を探す" }));
    await user.click(await screen.findByRole("button", { name: "集合論 をAI候補から追加" }));
    expect(onChange).toHaveBeenCalledWith(["c3"]);
    expect(onBulkAddTitles).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "解釈学 のタイトルをコピー" }));
    expect(writeText).toHaveBeenCalledWith("解釈学");
    expect(onBulkAddTitles).not.toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("AI error 後もローカル候補とタイトル検索が使える", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    suggestRelatedConceptsWithAI.mockRejectedValue(new Error("Ollamaに接続できませんでした。"));
    render(
      <RelatedConceptPicker
        allConcepts={allConcepts}
        selectedIds={[]}
        currentConceptId="self"
        inputTitle="実存主義"
        inputDefinition="人間の存在を問う"
        inputMyInterpretation="選択"
        inputTags={["哲学"]}
        onChange={onChange}
      />
    );
    await user.click(screen.getByRole("button", { name: "AIで候補を探す" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Ollamaに接続できませんでした。");
    await user.click(screen.getByRole("button", { name: "追加" }));
    expect(onChange).toHaveBeenCalledWith(["c2"]);

    await user.type(screen.getByPlaceholderText("関連付けたい概念タイトルを入力"), "集合");
    await waitFor(() => {
      expect(screen.getByText("集合論")).toBeInTheDocument();
    });
  });
});
