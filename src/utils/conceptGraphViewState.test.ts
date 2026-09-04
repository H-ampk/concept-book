import { describe, expect, it } from "vitest";
import {
  GRAPH_NODE_PAGE,
  getVisibleGraphNodeCount,
  nextGraphNodeLimit,
  shouldAutoFitConceptGraph
} from "./conceptGraphViewState";

describe("shouldAutoFitConceptGraph", () => {
  it("初回かつ非空なら auto fit する", () => {
    expect(shouldAutoFitConceptGraph(false, 12)).toBe(true);
  });

  it("0 nodes では auto fit しない", () => {
    expect(shouldAutoFitConceptGraph(false, 0)).toBe(false);
  });

  it("auto fit 済みなら再実行しない", () => {
    expect(shouldAutoFitConceptGraph(true, 12)).toBe(false);
  });
});

describe("getVisibleGraphNodeCount", () => {
  it("limit と件数の小さい方を実表示にする", () => {
    expect(getVisibleGraphNodeCount(200, 1000)).toBe(200);
    expect(getVisibleGraphNodeCount(200, 1)).toBe(1);
    expect(getVisibleGraphNodeCount(400, 0)).toBe(0);
    expect(getVisibleGraphNodeCount(400, 1000)).toBe(400);
  });
});

describe("nextGraphNodeLimit", () => {
  it("200件単位で増やし、件数を超えない", () => {
    expect(nextGraphNodeLimit(200, 1000)).toBe(400);
    expect(nextGraphNodeLimit(400, 1000)).toBe(600);
    expect(nextGraphNodeLimit(900, 1000)).toBe(1000);
    expect(nextGraphNodeLimit(GRAPH_NODE_PAGE, 50)).toBe(50);
  });
});
