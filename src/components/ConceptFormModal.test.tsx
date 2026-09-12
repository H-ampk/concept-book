import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createEmptyConceptInput, type Concept } from "../types/concept";
import { ConceptFormModal } from "./ConceptFormModal";

vi.mock("../storage", () => ({
  getStorage: () => ({
    getMediaBlob: async () => null,
    createConcept: vi.fn(),
    updateConcept: vi.fn(),
    addMedia: vi.fn(),
    deleteMedia: vi.fn(),
    updateMediaCaption: vi.fn()
  })
}));

const concept = (overrides: Partial<Concept>): Concept => ({
  ...createEmptyConceptInput(),
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides
});

const allConcepts = [
  concept({ id: "self", title: "ベイズの定理" }),
  concept({ id: "prob", title: "確率", domainTags: ["数学"] }),
  concept({ id: "set", title: "集合論" })
];

describe("ConceptFormModal prerequisites (#118)", () => {
  it("前提概念を選択でき、relatedIds と混ざらない", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async (payload) => {
      expect(payload.prerequisiteIds).toEqual(["prob"]);
      expect(payload.relatedIds).toEqual([]);
      return undefined;
    });
    render(
      <ConceptFormModal
        open
        mode="create"
        allConcepts={allConcepts}
        conceptTitleIndex={new Map()}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    expect(screen.getByText("この概念を理解する前に必要な概念")).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText("前提となる概念タイトルを入力"), "確率");
    await user.click(await screen.findByRole("button", { name: /確率/ }));
    await user.type(screen.getByRole("textbox", { name: /タイトル/ }), "新しい概念");
    await user.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
  });

  it("edit 時に既存 prerequisite を表示し relatedIds と分けて扱う", () => {
    render(
      <ConceptFormModal
        open
        mode="edit"
        baseConcept={concept({
          id: "self",
          title: "ベイズの定理",
          relatedIds: ["set"],
          prerequisiteIds: ["prob"]
        })}
        allConcepts={allConcepts}
        conceptTitleIndex={new Map()}
        onClose={vi.fn()}
        onSubmit={vi.fn(async () => undefined)}
      />
    );

    expect(screen.getByText("現在の前提概念")).toBeInTheDocument();
    expect(screen.getByText("現在の関連概念")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "確率 を前提概念から外す" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "集合論 を関連概念から外す" })).toBeInTheDocument();
  });

  it("cycle 保存エラーをユーザーへ表示する", async () => {
    const user = userEvent.setup();
    render(
      <ConceptFormModal
        open
        mode="edit"
        baseConcept={concept({ id: "self", title: "ベイズの定理" })}
        allConcepts={allConcepts}
        conceptTitleIndex={new Map()}
        onClose={vi.fn()}
        onSubmit={vi.fn(async () => {
          throw new Error("この前提概念を設定すると循環するため保存できません。");
        })}
      />
    );

    await user.click(screen.getByRole("button", { name: "保存" }));
    expect(
      await screen.findByText("この前提概念を設定すると循環するため保存できません。")
    ).toBeInTheDocument();
  });
});
