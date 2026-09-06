import { render, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SkillTreeView } from "./SkillTreeView";
import type { Concept } from "../types/concept";
import { getDomainTagColor, getDomainTagColors } from "../utils/domainColors";

const makeConcept = (id: string, domainTags: string[]): Concept => ({
  id,
  title: `Concept ${id}`,
  definition: "d",
  myInterpretation: "",
  domainTags,
  researchTags: [],
  relatedIds: [],
  source: { book: "", page: "", author: null },
  notes: "",
  status: "active",
  favorite: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
});

const colorMap = {
  AI: "#aa0000",
  HCI: "#00aa00",
  教育: "#0000aa",
  心理: "#aaaa00",
  社会科学: "#00aaaa",
  哲学: "#aa00aa",
  言語: "#666666"
};

const renderTree = (domainTags: string[]) => {
  const concept = makeConcept("solo", domainTags);
  render(
    <SkillTreeView
      concepts={[concept]}
      domainColorMap={colorMap}
      onSelectConcept={vi.fn()}
    />
  );
  return within(document.querySelector('[data-testid="skill-tree-node-solo"]') as HTMLElement);
};

describe("SkillTreeView 複数分野カラー (#142)", () => {
  it("0分野でも描画でき、fallback swatch 1つで +0 はない", () => {
    const node = renderTree([]);
    const swatches = node.getAllByTestId("concept-domain-swatch");
    expect(swatches).toHaveLength(1);
    expect(swatches[0]).toHaveAttribute("fill", getDomainTagColor("", colorMap));
    expect(node.queryByTestId("concept-domain-more-count")).not.toBeInTheDocument();
    expect(node.queryByText("+0")).not.toBeInTheDocument();
  });

  it("1分野は swatch 1 で +N なし", () => {
    const node = renderTree(["AI"]);
    expect(node.getAllByTestId("concept-domain-swatch")).toHaveLength(1);
    expect(node.queryByTestId("concept-domain-more-count")).not.toBeInTheDocument();
  });

  it("2分野は swatch 2 で +N なし", () => {
    const node = renderTree(["AI", "教育"]);
    expect(node.getAllByTestId("concept-domain-swatch")).toHaveLength(2);
    expect(node.queryByTestId("concept-domain-more-count")).not.toBeInTheDocument();
  });

  it("4分野は swatch 4 で +N なし", () => {
    const node = renderTree(["AI", "HCI", "教育", "心理"]);
    const swatches = node.getAllByTestId("concept-domain-swatch");
    expect(swatches).toHaveLength(4);
    expect(swatches.map((swatch) => swatch.getAttribute("fill"))).toEqual(
      getDomainTagColors(["AI", "HCI", "教育", "心理"], colorMap)
    );
    expect(node.queryByTestId("concept-domain-more-count")).not.toBeInTheDocument();
  });

  it("5分野は swatch 4 と +1", () => {
    const node = renderTree(["AI", "教育", "心理", "HCI", "社会科学"]);
    expect(node.getAllByTestId("concept-domain-swatch")).toHaveLength(4);
    expect(node.getByTestId("concept-domain-more-count")).toHaveTextContent("+1");
  });

  it("7分野は swatch 4 と +3", () => {
    const node = renderTree(["AI", "教育", "心理", "HCI", "社会科学", "哲学", "言語"]);
    expect(node.getAllByTestId("concept-domain-swatch")).toHaveLength(4);
    expect(node.getByTestId("concept-domain-more-count")).toHaveTextContent("+3");
  });

  it("raw 5 / unique 4 は swatch 4 で +N なし", () => {
    const node = renderTree(["AI", "AI", "教育", "心理", "HCI"]);
    expect(node.getAllByTestId("concept-domain-swatch")).toHaveLength(4);
    expect(node.queryByTestId("concept-domain-more-count")).not.toBeInTheDocument();
    expect(node.queryByText("+1")).not.toBeInTheDocument();
  });

  it("raw 6 / unique 5 は swatch 4 と +1", () => {
    const node = renderTree(["AI", "AI", "教育", "心理", "HCI", "社会科学"]);
    expect(node.getAllByTestId("concept-domain-swatch")).toHaveLength(4);
    expect(node.getByTestId("concept-domain-more-count")).toHaveTextContent("+1");
    expect(node.queryByText("+2")).not.toBeInTheDocument();
  });
});
