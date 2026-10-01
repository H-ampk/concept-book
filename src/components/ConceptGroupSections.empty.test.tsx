import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createEmptyConceptInput, type Concept } from "../types/concept";
import { ConceptGroupSections } from "./ConceptGroupSections";

const concept = (id: string): Concept => ({
  ...createEmptyConceptInput(),
  id,
  title: id,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
});

const renderSections = (hasAnyConcepts: boolean, concepts: Concept[] = []) => {
  const onCreateConcept = vi.fn();
  const onOpenGuide = vi.fn();
  render(
    <ConceptGroupSections
      mode="all"
      sections={[{ key: "all", label: "全体", concepts }]}
      domainColorMap={{}}
      onSelect={vi.fn()}
      cardRefs={{ current: new Map() }}
      hasAnyConcepts={hasAnyConcepts}
      onCreateConcept={onCreateConcept}
      onOpenGuide={onOpenGuide}
    />
  );
  return { onCreateConcept, onOpenGuide };
};

describe("ConceptGroupSections empty state", () => {
  it("Concept が1件もないときは初回向け案内を出す", async () => {
    const user = userEvent.setup();
    const { onCreateConcept, onOpenGuide } = renderSections(false);

    expect(screen.getByTestId("concept-empty-none")).toBeInTheDocument();
    expect(screen.getByText("最初の Concept を登録してみましょう")).toBeInTheDocument();
    expect(screen.queryByTestId("concept-empty-filtered")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Concept を追加する" }));
    await user.click(screen.getByRole("button", { name: "使い方を見る" }));
    expect(onCreateConcept).toHaveBeenCalledTimes(1);
    expect(onOpenGuide).toHaveBeenCalledTimes(1);
  });

  it("Concept はあるがフィルタ結果が0件のときは条件不一致を出す", () => {
    renderSections(true, []);

    expect(screen.getByTestId("concept-empty-filtered")).toHaveTextContent(
      "条件に一致する Concept がありません。"
    );
    expect(screen.queryByText("最初の Concept を登録してみましょう")).not.toBeInTheDocument();
  });

  it("表示対象があるときは空状態を出さない", () => {
    renderSections(true, [concept("gradient")]);
    expect(screen.queryByTestId("concept-empty-none")).not.toBeInTheDocument();
    expect(screen.queryByTestId("concept-empty-filtered")).not.toBeInTheDocument();
    expect(screen.getByText("gradient")).toBeInTheDocument();
  });
});
