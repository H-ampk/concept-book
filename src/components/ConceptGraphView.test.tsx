import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConceptGraphView } from "../components/ConceptGraphView";
import type { Concept } from "../types/concept";
import { createGraphTestConcepts } from "../utils/conceptGraphTestData";
import { getDomainTagColor, getDomainTagColors, isHexColor } from "../utils/domainColors";
import { lastForceGraphProps, resetForceGraphMock, zoomToFit } from "../test/mocks/react-force-graph-2d";

vi.mock("react-force-graph-2d", () => import("../test/mocks/react-force-graph-2d"));

const makeConcept = (
  id: string,
  relatedIds: string[] = [],
  favorite = false,
  domainTags: string[] = ["人工知能"]
): Concept => ({
  id,
  title: `Concept ${id}`,
  definition: "d",
  myInterpretation: "",
  domainTags,
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

    it("通常 / 学習回数 / 正答率を切り替えられ、正答率のときだけ凡例が出る", async () => {
      const user = userEvent.setup();
      const concepts = [makeConcept("a"), makeConcept("b")];
      renderGraph(concepts);
      const graphDataBefore = lastForceGraphProps.graphData;

      expect(screen.getByRole("button", { name: "通常" })).toHaveAttribute("aria-pressed", "true");
      expect(screen.queryByRole("list", { name: "正答率の凡例" })).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "正答率" }));
      expect(screen.getByRole("button", { name: "正答率" })).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByRole("list", { name: "正答率の凡例" })).toHaveTextContent("未学習");
      expect(screen.getByRole("list", { name: "正答率の凡例" })).toHaveTextContent("0–25%");
      expect(lastForceGraphProps.graphData).toBe(graphDataBefore);

      await user.click(screen.getByRole("button", { name: "学習回数" }));
      expect(screen.getByRole("button", { name: "学習回数" })).toHaveAttribute("aria-pressed", "true");
      expect(screen.queryByRole("list", { name: "正答率の凡例" })).not.toBeInTheDocument();
      expect(lastForceGraphProps.graphData).toBe(graphDataBefore);

      await user.click(screen.getByRole("button", { name: "通常" }));
      expect(screen.getByRole("button", { name: "通常" })).toHaveAttribute("aria-pressed", "true");
      expect(screen.queryByRole("list", { name: "正答率の凡例" })).not.toBeInTheDocument();
    });

    it("混同表示は初期 OFF で、直接混同 / 混同近傍に切り替えても graphData identity を変えない", async () => {
      const user = userEvent.setup();
      const concepts = [makeConcept("a"), makeConcept("b")];
      render(
        <ConceptGraphView
          concepts={concepts}
          domainColorMap={{}}
          onSelectConcept={vi.fn()}
          confusionPairs={[{ selectedConceptId: "a", correctConceptId: "b", count: 2 }]}
        />
      );
      const graphDataBefore = lastForceGraphProps.graphData;
      expect(screen.getByRole("button", { name: "OFF" })).toHaveAttribute("aria-pressed", "true");
      expect(screen.queryByLabelText("直接混同の凡例")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("混同近傍の凡例")).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "直接混同" }));
      expect(screen.getByRole("button", { name: "直接混同" })).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByLabelText("直接混同の凡例")).toHaveTextContent("1組");
      expect(lastForceGraphProps.graphData).toBe(graphDataBefore);

      await user.click(screen.getByRole("button", { name: "混同近傍" }));
      expect(screen.getByRole("button", { name: "混同近傍" })).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByLabelText("混同近傍の凡例")).toHaveTextContent("誤答パターンが似ている概念");
      expect(lastForceGraphProps.graphData).toBe(graphDataBefore);

      await user.click(screen.getByRole("button", { name: "OFF" }));
      expect(screen.getByRole("button", { name: "OFF" })).toHaveAttribute("aria-pressed", "true");
      expect(lastForceGraphProps.graphData).toBe(graphDataBefore);
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

type DomainStrokeRecord = {
  strokeStyle: string;
  lineWidth: number;
  x: number;
  y: number;
  radius: number;
  startAngle: number;
  endAngle: number;
};

const createDomainRingRecorder = () => {
  let lastArc: number[] = [];
  const strokes: DomainStrokeRecord[] = [];
  const context = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    font: "",
    textAlign: "start",
    textBaseline: "alphabetic",
    lineJoin: "miter",
    miterLimit: 10,
    globalAlpha: 1,
    beginPath: () => undefined,
    arc: (...args: number[]) => {
      lastArc = args;
    },
    fill: () => undefined,
    stroke: () => {
      strokes.push({
        strokeStyle: String(context.strokeStyle),
        lineWidth: context.lineWidth,
        x: lastArc[0] ?? Number.NaN,
        y: lastArc[1] ?? Number.NaN,
        radius: lastArc[2] ?? Number.NaN,
        startAngle: lastArc[3] ?? Number.NaN,
        endAngle: lastArc[4] ?? Number.NaN
      });
    },
    save: () => undefined,
    restore: () => undefined,
    strokeText: () => undefined,
    fillText: () => undefined
  };
  return { context: context as unknown as CanvasRenderingContext2D, strokes };
};

const TWO_PI = Math.PI * 2;
const isOuterEmphasisRing = (stroke: DomainStrokeRecord) =>
  stroke.startAngle === 0 && Math.abs(stroke.endAngle - TWO_PI) < 1e-9;

const paintDomainRings = (
  concept: Concept,
  options?: {
    selectedId?: string;
    domainColorMap?: Record<string, string>;
    metricMode?: "attempts" | "accuracy";
  }
) => {
  const domainColorMap = options?.domainColorMap ?? {};
  render(
    <ConceptGraphView
      concepts={[concept]}
      domainColorMap={domainColorMap}
      selectedId={options?.selectedId}
      onSelectConcept={vi.fn()}
    />
  );
  return domainColorMap;
};

const invokeNodeCanvas = async (
  concept: Concept,
  options?: {
    selectedId?: string;
    domainColorMap?: Record<string, string>;
    metricMode?: "attempts" | "accuracy";
  }
) => {
  const domainColorMap = paintDomainRings(concept, options);
  if (options?.metricMode === "attempts") {
    await userEvent.setup().click(screen.getByRole("button", { name: "学習回数" }));
  }
  if (options?.metricMode === "accuracy") {
    await userEvent.setup().click(screen.getByRole("button", { name: "正答率" }));
  }
  const nodeCanvasObject = lastForceGraphProps.nodeCanvasObject;
  expect(nodeCanvasObject).toBeTypeOf("function");
  const recorder = createDomainRingRecorder();
  nodeCanvasObject?.({ id: concept.id, x: 40, y: 50 }, recorder.context, 1);
  const domainStrokes = recorder.strokes.filter((stroke) => !isOuterEmphasisRing(stroke));
  const outerStrokes = recorder.strokes.filter(isOuterEmphasisRing);
  return { domainStrokes, outerStrokes, domainColorMap };
};

describe("#142 複数分野カラー描画", () => {
  const colorMap = {
    AI: "#aa0000",
    HCI: "#00aa00",
    教育: "#0000aa",
    心理: "#aaaa00",
    社会科学: "#00aaaa"
  };

  beforeEach(() => {
    resetForceGraphMock();
  });

  it("1分野は domain ring 1 segment", async () => {
    const { domainStrokes, outerStrokes } = await invokeNodeCanvas(makeConcept("a", [], false, ["AI"]), {
      domainColorMap: colorMap
    });
    expect(domainStrokes).toHaveLength(1);
    expect(domainStrokes[0]?.strokeStyle).toBe("#aa0000");
    expect(outerStrokes).toHaveLength(0);
  });

  it("2分野は domain ring 2 segment で先頭1色へ縮退しない", async () => {
    const concept = makeConcept("a", [], false, ["AI", "教育"]);
    const { domainStrokes } = await invokeNodeCanvas(concept, { domainColorMap: colorMap });
    expect(domainStrokes).toHaveLength(2);
    expect(domainStrokes.map((stroke) => stroke.strokeStyle)).toEqual(
      getDomainTagColors(concept.domainTags, colorMap)
    );
  });

  it("4分野は domain ring 4 segment", async () => {
    const tags = ["AI", "HCI", "教育", "心理"];
    const { domainStrokes } = await invokeNodeCanvas(makeConcept("a", [], false, tags), {
      domainColorMap: colorMap
    });
    expect(domainStrokes).toHaveLength(4);
  });

  it("5分野以上でも domain ring は最大4 segment", async () => {
    const tags = ["AI", "教育", "心理", "HCI", "社会科学"];
    const { domainStrokes } = await invokeNodeCanvas(makeConcept("a", [], false, tags), {
      domainColorMap: colorMap
    });
    expect(domainStrokes).toHaveLength(4);
    expect(domainStrokes.map((stroke) => stroke.strokeStyle)).toEqual(
      getDomainTagColors(tags, colorMap)
    );
  });

  it("入力順が違っても domain ring の stroke color 順は同じ", async () => {
    const first = await invokeNodeCanvas(makeConcept("a", [], false, ["AI", "教育", "HCI"]), {
      domainColorMap: colorMap
    });
    resetForceGraphMock();
    const second = await invokeNodeCanvas(makeConcept("b", [], false, ["HCI", "AI", "教育"]), {
      domainColorMap: colorMap
    });
    expect(first.domainStrokes.map((stroke) => stroke.strokeStyle)).toEqual(
      second.domainStrokes.map((stroke) => stroke.strokeStyle)
    );
  });

  it("未登録色でも fallback の #RRGGBB で stroke される", async () => {
    const { domainStrokes } = await invokeNodeCanvas(makeConcept("a", [], false, ["未知分野"]));
    expect(domainStrokes).toHaveLength(1);
    expect(domainStrokes[0]?.strokeStyle).toBeTypeOf("string");
    expect(isHexColor(domainStrokes[0]!.strokeStyle)).toBe(true);
    expect(domainStrokes[0]?.strokeStyle).toBe(getDomainTagColor("未知分野", {}));
  });

  it("0分野でも描画でき fallback 1 ring で +0 相当の破綻がない", async () => {
    const { domainStrokes, outerStrokes } = await invokeNodeCanvas(makeConcept("a", [], false, []));
    expect(domainStrokes).toHaveLength(1);
    expect(domainStrokes[0]?.strokeStyle).toBe(getDomainTagColor("", {}));
    expect(outerStrokes).toHaveLength(0);
  });

  it("selected と共存しても domain ring は消えず outer ring は1本", async () => {
    const concept = makeConcept("a", [], false, ["AI", "教育"]);
    const { domainStrokes, outerStrokes } = await invokeNodeCanvas(concept, {
      selectedId: concept.id,
      domainColorMap: colorMap
    });
    expect(domainStrokes).toHaveLength(2);
    expect(outerStrokes).toHaveLength(1);
    expect(outerStrokes[0]?.strokeStyle).toBe("#446878");
    expect(outerStrokes[0]?.lineWidth).toBe(2.2);
  });

  it("favorite と共存しても domain ring + outer favorite ring を維持する", async () => {
    const concept = makeConcept("a", [], true, ["AI", "教育"]);
    const { domainStrokes, outerStrokes } = await invokeNodeCanvas(concept, {
      domainColorMap: colorMap
    });
    expect(domainStrokes).toHaveLength(2);
    expect(outerStrokes).toHaveLength(1);
    expect(outerStrokes[0]?.strokeStyle).toBe("#7a9dad");
    expect(outerStrokes[0]?.lineWidth).toBe(1.4);
  });

  it("selected + favorite は outer emphasis ring 1本で selected 表現が優先される", async () => {
    const concept = makeConcept("a", [], true, ["AI", "教育"]);
    const { domainStrokes, outerStrokes } = await invokeNodeCanvas(concept, {
      selectedId: concept.id,
      domainColorMap: colorMap
    });
    expect(domainStrokes).toHaveLength(2);
    expect(outerStrokes).toHaveLength(1);
    expect(outerStrokes[0]?.strokeStyle).toBe("#446878");
    expect(outerStrokes[0]?.lineWidth).toBe(2.2);
  });

  it("metric mode を切り替えても domain ring の色数と色は失われない", async () => {
    const concept = makeConcept("a", [], false, ["AI", "教育"]);
    const { domainStrokes } = await invokeNodeCanvas(concept, {
      domainColorMap: colorMap,
      metricMode: "attempts"
    });
    expect(domainStrokes).toHaveLength(2);
    expect(domainStrokes.map((stroke) => stroke.strokeStyle)).toEqual(
      getDomainTagColors(concept.domainTags, colorMap)
    );
  });

  it("正答率モードでも domain ring の色数と色は失われない", async () => {
    const concept = makeConcept("a", [], false, ["AI", "教育"]);
    const { domainStrokes } = await invokeNodeCanvas(concept, {
      domainColorMap: colorMap,
      metricMode: "accuracy"
    });
    expect(domainStrokes).toHaveLength(2);
    expect(domainStrokes.map((stroke) => stroke.strokeStyle)).toEqual(
      getDomainTagColors(concept.domainTags, colorMap)
    );
  });
});
