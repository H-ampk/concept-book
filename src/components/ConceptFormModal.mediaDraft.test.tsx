import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyConceptInput, type Concept } from "../types/concept";
import type { ConceptMediaRef } from "../types/media";
import { ConceptFormModal } from "./ConceptFormModal";

const storageSpies = vi.hoisted(() => ({
  addMedia: vi.fn(),
  deleteMedia: vi.fn(),
  updateMediaCaption: vi.fn(),
  updateConcept: vi.fn(),
  createConcept: vi.fn(),
  getMediaBlob: vi.fn(async () => new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" })),
  getConceptById: vi.fn()
}));

vi.mock("../storage", () => ({
  getStorage: () => storageSpies
}));

const pngFile = (name: string) =>
  new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], name, { type: "image/png" });

const media = (id: string, extras: Partial<ConceptMediaRef> = {}): ConceptMediaRef => ({
  id,
  kind: "image",
  fileName: `${id}.png`,
  caption: extras.caption,
  sortOrder: extras.sortOrder ?? 0
});

const concept = (overrides: Partial<Concept> = {}): Concept => ({
  ...createEmptyConceptInput(),
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  id: "self",
  title: "編集対象",
  ...overrides
});

const renderEdit = (overrides: Partial<Concept> = {}, props: {
  onClose?: () => void;
  onSubmit?: (...args: unknown[]) => Promise<unknown>;
} = {}) => {
  const onClose = props.onClose ?? vi.fn();
  const onSubmit = props.onSubmit ?? vi.fn(async () => undefined);
  render(
    <ConceptFormModal
      open
      mode="edit"
      baseConcept={concept({
        media: [media("M1", { sortOrder: 0, caption: "old1" })],
        ...overrides
      })}
      allConcepts={[concept()]}
      conceptTitleIndex={new Map()}
      onClose={onClose}
      onSubmit={onSubmit as never}
    />
  );
  return { onClose, onSubmit };
};

describe("ConceptFormModal media draft", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    URL.createObjectURL = vi.fn(() => "blob:test");
    URL.revokeObjectURL = vi.fn();
  });

  it("add → Cancel では storage write も onSubmit もしない", async () => {
    const user = userEvent.setup();
    const { onClose, onSubmit } = renderEdit();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, pngFile("M2.png"));
    expect(await screen.findByText("M2.png")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(storageSpies.addMedia).not.toHaveBeenCalled();
    expect(storageSpies.updateConcept).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("delete → Cancel では deleteMedia を呼ばない", async () => {
    const user = userEvent.setup();
    const { onClose } = renderEdit();
    const row = (await screen.findByText("M1.png")).closest("li");
    expect(row).toBeTruthy();
    await user.click(screen.getAllByRole("button", { name: "削除" }).find((btn) => row!.contains(btn))!);
    await user.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(storageSpies.deleteMedia).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("caption → Cancel では updateMediaCaption を呼ばない", async () => {
    const user = userEvent.setup();
    const { onClose } = renderEdit();
    const caption = await screen.findByPlaceholderText("キャプション（任意）");
    await user.clear(caption);
    await user.type(caption, "changed");
    await user.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(storageSpies.updateMediaCaption).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("reorder → Cancel では updateConcept を呼ばない", async () => {
    const user = userEvent.setup();
    const { onClose } = renderEdit({
      media: [
        media("M1", { sortOrder: 0 }),
        media("M2", { sortOrder: 1, caption: "c2" }),
        media("M3", { sortOrder: 2 })
      ]
    });
    const firstRow = (await screen.findByText("M1.png")).closest("li") as HTMLElement;
    await user.click(firstRow.querySelectorAll("button")[1] as HTMLButtonElement);
    await user.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(storageSpies.updateConcept).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("Save 失敗時は modal と draft を保持し、retry で同じ draft を渡す", async () => {
    const user = userEvent.setup();
    const onSubmit = vi
      .fn()
      .mockRejectedValueOnce(new Error("保存に失敗しました。"))
      .mockResolvedValueOnce({ id: "self" });
    const onClose = vi.fn();
    renderEdit({ media: [media("M1", { sortOrder: 0 })] }, { onClose, onSubmit });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, pngFile("M2.png"));
    await user.click(screen.getByRole("button", { name: "保存" }));
    expect(await screen.findByText("保存に失敗しました。")).toBeInTheDocument();
    expect(screen.getByText("M2.png")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "概念を編集" })).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
    const firstDraft = onSubmit.mock.calls[0][2] as { fileName?: string; type: string }[];
    const secondDraft = onSubmit.mock.calls[1][2] as { fileName?: string; type: string }[];
    expect(firstDraft.map((item) => item.type)).toEqual(["existing", "new"]);
    expect(secondDraft.map((item) => item.type)).toEqual(["existing", "new"]);
    expect(secondDraft.some((item) => "fileName" in item && item.fileName === "M2.png")).toBe(true);
    expect(onClose).toHaveBeenCalled();
  });

  it("submitting 中は閉じる・キャンセルが無効", async () => {
    const user = userEvent.setup();
    let resolveSubmit: (value: unknown) => void = () => undefined;
    const onSubmit = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveSubmit = resolve;
        })
    );
    const onClose = vi.fn();
    renderEdit({}, { onClose, onSubmit });
    await user.click(screen.getByRole("button", { name: "保存" }));
    expect(await screen.findByRole("button", { name: "保存中..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "閉じる" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "キャンセル" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "閉じる" }));
    await user.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(onClose).not.toHaveBeenCalled();
    resolveSubmit(undefined);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("create で複数 media を付けて Save すると draft が onSubmit に渡る", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async () => ({ id: "new" }));
    const onClose = vi.fn();
    render(
      <ConceptFormModal
        open
        mode="create"
        allConcepts={[]}
        conceptTitleIndex={new Map()}
        onClose={onClose}
        onSubmit={onSubmit}
      />
    );
    await user.type(screen.getByRole("textbox", { name: /タイトル/ }), "新規");
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, [pngFile("a.png"), pngFile("b.png")]);
    await user.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const draft = onSubmit.mock.calls[0][2] as { type: string }[];
    expect(draft).toHaveLength(2);
    expect(draft.every((item) => item.type === "new")).toBe(true);
    expect(onClose).toHaveBeenCalled();
    expect(storageSpies.addMedia).not.toHaveBeenCalled();
  });
});
