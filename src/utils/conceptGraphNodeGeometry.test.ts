import { describe, expect, it } from "vitest";
import {
  getConceptGraphNodeGeometry,
  GRAPH_DOMAIN_RING_WIDTH,
  GRAPH_FAVORITE_OUTER_LINE_WIDTH,
  GRAPH_OUTER_RING_GAP,
  GRAPH_SELECTED_OUTER_LINE_WIDTH
} from "./conceptGraphNodeGeometry";

describe("getConceptGraphNodeGeometry", () => {
  it("通常ノードは domain ring 外縁を visualRadius / labelOffset にする", () => {
    const geometry = getConceptGraphNodeGeometry({
      nodeRadius: 5.2,
      isSelected: false,
      isFavorite: false
    });

    expect(geometry.domainRadius).toBe(5.2 + GRAPH_DOMAIN_RING_WIDTH / 2);
    expect(geometry.visualRadius).toBe(geometry.domainRadius + GRAPH_DOMAIN_RING_WIDTH / 2);
    expect(geometry.labelOffset).toBe(geometry.visualRadius);
    expect(geometry.outerLineWidth).toBe(GRAPH_FAVORITE_OUTER_LINE_WIDTH);
  });

  it("selected は outer ring を visualRadius に含める", () => {
    const geometry = getConceptGraphNodeGeometry({
      nodeRadius: 5.2,
      isSelected: true,
      isFavorite: false
    });
    const expectedOuter =
      geometry.domainRadius + GRAPH_DOMAIN_RING_WIDTH / 2 + GRAPH_OUTER_RING_GAP;

    expect(geometry.outerRadius).toBe(expectedOuter);
    expect(geometry.outerLineWidth).toBe(GRAPH_SELECTED_OUTER_LINE_WIDTH);
    expect(geometry.visualRadius).toBe(expectedOuter + GRAPH_SELECTED_OUTER_LINE_WIDTH / 2);
    expect(geometry.labelOffset).toBe(geometry.visualRadius);
  });

  it("favorite は selected より細い outer ring を visualRadius に含める", () => {
    const geometry = getConceptGraphNodeGeometry({
      nodeRadius: 6.8,
      isSelected: false,
      isFavorite: true
    });

    expect(geometry.outerLineWidth).toBe(GRAPH_FAVORITE_OUTER_LINE_WIDTH);
    expect(geometry.visualRadius).toBe(geometry.outerRadius + GRAPH_FAVORITE_OUTER_LINE_WIDTH / 2);
  });
});
