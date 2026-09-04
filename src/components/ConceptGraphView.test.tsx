import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConceptGraphView } from "../components/ConceptGraphView";
import type { Concept } from "../types/concept";
import { createGraphTestConcepts } from "../utils/conceptGraphTestData";
import { lastForceGraphProps, resetForceGraphMock, zoomToFit } from "../test/mocks/react-force-graph-2d";

vi.mock("react-force-graph-2d", () => import("../test/mocks/react-force-graph-2d"));

const makeConcept = (id: string, relatedIds: string[] = [], favorite = false): Concept => ({
  id,
  title: `Concept ${id}`,
  definition: "d",
  myInterpretation: "",
  domainTags: ["人工知能"],
  researchTags: [],
  relatedIds,
  source: { book: "", page: "", author: null },
  notes: "",
  status: "active",
  favorite,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
});

const parseVisibleNodeCount = (): number => {
  const label = screen.getByText(/ノード/).textContent ?? "";
  const match = label.match(/ノード (\d+)/);
  return Number(match?.[1]);
};

const renderGraph = (concepts: Concept[], selectedId?: string, onSelect = vi.fn()) =>
  render(
    <ConceptGraphView
      concepts={concepts}
      domainColorMap={{}}
      selectedId={selectedId}
      onSelectConcept={onSelect}
    />
  );

describe("ConceptGraphView UI regressions (#104 / #106 / #107)", () => {
  beforeEach(() => {
    resetForceGraphMock();
  });

  describe("#104 操作UI", () => {
    it("詳細パネル想定の選択状態でも主要グラフ操作ボタンを押せる", async () => {
      const user = userEvent.setup();
      const concepts = createGraphTestConcepts({ conceptCount: 250, seed: 104 });
      renderGraph(concepts, concepts[0]?.id);

      await user.click(screen.getByRole("button", { name: "1-hop" }));
      expect(screen.getByRole("button", { name: "1-hop" })).toHaveAttribute("aria-pressed", "true");

      await user.click(screen.getByRole("button", { name: "2-hop" }));
      expect(screen.getByRole("button", { name: "2-hop" })).toHaveAttribute("aria-pressed", "true");

      await user.click(screen.getByRole("button", { name: "全体" }));
      expect(screen.getByRole("button", { name: "全体" })).toHaveAttribute("aria-pressed", "true");

      await user.click(screen.getByRole("button", { name: "全体を収める" }));
      expect(zoomToFit).toHaveBeenCalled();

      await user.click(screen.getByRole("button", { name: "表示をリセット" }));
      await user.click(screen.getByRole("button", { name: /さらに表示/ }));
      expect(parseVisibleNodeCount()).toBe(250);
    });
  });

  describe("#106 初回 auto fit", () => {
    it("非空グラフの onEngineStop で zoomToFit が1回だけ呼ばれる", () => {
      renderGraph([makeConcept("a"), makeConcept("b")]);
      lastForceGraphProps.onEngineStop?.();
      lastForceGraphProps.onEngineStop?.();
      expect(zoomToFit).toHaveBeenCalledTimes(1);
    });

    it("0 nodes では zoomToFit せず、その後の非空グラフで初回 auto fit できる", () => {
      const { rerender } = renderGraph([]);
      lastForceGraphProps.onEngineStop?.();
      expect(zoomToFit).not.toHaveBeenCalled();

      rerender(
        <ConceptGraphView
          concepts={[makeConcept("a")]}
          domainColorMap={{}}
          onSelectConcept={vi.fn()}
        />
      );
      lastForceGraphProps.onEngineStop?.();
      expect(zoomToFit).toHaveBeenCalledTimes(1);
    });

    it("Concept選択・favorite描画変更・viewMode・graphNodeLimit・resize後も再 fit しない", async () => {
      const user = userEvent.setup();
      const concepts = createGraphTestConcepts({ conceptCount: 250, seed: 106 });
      const { rerender } = renderGraph(concepts);
      lastForceGraphProps.onEngineStop?.();
      expect(zoomToFit).toHaveBeenCalledTimes(1);

      rerender(
        <ConceptGraphView
          concepts={concepts}
          domainColorMap={{}}
          selectedId={concepts[0]?.id}
          onSelectConcept={vi.fn()}
        />
      );
      lastForceGraphProps.onEngineStop?.();

      const favorited = concepts.map((concept, index) =>
        index === 0 ? { ...concept, favorite: true } : concept
      );
      rerender(
        <ConceptGraphView
          concepts={favorited}
          domainColorMap={{}}
          selectedId={concepts[0]?.id}
          onSelectConcept={vi.fn()}
        />
      );
      lastForceGraphProps.onEngineStop?.();

      await user.click(screen.getByRole("button", { name: "1-hop" }));
      await user.click(screen.getByRole("button", { name: "全体" }));
      await user.click(screen.getByRole("button", { name: /さらに表示/ }));
      lastForceGraphProps.onEngineStop?.();

      Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, value: 390 });
      Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, value: 640 });
      lastForceGraphProps.onEngineStop?.();

      expect(zoomToFit).toHaveBeenCalledTimes(1);
    });

    it("auto fit 済みでも手動の全体を収めるは何度でも zoomToFit できる", async () => {
      const user = userEvent.setup();
      renderGraph([makeConcept("a"), makeConcept("b")]);
      lastForceGraphProps.onEngineStop?.();
      await user.click(screen.getByRole("button", { name: "全体を収める" }));
      await user.click(screen.getByRole("button", { name: "全体を収める" }));
      expect(zoomToFit).toHaveBeenCalledTimes(3);
    });
  });

  describe("#107 graphNodeLimit の保持", () => {
    const thousand = createGraphTestConcepts({ conceptCount: 1000, seed: 107 });

    it("200件表示 → filter 1件 → 解除で 200件に戻る", () => {
      const { rerender } = renderGraph(thousand);
      expect(parseVisibleNodeCount()).toBe(200);

      rerender(
        <ConceptGraphView
          concepts={[thousand[0]!]}
          domainColorMap={{}}
          onSelectConcept={vi.fn()}
        />
      );
      expect(parseVisibleNodeCount()).toBe(1);

      rerender(
        <ConceptGraphView concepts={thousand} domainColorMap={{}} onSelectConcept={vi.fn()} />
      );
      expect(parseVisibleNodeCount()).toBe(200);
    });

    it("400件表示 → filter 1件 → 解除で 400件に戻る", async () => {
      const user = userEvent.setup();
      const { rerender } = renderGraph(thousand);
      await user.click(screen.getByRole("button", { name: /さらに表示/ }));
      expect(parseVisibleNodeCount()).toBe(400);

      rerender(
        <ConceptGraphView
          concepts={[thousand[0]!]}
          domainColorMap={{}}
          onSelectConcept={vi.fn()}
        />
      );
      expect(parseVisibleNodeCount()).toBe(1);

      rerender(
        <ConceptGraphView concepts={thousand} domainColorMap={{}} onSelectConcept={vi.fn()} />
      );
      expect(parseVisibleNodeCount()).toBe(400);
    });

    it("400件 → filter 0件 → 解除で 400件のまま（GRAPH_NODE_PAGE に戻らない）", async () => {
      const user = userEvent.setup();
      const { rerender } = renderGraph(thousand);
      await user.click(screen.getByRole("button", { name: /さらに表示/ }));
      expect(parseVisibleNodeCount()).toBe(400);

      rerender(
        <ConceptGraphView concepts={[]} domainColorMap={{}} onSelectConcept={vi.fn()} />
      );
      expect(parseVisibleNodeCount()).toBe(0);

      rerender(
        <ConceptGraphView concepts={thousand} domainColorMap={{}} onSelectConcept={vi.fn()} />
      );
      expect(parseVisibleNodeCount()).toBe(400);
    });

    it("全体400 → 1-hop → 全体 で 400件を保持する", async () => {
      const user = userEvent.setup();
      renderGraph(thousand, thousand[0]?.id);
      await user.click(screen.getByRole("button", { name: /さらに表示/ }));
      expect(parseVisibleNodeCount()).toBe(400);

      await user.click(screen.getByRole("button", { name: "1-hop" }));
      await user.click(screen.getByRole("button", { name: "全体" }));
      expect(parseVisibleNodeCount()).toBe(400);
    });

    it("全体400 → 2-hop → 全体 で 400件を保持する", async () => {
      const user = userEvent.setup();
      renderGraph(thousand, thousand[0]?.id);
      await user.click(screen.getByRole("button", { name: /さらに表示/ }));
      expect(parseVisibleNodeCount()).toBe(400);

      await user.click(screen.getByRole("button", { name: "2-hop" }));
      await user.click(screen.getByRole("button", { name: "全体" }));
      expect(parseVisibleNodeCount()).toBe(400);
    });

    it("filter解除後もさらに表示で 400 → 600 へ継続できる", async () => {
      const user = userEvent.setup();
      const { rerender } = renderGraph(thousand);
      await user.click(screen.getByRole("button", { name: /さらに表示/ }));

      rerender(
        <ConceptGraphView
          concepts={[thousand[0]!]}
          domainColorMap={{}}
          onSelectConcept={vi.fn()}
        />
      );
      rerender(
        <ConceptGraphView concepts={thousand} domainColorMap={{}} onSelectConcept={vi.fn()} />
      );
      expect(parseVisibleNodeCount()).toBe(400);

      await user.click(screen.getByRole("button", { name: /さらに表示/ }));
      expect(parseVisibleNodeCount()).toBe(600);
    });
  });
});
