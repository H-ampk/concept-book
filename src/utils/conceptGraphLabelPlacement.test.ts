import { describe, expect, it } from "vitest";
import {
  FAR_LABEL_MAX_CHARS,
  LABEL_ELLIPSIS,
  getConceptGraphLabelHaloScreenWidth,
  getConceptGraphLabelStyle,
  getConceptGraphLabelText
} from "./conceptGraphLod";
import {
  getConceptGraphLabelPlacement,
  getConceptGraphLabelScreenBounds,
  getIndependentConceptGraphLabelPlacement,
  getPreferredConceptGraphLabelDirection,
  placeConceptGraphLabels,
  type ConceptGraphLabelLayoutNode
} from "./conceptGraphLabelPlacement";
import { getConceptGraphNodeGeometry } from "./conceptGraphNodeGeometry";
import {
  estimateConceptGraphLabelScreenWidth,
  getConceptGraphOverlapItems
} from "./conceptGraphOverlap";
import type { Concept } from "../types/concept";

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

const layoutNode = (
  partial: Partial<ConceptGraphLabelLayoutNode> & Pick<ConceptGraphLabelLayoutNode, "id" | "nodeX" | "nodeY">
): ConceptGraphLabelLayoutNode => ({
  visualRadius: 6,
  labelOffset: 6,
  textWidth: 40,
  screenFontSize: 9,
  halo: 1.15,
  isSelected: false,
  isFavorite: false,
  ...partial
});

describe("conceptGraphLabelPlacement", () => {
  it("同一 input なら placement が決定的", () => {
    const nodes = [
      layoutNode({ id: "b", nodeX: 40, nodeY: -20, isFavorite: true }),
      layoutNode({ id: "a", nodeX: -10, nodeY: 30, isSelected: true }),
      layoutNode({ id: "c", nodeX: 12, nodeY: 8 })
    ];
    const first = placeConceptGraphLabels(nodes, 1);
    const second = placeConceptGraphLabels(nodes, 1);
    expect([...first.entries()]).toEqual([...second.entries()]);
  });

  it("グラフ中心から外側へ方向を選ぶ", () => {
    expect(getPreferredConceptGraphLabelDirection(0, 80)).toBe("bottom");
    expect(getPreferredConceptGraphLabelDirection(0, -80)).toBe("top");
    expect(getPreferredConceptGraphLabelDirection(80, 0)).toBe("right");
    expect(getPreferredConceptGraphLabelDirection(-80, 0)).toBe("left");
    expect(getPreferredConceptGraphLabelDirection(0, 0)).toBe("bottom");
  });

  it("selected / favorite も placement 対象から消えない", () => {
    const nodes = [
      layoutNode({ id: "sel", nodeX: 10, nodeY: 10, isSelected: true }),
      layoutNode({ id: "fav", nodeX: -10, nodeY: 10, isFavorite: true }),
      layoutNode({ id: "n", nodeX: 0, nodeY: -10 })
    ];
    const placements = placeConceptGraphLabels(nodes, 1);
    expect(placements.get("sel")).toBeDefined();
    expect(placements.get("fav")).toBeDefined();
    expect(placements.get("n")).toBeDefined();
    expect(
      getIndependentConceptGraphLabelPlacement({
        nodeX: 10,
        nodeY: 10,
        labelOffset: 6
      }).direction
    ).toBe(getPreferredConceptGraphLabelDirection(10, 10));
  });

  it("placement は LOD の label text 仕様を変えない", () => {
    const title = "社会的アイデンティティ理論";
    const far = getConceptGraphLabelText({
      title,
      globalScale: 0.79,
      isSelected: false,
      isFavorite: false
    });
    const medium = getConceptGraphLabelText({
      title,
      globalScale: 1,
      isSelected: false,
      isFavorite: false
    });
    expect(far).toBe(`${title.slice(0, FAR_LABEL_MAX_CHARS)}${LABEL_ELLIPSIS}`);
    expect(medium).toBe(title);
    const selectedFar = getConceptGraphLabelText({
      title,
      globalScale: 0.79,
      isSelected: true,
      isFavorite: false
    });
    const favoriteFar = getConceptGraphLabelText({
      title,
      globalScale: 0.79,
      isSelected: false,
      isFavorite: true
    });
    expect(selectedFar).toBe(title);
    expect(favoriteFar).toBe(title);
  });

  it("overlap evaluator の label bounds は placement utility と一致する", () => {
    const concept = makeConcept("a", "AAAAAAAAAAAA");
    const position = { id: "a", x: 20, y: -30 };
    const globalScale = 1;
    const { labels } = getConceptGraphOverlapItems({
      concepts: [concept],
      positions: [position],
      globalScale
    });
    const geometry = getConceptGraphNodeGeometry({
      nodeRadius: 5.2,
      isSelected: false,
      isFavorite: false
    });
    const style = getConceptGraphLabelStyle({
      globalScale,
      isSelected: false,
      isFavorite: false
    });
    const text = getConceptGraphLabelText({
      title: concept.title,
      globalScale,
      isSelected: false,
      isFavorite: false
    });
    const halo = getConceptGraphLabelHaloScreenWidth({
      isSelected: false,
      isFavorite: false
    });
    const layout = layoutNode({
      id: "a",
      nodeX: position.x,
      nodeY: position.y,
      visualRadius: geometry.visualRadius,
      labelOffset: geometry.labelOffset,
      textWidth: estimateConceptGraphLabelScreenWidth(text, style.screenFontSize),
      screenFontSize: style.screenFontSize,
      halo
    });
    const placement = placeConceptGraphLabels([layout], globalScale).get("a");
    expect(placement).toBeDefined();
    const bounds = getConceptGraphLabelScreenBounds({
      id: "a",
      placement: placement!,
      textWidth: layout.textWidth,
      screenFontSize: layout.screenFontSize,
      halo: layout.halo,
      globalScale
    });
    expect(labels[0]).toEqual(bounds);
  });

  it("bottom placement の bounds は従来の直下矩形と一致する", () => {
    const placement = getConceptGraphLabelPlacement({
      nodeX: 10,
      nodeY: 20,
      labelOffset: 6,
      direction: "bottom"
    });
    const bounds = getConceptGraphLabelScreenBounds({
      id: "a",
      placement,
      textWidth: 30,
      screenFontSize: 9,
      halo: 2,
      globalScale: 1
    });
    expect(placement.textAlign).toBe("center");
    expect(placement.textBaseline).toBe("top");
    expect(bounds.left).toBe(10 - 16);
    expect(bounds.top).toBe(20 + 8 - 1);
    expect(bounds.right).toBe(10 + 16);
    expect(bounds.bottom).toBe(bounds.top + 11);
  });
});
