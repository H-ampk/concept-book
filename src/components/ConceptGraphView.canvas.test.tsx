import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConceptGraphView } from "../components/ConceptGraphView";
import type { Concept } from "../types/concept";
import {
  GRAPH_ACCURACY_FILL_0_25,
  GRAPH_ACCURACY_FILL_76_100,
  GRAPH_ACCURACY_FILL_UNLEARNED,
  getConceptGraphAccuracyFill
} from "../utils/conceptGraphAccuracy";
import { GRAPH_NODE_RADIUS_DEFAULT } from "../utils/conceptGraphAttemptRadius";
import {
  cosineSimilaritySparse,
  DIRECT_CONFUSION_DASH_LENGTH,
  DIRECT_CONFUSION_GAP_LENGTH,
  DIRECT_CONFUSION_STROKE,
  getConfusionKnnLineWidth,
  getConfusionKnnOpacity,
  getDirectConfusionLineWidth,
  KNN_CONFUSION_DASH_LENGTH,
  KNN_CONFUSION_GAP_LENGTH,
  KNN_CONFUSION_STROKE
} from "../utils/conceptGraphConfusion";
import type { ConceptQuizStats } from "../utils/quiz/getConceptQuizStats";
import {
  FULL_LABEL_SCALE,
  getConceptGraphLabelHaloScreenWidth,
  getConceptGraphLabelStyle,
  getConceptGraphLabelText,
  LABEL_ELLIPSIS,
  MEDIUM_LABEL_SCALE
} from "../utils/conceptGraphLod";
import { lastForceGraphProps, resetForceGraphMock } from "../test/mocks/react-force-graph-2d";

vi.mock("react-force-graph-2d", () => import("../test/mocks/react-force-graph-2d"));

const LONG_TITLE = "これは十分に長いConceptタイトルです";
const SHORT_TITLE = "AI教育";
const FAR_SCALE = MEDIUM_LABEL_SCALE - 0.0001;

type CanvasCall = {
  type: string;
  args: unknown[];
  lineWidth?: number;
  font?: string;
  fillStyle?: unknown;
  globalAlpha?: number;
  strokeStyle?: unknown;
};

const makeConcept = (
  id: string,
  title: string,
  flags?: { favorite?: boolean }
): Concept => ({
  id,
  title,
  definition: "d",
  myInterpretation: "",
  domainTags: ["人工知能"],
  researchTags: [],
  relatedIds: [],
  source: { book: "", page: "", author: null },
  notes: "",
  status: "active",
  favorite: flags?.favorite ?? false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
});

const createCanvasContextMock = () => {
  const calls: CanvasCall[] = [];
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
    beginPath: (...args: unknown[]) => {
      calls.push({ type: "beginPath", args });
    },
    arc: (...args: unknown[]) => {
      calls.push({ type: "arc", args });
    },
    fill: (...args: unknown[]) => {
      calls.push({ type: "fill", args, fillStyle: context.fillStyle });
    },
    stroke: (...args: unknown[]) => {
      calls.push({
        type: "stroke",
        args,
        lineWidth: context.lineWidth,
        globalAlpha: context.globalAlpha,
        strokeStyle: context.strokeStyle
      });
    },
    save: (...args: unknown[]) => {
      calls.push({ type: "save", args });
    },
    restore: (...args: unknown[]) => {
      calls.push({ type: "restore", args });
    },
    strokeText: (...args: unknown[]) => {
      calls.push({
        type: "strokeText",
        args,
        lineWidth: context.lineWidth,
        font: context.font
      });
    },
    fillText: (...args: unknown[]) => {
      calls.push({
        type: "fillText",
        args,
        lineWidth: context.lineWidth,
        font: context.font
      });
    },
    setLineDash: (...args: unknown[]) => {
      calls.push({ type: "setLineDash", args });
    },
    moveTo: (...args: unknown[]) => {
      calls.push({ type: "moveTo", args });
    },
    lineTo: (...args: unknown[]) => {
      calls.push({ type: "lineTo", args });
    }
  };

  return { context: context as unknown as CanvasRenderingContext2D, calls };
};

const renderGraph = (concepts: Concept[], selectedId?: string) =>
  render(
    <ConceptGraphView
      concepts={concepts}
      domainColorMap={{}}
      selectedId={selectedId}
      onSelectConcept={vi.fn()}
    />
  );

const paintNode = (
  concept: Concept,
  globalScale: number,
  selectedId?: string
) => {
  renderGraph([concept], selectedId);
  const nodeCanvasObject = lastForceGraphProps.nodeCanvasObject;
  expect(nodeCanvasObject).toBeTypeOf("function");
  const mock = createCanvasContextMock();
  nodeCanvasObject?.(
    { id: concept.id, x: 100, y: 100 },
    mock.context,
    globalScale
  );
  return mock;
};

const parseFontPx = (font: string): number => {
  const match = font.match(/([\d.]+)px/);
  expect(match?.[1]).toBeDefined();
  return Number(match?.[1]);
};

const conceptLabelCalls = (calls: CanvasCall[]) =>
  calls.filter((call) => call.type === "strokeText" || call.type === "fillText");

describe("ConceptGraphView Canvas label integration (#143)", () => {
  beforeEach(() => {
    resetForceGraphMock();
  });

  describe("label text through nodeCanvasObject", () => {
    it("A. far + normal + 長文は先頭12文字+…が strokeText / fillText に渡り、全文は渡らない", () => {
      const concept = makeConcept("a", LONG_TITLE);
      const { calls } = paintNode(concept, FAR_SCALE);
      const expected = getConceptGraphLabelText({
        title: LONG_TITLE,
        globalScale: FAR_SCALE,
        isSelected: false,
        isFavorite: false
      });
      const labels = conceptLabelCalls(calls).map((call) => call.args[0]);

      expect(expected).toBe(`${LONG_TITLE.slice(0, 12)}${LABEL_ELLIPSIS}`);
      expect(labels).toEqual([expected, expected]);
      expect(labels).not.toContain(LONG_TITLE);
    });

    it("B. far + selected は長文でも全文が Canvas へ渡る", () => {
      const concept = makeConcept("a", LONG_TITLE);
      const { calls } = paintNode(concept, FAR_SCALE, concept.id);
      const labels = conceptLabelCalls(calls).map((call) => call.args[0]);

      expect(labels).toEqual([LONG_TITLE, LONG_TITLE]);
      expect(String(labels[0])).not.toContain(LABEL_ELLIPSIS);
    });

    it("C. far + favorite は長文でも全文が Canvas へ渡る", () => {
      const concept = makeConcept("a", LONG_TITLE, { favorite: true });
      const { calls } = paintNode(concept, FAR_SCALE);
      const labels = conceptLabelCalls(calls).map((call) => call.args[0]);

      expect(labels).toEqual([LONG_TITLE, LONG_TITLE]);
      expect(String(labels[0])).not.toContain(LABEL_ELLIPSIS);
    });

    it("D. far + selected + favorite でも全文になり、強調 halo になる", () => {
      const concept = makeConcept("a", LONG_TITLE, { favorite: true });
      const { calls } = paintNode(concept, FAR_SCALE, concept.id);
      const labels = conceptLabelCalls(calls).map((call) => call.args[0]);
      const expectedHalo = getConceptGraphLabelHaloScreenWidth({
        isSelected: true,
        isFavorite: true
      });
      const safeScale = Math.min(Math.max(FAR_SCALE, 0.05), 40);
      const stroke = calls.find((call) => call.type === "strokeText");

      expect(labels).toEqual([LONG_TITLE, LONG_TITLE]);
      expect((stroke?.lineWidth ?? Number.NaN) * safeScale).toBeCloseTo(expectedHalo);
    });

    it("E. medium では通常 Concept でも全文が Canvas へ渡る", () => {
      const concept = makeConcept("a", LONG_TITLE);
      const { calls } = paintNode(concept, MEDIUM_LABEL_SCALE);
      const labels = conceptLabelCalls(calls).map((call) => call.args[0]);

      expect(labels).toEqual([LONG_TITLE, LONG_TITLE]);
    });

    it("F. near では通常 Concept でも全文が Canvas へ渡る", () => {
      const concept = makeConcept("a", LONG_TITLE);
      const { calls } = paintNode(concept, FULL_LABEL_SCALE);
      const labels = conceptLabelCalls(calls).map((call) => call.args[0]);

      expect(labels).toEqual([LONG_TITLE, LONG_TITLE]);
    });

    it("G. far + 短文は省略記号を付けない", () => {
      const concept = makeConcept("a", SHORT_TITLE);
      const { calls } = paintNode(concept, FAR_SCALE);
      const labels = conceptLabelCalls(calls).map((call) => call.args[0]);

      expect(labels).toEqual([SHORT_TITLE, SHORT_TITLE]);
      expect(String(labels[0])).not.toContain(LABEL_ELLIPSIS);
    });
  });

  describe("strokeText / fillText", () => {
    it("H/I. 同一ラベルは strokeText → fillText の順で同じ文字列・座標になる", () => {
      const concept = makeConcept("a", LONG_TITLE);
      const { calls } = paintNode(concept, FAR_SCALE);
      const textCalls = conceptLabelCalls(calls);

      expect(textCalls.map((call) => call.type)).toEqual(["strokeText", "fillText"]);
      expect(textCalls[0]?.args).toEqual(textCalls[1]?.args);
    });
  });

  describe("全Concept描画", () => {
    it("J. graphData.nodes の全 Concept で本体ラベルの fillText が描画される", () => {
      const concepts = [
        makeConcept("c1", "概念1"),
        makeConcept("c2", "概念2"),
        makeConcept("c3", "概念3"),
        makeConcept("c4", "概念4"),
        makeConcept("c5", "概念5")
      ];
      renderGraph(concepts);
      const nodeCanvasObject = lastForceGraphProps.nodeCanvasObject;
      const nodes = lastForceGraphProps.graphData?.nodes ?? [];
      expect(nodes).toHaveLength(5);

      const mock = createCanvasContextMock();
      for (const node of nodes) {
        const id = (node as { id: string }).id;
        nodeCanvasObject?.({ id, x: 10, y: 10 }, mock.context, FAR_SCALE);
      }

      const fillTexts = mock.calls.filter((call) => call.type === "fillText");
      expect(fillTexts).toHaveLength(5);
      expect(fillTexts.map((call) => call.args[0])).toEqual(
        concepts.map((concept) => concept.title)
      );
    });
  });

  describe("halo", () => {
    const haloScreenWidthFromCanvas = (lineWidth: number, globalScale: number) =>
      lineWidth * Math.min(Math.max(globalScale, 0.05), 40);

    it("K. normal の lineWidth * safeScale が helper と一致する", () => {
      const concept = makeConcept("a", SHORT_TITLE);
      const { calls } = paintNode(concept, FAR_SCALE);
      const expected = getConceptGraphLabelHaloScreenWidth({
        isSelected: false,
        isFavorite: false
      });
      const stroke = calls.find((call) => call.type === "strokeText");

      expect(haloScreenWidthFromCanvas(stroke?.lineWidth ?? Number.NaN, FAR_SCALE)).toBeCloseTo(
        expected
      );
    });

    it("L. selected は normal より強い halo で helper と一致する", () => {
      const concept = makeConcept("a", SHORT_TITLE);
      const { calls } = paintNode(concept, FAR_SCALE, concept.id);
      const expected = getConceptGraphLabelHaloScreenWidth({
        isSelected: true,
        isFavorite: false
      });
      const normal = getConceptGraphLabelHaloScreenWidth({
        isSelected: false,
        isFavorite: false
      });
      const stroke = calls.find((call) => call.type === "strokeText");

      expect(expected).toBeGreaterThan(normal);
      expect(haloScreenWidthFromCanvas(stroke?.lineWidth ?? Number.NaN, FAR_SCALE)).toBeCloseTo(
        expected
      );
    });

    it("M. favorite は normal より強い halo になる", () => {
      const concept = makeConcept("a", SHORT_TITLE, { favorite: true });
      const { calls } = paintNode(concept, FAR_SCALE);
      const expected = getConceptGraphLabelHaloScreenWidth({
        isSelected: false,
        isFavorite: true
      });
      const normal = getConceptGraphLabelHaloScreenWidth({
        isSelected: false,
        isFavorite: false
      });
      const stroke = calls.find((call) => call.type === "strokeText");

      expect(expected).toBeGreaterThan(normal);
      expect(haloScreenWidthFromCanvas(stroke?.lineWidth ?? Number.NaN, FAR_SCALE)).toBeCloseTo(
        expected
      );
    });

    it("N. selected + favorite でも helper の強調 halo と一致する", () => {
      const concept = makeConcept("a", SHORT_TITLE, { favorite: true });
      const { calls } = paintNode(concept, FAR_SCALE, concept.id);
      const expected = getConceptGraphLabelHaloScreenWidth({
        isSelected: true,
        isFavorite: true
      });
      const stroke = calls.find((call) => call.type === "strokeText");

      expect(haloScreenWidthFromCanvas(stroke?.lineWidth ?? Number.NaN, FAR_SCALE)).toBeCloseTo(
        expected
      );
    });
  });

  describe("font / halo screen-space", () => {
    it.each([0.5, 2])("O. globalScale %s の font px が screenFontSize / safeScale と一致する", (globalScale) => {
      const concept = makeConcept("a", SHORT_TITLE);
      const { calls } = paintNode(concept, globalScale);
      const style = getConceptGraphLabelStyle({
        globalScale,
        isSelected: false,
        isFavorite: false
      });
      const safeScale = Math.min(Math.max(globalScale, 0.05), 40);
      const fill = calls.find((call) => call.type === "fillText");
      const fontPx = parseFontPx(fill?.font ?? "");

      expect(fontPx).toBeCloseTo(style.screenFontSize / safeScale);
      expect(fontPx * safeScale).toBeCloseTo(style.screenFontSize);
    });

    it.each([0.5, 2])("P. globalScale %s でも lineWidth × safeScale が halo helper と一致する", (globalScale) => {
      const concept = makeConcept("a", SHORT_TITLE);
      const { calls } = paintNode(concept, globalScale);
      const expected = getConceptGraphLabelHaloScreenWidth({
        isSelected: false,
        isFavorite: false
      });
      const safeScale = Math.min(Math.max(globalScale, 0.05), 40);
      const stroke = calls.find((call) => call.type === "strokeText");

      expect((stroke?.lineWidth ?? Number.NaN) * safeScale).toBeCloseTo(expected);
    });
  });

  describe("異常 scale", () => {
    const expectedClampedScale = (globalScale: number) => {
      const clamped = Math.min(Math.max(globalScale, 0.05), 40);
      return Number.isFinite(clamped) ? clamped : 0.05;
    };

    it.each([
      { name: "0", globalScale: 0 },
      { name: "negative", globalScale: -2 },
      { name: "Infinity", globalScale: Number.POSITIVE_INFINITY },
      { name: "NaN", globalScale: Number.NaN }
    ])("$name では font / lineWidth が有限値になる", ({ globalScale }) => {
      const concept = makeConcept("a", SHORT_TITLE);
      const { calls } = paintNode(concept, globalScale);
      const fill = calls.find((call) => call.type === "fillText");
      const stroke = calls.find((call) => call.type === "strokeText");
      const fontPx = parseFontPx(fill?.font ?? "");
      const style = getConceptGraphLabelStyle({
        globalScale,
        isSelected: false,
        isFavorite: false
      });
      const safeScale = expectedClampedScale(globalScale);

      expect(Number.isFinite(fontPx)).toBe(true);
      expect(Number.isFinite(stroke?.lineWidth ?? Number.NaN)).toBe(true);
      expect(fontPx).toBeCloseTo(style.screenFontSize / safeScale);
      expect((stroke?.lineWidth ?? Number.NaN) * safeScale).toBeCloseTo(
        getConceptGraphLabelHaloScreenWidth({ isSelected: false, isFavorite: false })
      );
    });
  });

  describe("描画順", () => {
    it("node fill / ring stroke の後に label strokeText → fillText が来る", () => {
      const concept = makeConcept("a", SHORT_TITLE);
      const { calls } = paintNode(concept, FAR_SCALE);
      const types = calls.map((call) => call.type);
      const fillIndex = types.indexOf("fill");
      const strokeIndex = types.indexOf("stroke");
      const strokeTextIndex = types.indexOf("strokeText");
      const fillTextIndex = types.indexOf("fillText");

      expect(fillIndex).toBeGreaterThanOrEqual(0);
      expect(strokeIndex).toBeGreaterThan(fillIndex);
      expect(strokeTextIndex).toBeGreaterThan(strokeIndex);
      expect(fillTextIndex).toBeGreaterThan(strokeTextIndex);
    });
  });
});

const makeStats = (
  conceptId: string,
  accuracy: number | null,
  totalAttempts = 10
): ConceptQuizStats => ({
  conceptId,
  totalAttempts,
  correctAttempts: accuracy == null ? 0 : Math.round((accuracy / 100) * totalAttempts),
  wrongAttempts: accuracy == null ? 0 : totalAttempts - Math.round((accuracy / 100) * totalAttempts),
  accuracy,
  lastAnsweredAt: accuracy == null ? null : "2026-01-01T00:00:00.000Z"
});

describe("ConceptGraphView Canvas accuracy mode (#20)", () => {
  beforeEach(() => {
    resetForceGraphMock();
  });

  const paintAccuracyNode = async (
    concept: Concept,
    globalScale: number,
    stats?: ConceptQuizStats
  ) => {
    const map = new Map<string, ConceptQuizStats>();
    if (stats) {
      map.set(concept.id, stats);
    }
    render(
      <ConceptGraphView
        concepts={[concept]}
        domainColorMap={{}}
        onSelectConcept={vi.fn()}
        conceptQuizStatsMap={map}
      />
    );
    await userEvent.setup().click(screen.getByRole("button", { name: "正答率" }));
    const nodeCanvasObject = lastForceGraphProps.nodeCanvasObject;
    const mock = createCanvasContextMock();
    nodeCanvasObject?.({ id: concept.id, x: 100, y: 100 }, mock.context, globalScale);
    return mock;
  };

  it("未学習はグレー塗りと未学習ラベル、0% は別色と 0%", async () => {
    const unlearned = makeConcept("a", SHORT_TITLE);
    const { calls: unlearnedCalls } = await paintAccuracyNode(unlearned, MEDIUM_LABEL_SCALE);
    const unlearnedFill = unlearnedCalls.find((call) => call.type === "fill");
    const unlearnedLabels = conceptLabelCalls(unlearnedCalls).map((call) => call.args[0]);

    expect(unlearnedFill?.fillStyle).toBe(GRAPH_ACCURACY_FILL_UNLEARNED);
    expect(unlearnedLabels).toContain("未学習");
    expect(unlearnedLabels).not.toContain("0%");

    cleanup();
    resetForceGraphMock();
    const zero = makeConcept("b", SHORT_TITLE);
    const { calls: zeroCalls } = await paintAccuracyNode(zero, MEDIUM_LABEL_SCALE, makeStats("b", 0));
    const zeroFill = zeroCalls.find((call) => call.type === "fill");
    const zeroLabels = conceptLabelCalls(zeroCalls).map((call) => call.args[0]);

    expect(zeroFill?.fillStyle).toBe(GRAPH_ACCURACY_FILL_0_25);
    expect(zeroLabels).toContain("0%");
    expect(zeroLabels).not.toContain("未学習");
  });

  it("高正答率は濃い fill とパーセントラベルになる", async () => {
    const concept = makeConcept("a", SHORT_TITLE);
    const { calls } = await paintAccuracyNode(concept, MEDIUM_LABEL_SCALE, makeStats("a", 100));
    const fill = calls.find((call) => call.type === "fill");
    expect(fill?.fillStyle).toBe(GRAPH_ACCURACY_FILL_76_100);
    expect(fill?.fillStyle).toBe(getConceptGraphAccuracyFill(100));
    expect(conceptLabelCalls(calls).map((call) => call.args[0])).toContain("100%");
  });

  it("far では正答率ラベルを省略し、selected では出す", async () => {
    const concept = makeConcept("a", SHORT_TITLE);
    const { calls: farCalls } = await paintAccuracyNode(concept, FAR_SCALE, makeStats("a", 84));
    expect(conceptLabelCalls(farCalls).map((call) => call.args[0])).not.toContain("84%");

    cleanup();
    resetForceGraphMock();
    render(
      <ConceptGraphView
        concepts={[concept]}
        domainColorMap={{}}
        selectedId={concept.id}
        onSelectConcept={vi.fn()}
        conceptQuizStatsMap={new Map([[concept.id, makeStats(concept.id, 84)]])}
      />
    );
    await userEvent.setup().click(screen.getByRole("button", { name: "正答率" }));
    const mock = createCanvasContextMock();
    lastForceGraphProps.nodeCanvasObject?.({ id: concept.id, x: 1, y: 1 }, mock.context, FAR_SCALE);
    expect(conceptLabelCalls(mock.calls).map((call) => call.args[0])).toContain("84%");
  });

  it("正答率モードでもノード半径は通常サイズのまま", async () => {
    const concept = makeConcept("a", SHORT_TITLE);
    const { calls } = await paintAccuracyNode(concept, MEDIUM_LABEL_SCALE, makeStats("a", 50, 100));
    const firstArc = calls.find((call) => call.type === "arc");
    expect(firstArc?.args[2]).toBe(GRAPH_NODE_RADIUS_DEFAULT);
  });
});

describe("ConceptGraphView Canvas confusion overlay (#21)", () => {
  beforeEach(() => {
    resetForceGraphMock();
  });

  const assignNodeCoords = () => {
    const nodes = lastForceGraphProps.graphData?.nodes as { id: string; x?: number; y?: number }[];
    for (const node of nodes ?? []) {
      if (node.id === "a") {
        node.x = 0;
        node.y = 0;
      }
      if (node.id === "b") {
        node.x = 20;
        node.y = 0;
      }
      if (node.id === "c") {
        node.x = 0;
        node.y = 20;
      }
      if (node.id === "d") {
        node.x = 20;
        node.y = 20;
      }
    }
  };

  const collectSegments = (calls: CanvasCall[]) => {
    let move: unknown[] | null = null;
    let line: unknown[] | null = null;
    const segments: {
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      lineWidth: number;
      globalAlpha: number;
    }[] = [];
    for (const call of calls) {
      if (call.type === "moveTo") {
        move = call.args;
      }
      if (call.type === "lineTo") {
        line = call.args;
      }
      if (call.type === "stroke" && move && line) {
        segments.push({
          x1: Number(move[0]),
          y1: Number(move[1]),
          x2: Number(line[0]),
          y2: Number(line[1]),
          lineWidth: call.lineWidth ?? 0,
          globalAlpha: call.globalAlpha ?? 1
        });
      }
    }
    return segments;
  };

  const isSegment = (
    segment: { x1: number; y1: number; x2: number; y2: number },
    ax: number,
    ay: number,
    bx: number,
    by: number
  ) =>
    (segment.x1 === ax && segment.y1 === ay && segment.x2 === bx && segment.y2 === by) ||
    (segment.x1 === bx && segment.y1 === by && segment.x2 === ax && segment.y2 === ay);

  const renderConfusionFixture = () => {
    const a = makeConcept("a", SHORT_TITLE);
    const b = makeConcept("b", "別概念");
    const c = makeConcept("c", "第三");
    const d = makeConcept("d", "第四");
    a.relatedIds = ["b"];
    b.relatedIds = ["a"];
    render(
      <ConceptGraphView
        concepts={[a, b, c, d]}
        domainColorMap={{}}
        onSelectConcept={vi.fn()}
        confusionPairs={[
          { selectedConceptId: "b", correctConceptId: "a", count: 1 },
          { selectedConceptId: "a", correctConceptId: "b", count: 2 },
          { selectedConceptId: "c", correctConceptId: "a", count: 6 },
          { selectedConceptId: "x", correctConceptId: "a", count: 5 },
          { selectedConceptId: "y", correctConceptId: "a", count: 2 },
          { selectedConceptId: "x", correctConceptId: "b", count: 4 },
          { selectedConceptId: "y", correctConceptId: "b", count: 2 },
          { selectedConceptId: "z", correctConceptId: "c", count: 5 },
          { selectedConceptId: "x", correctConceptId: "d", count: 1 }
        ]}
        confusionUniverseIds={["a", "b", "c", "d", "x", "y", "z"]}
      />
    );
    assignNodeCoords();
  };

  it("OFF では混同 overlay を描画しない", async () => {
    renderConfusionFixture();
    const offMock = createCanvasContextMock();
    lastForceGraphProps.onRenderFramePre?.(offMock.context, 1);
    expect(offMock.calls.some((call) => call.type === "moveTo")).toBe(false);
    expect(offMock.calls.some((call) => call.type === "lineTo")).toBe(false);
    expect(offMock.calls.some((call) => call.type === "setLineDash")).toBe(false);
    expect(offMock.calls.some((call) => call.type === "stroke")).toBe(false);
  });

  it("直接混同は save/restore・破線・moveTo/lineTo/stroke し、count 大の線が太い", async () => {
    const user = userEvent.setup();
    renderConfusionFixture();
    await user.click(screen.getByRole("button", { name: "直接混同" }));
    const mock = createCanvasContextMock();
    lastForceGraphProps.onRenderFramePre?.(mock.context, 1);

    expect(mock.calls.some((call) => call.type === "save")).toBe(true);
    expect(mock.calls.some((call) => call.type === "restore")).toBe(true);
    expect(mock.calls.some((call) => call.type === "moveTo")).toBe(true);
    expect(mock.calls.some((call) => call.type === "lineTo")).toBe(true);
    expect(mock.context.strokeStyle).toBe(DIRECT_CONFUSION_STROKE);

    const dash = mock.calls.find((call) => call.type === "setLineDash");
    expect(dash?.args[0]).toEqual([DIRECT_CONFUSION_DASH_LENGTH, DIRECT_CONFUSION_GAP_LENGTH]);

    const segments = collectSegments(mock.calls);
    const ab = segments.find((segment) => isSegment(segment, 0, 0, 20, 0));
    const ac = segments.find((segment) => isSegment(segment, 0, 0, 0, 20));
    expect(ab?.lineWidth).toBe(getDirectConfusionLineWidth(3));
    expect(ac?.lineWidth).toBe(getDirectConfusionLineWidth(6));
    expect(ac?.lineWidth ?? 0).toBeGreaterThan(ab?.lineWidth ?? 0);
  });

  it("混同近傍は点線で、similarity が高いほど lineWidth と opacity が大きい", async () => {
    const user = userEvent.setup();
    renderConfusionFixture();
    await user.click(screen.getByRole("button", { name: "混同近傍" }));
    const mock = createCanvasContextMock();
    lastForceGraphProps.onRenderFramePre?.(mock.context, 1);

    expect(mock.calls.some((call) => call.type === "save")).toBe(true);
    expect(mock.calls.some((call) => call.type === "restore")).toBe(true);
    expect(mock.context.strokeStyle).toBe(KNN_CONFUSION_STROKE);

    const dash = mock.calls.find((call) => call.type === "setLineDash");
    expect(dash?.args[0]).toEqual([KNN_CONFUSION_DASH_LENGTH, KNN_CONFUSION_GAP_LENGTH]);

    const segments = collectSegments(mock.calls);
    const ab = segments.find((segment) => isSegment(segment, 0, 0, 20, 0));
    const ad = segments.find((segment) => isSegment(segment, 0, 0, 20, 20));
    expect(ab).toBeDefined();
    expect(ad).toBeDefined();
    const simAB = cosineSimilaritySparse(
      new Map([
        ["b", 1],
        ["c", 6],
        ["x", 5],
        ["y", 2]
      ]),
      new Map([
        ["a", 2],
        ["x", 4],
        ["y", 2]
      ])
    );
    const simAD = cosineSimilaritySparse(
      new Map([
        ["b", 1],
        ["c", 6],
        ["x", 5],
        ["y", 2]
      ]),
      new Map([["x", 1]])
    );
    expect(ab?.lineWidth).toBe(getConfusionKnnLineWidth(simAB));
    expect(ad?.lineWidth).toBe(getConfusionKnnLineWidth(simAD));
    expect(ab?.globalAlpha).toBe(getConfusionKnnOpacity(simAB));
    expect(ad?.globalAlpha).toBe(getConfusionKnnOpacity(simAD));
  });
});
