import { fireEvent, render, within } from "@testing-library/react";
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

describe("SkillTreeView window 外 selection (#155)", () => {
  it("現在windowに含まれない selectedId では onClearSelection を呼ばない", () => {
    const onClearSelection = vi.fn();
    const concepts = Array.from({ length: 251 }, (_, index) => makeConcept(`c-${index}`, []));
    render(
      <SkillTreeView
        concepts={concepts}
        domainColorMap={colorMap}
        selectedId="c-250"
        onSelectConcept={vi.fn()}
        onClearSelection={onClearSelection}
      />
    );
    expect(document.querySelector('[data-testid="skill-tree-node-c-250"]')).toBeNull();
    expect(onClearSelection).not.toHaveBeenCalled();
  });
});

const related = (id: string, relatedIds: string[]): Concept => ({
  ...makeConcept(id, []),
  relatedIds,
});

const renderConcepts = (concepts: Concept[], props: Partial<Parameters<typeof SkillTreeView>[0]> = {}) =>
  render(
    <SkillTreeView
      concepts={concepts}
      domainColorMap={colorMap}
      onSelectConcept={vi.fn()}
      {...props}
    />
  );

const nodeCount = (id: string) => document.querySelectorAll(`[data-testid="skill-tree-node-${id}"]`).length;

describe("SkillTreeView forest (#208)", () => {
  it("複数の連結成分をすべて描画する", () => {
    renderConcepts([
      related("A", ["B"]),
      related("B", ["A"]),
      related("C", ["D"]),
      related("D", ["C"]),
    ]);
    expect(nodeCount("A")).toBe(1);
    expect(nodeCount("B")).toBe(1);
    expect(nodeCount("C")).toBe(1);
    expect(nodeCount("D")).toBe(1);
  });

  it("孤立 Concept も描画する", () => {
    renderConcepts([related("A", ["B"]), related("B", ["A"]), related("C", [])]);
    expect(nodeCount("A")).toBe(1);
    expect(nodeCount("B")).toBe(1);
    expect(nodeCount("C")).toBe(1);
  });

  it("Issue の 5 Concept をすべて描画しノード数は 5", () => {
    renderConcepts([
      related("A", ["B"]),
      related("B", ["A"]),
      related("C", ["D"]),
      related("D", ["C"]),
      related("E", []),
    ]);
    for (const id of ["A", "B", "C", "D", "E"]) {
      expect(nodeCount(id)).toBe(1);
    }
    expect(document.body.textContent).toContain("ノード 5");
  });

  it("一方の成分を折りたたんでも他成分は残る", () => {
    renderConcepts([
      related("A", ["B"]),
      related("B", ["A"]),
      related("C", ["D"]),
      related("D", ["C"]),
    ]);
    const collapse = document.querySelector('[data-testid="skill-tree-collapse-B"]');
    expect(collapse).not.toBeNull();
    fireEvent.click(collapse!);
    expect(nodeCount("B")).toBe(1);
    expect(nodeCount("A")).toBe(0);
    expect(nodeCount("C")).toBe(1);
    expect(nodeCount("D")).toBe(1);
  });

  it("単一成分は従来どおり両端を描画する", () => {
    renderConcepts([related("A", ["B"]), related("B", ["A"])]);
    expect(nodeCount("A")).toBe(1);
    expect(nodeCount("B")).toBe(1);
    expect(document.body.textContent).toContain("ノード 2");
  });

  it("Concept 1件でも描画する", () => {
    renderConcepts([related("only", [])]);
    expect(nodeCount("only")).toBe(1);
    expect(document.body.textContent).toContain("ノード 1");
  });

  it("さらに表示で window に入った別成分も描画する", () => {
    const concepts: Concept[] = [];
    for (let index = 0; index < 126; index += 1) {
      const left = `p${index}-a`;
      const right = `p${index}-b`;
      concepts.push(related(left, [right]), related(right, [left]));
    }
    renderConcepts(concepts);
    expect(nodeCount("p125-a")).toBe(0);
    expect(nodeCount("p0-a")).toBe(1);
    const more = [...document.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("さらに表示")
    );
    expect(more).toBeTruthy();
    fireEvent.click(more!);
    expect(nodeCount("p125-a")).toBe(1);
    expect(nodeCount("p125-b")).toBe(1);
    expect(document.body.textContent).toContain("ノード 252");
  });

  it("0件ではノードを描かず件数は 0", () => {
    renderConcepts([]);
    expect(document.querySelectorAll('[data-testid^="skill-tree-node-"]')).toHaveLength(0);
    expect(document.body.textContent).toContain("ノード 0");
  });

  it("collapse で隠れた選択だけを clear し、別成分の選択は維持する", () => {
    const onClearSelection = vi.fn();
    const { rerender } = renderConcepts(
      [related("A", ["B"]), related("B", ["A"]), related("C", [])],
      { selectedId: "C", onClearSelection }
    );
    fireEvent.click(document.querySelector('[data-testid="skill-tree-collapse-B"]')!);
    expect(onClearSelection).not.toHaveBeenCalled();

    rerender(
      <SkillTreeView
        concepts={[related("A", ["B"]), related("B", ["A"]), related("C", [])]}
        domainColorMap={colorMap}
        selectedId="A"
        onSelectConcept={vi.fn()}
        onClearSelection={onClearSelection}
      />
    );
    expect(onClearSelection).toHaveBeenCalled();
  });
});
