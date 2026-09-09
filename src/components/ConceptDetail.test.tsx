import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createEmptyConceptInput, type Concept } from "../types/concept";
import { ConceptDetail } from "./ConceptDetail";

vi.mock("../storage", () => ({
  getStorage: () => ({
    getMediaBlob: async () => null
  })
}));

const concept = (): Concept => ({
  ...createEmptyConceptInput(),
  id: "c1",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  title: "対象",
  definition: "定義"
});

describe("ConceptDetail (#22)", () => {
  const baseProps = {
    concept: concept(),
    conceptMap: new Map<string, Concept>(),
    domainColorMap: {},
    onSelectRelated: vi.fn(),
    onRequestDelete: vi.fn(),
    deleting: false
  };

  it("onOpenGraphAnalysis が無いときは分析ボタンを出さない", () => {
    render(<ConceptDetail {...baseProps} />);
    expect(screen.queryByRole("button", { name: "この概念を分析" })).not.toBeInTheDocument();
  });

  it("onOpenGraphAnalysis があるとき Concept ID を渡す", async () => {
    const onOpen = vi.fn();
    render(<ConceptDetail {...baseProps} onOpenGraphAnalysis={onOpen} />);
    await userEvent.click(screen.getByRole("button", { name: "この概念を分析" }));
    expect(onOpen).toHaveBeenCalledWith("c1");
  });
});
