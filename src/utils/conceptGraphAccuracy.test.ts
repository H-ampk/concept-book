import { describe, expect, it } from "vitest";
import {
  getConceptGraphAccuracyBand,
  getConceptGraphAccuracyFill,
  getConceptGraphAccuracyLabel,
  GRAPH_ACCURACY_FILL_0_25,
  GRAPH_ACCURACY_FILL_76_100,
  GRAPH_ACCURACY_FILL_UNLEARNED
} from "./conceptGraphAccuracy";

describe("getConceptGraphAccuracyBand", () => {
  it("未学習は stats 欠損・null・非有限値", () => {
    expect(getConceptGraphAccuracyBand(null)).toBe("unlearned");
    expect(getConceptGraphAccuracyBand(undefined)).toBe("unlearned");
    expect(getConceptGraphAccuracyBand(Number.NaN)).toBe("unlearned");
    expect(getConceptGraphAccuracyBand(Number.POSITIVE_INFINITY)).toBe("unlearned");
  });

  it("境界値が期待する区分になる", () => {
    expect(getConceptGraphAccuracyBand(0)).toBe("0-25");
    expect(getConceptGraphAccuracyBand(25)).toBe("0-25");
    expect(getConceptGraphAccuracyBand(26)).toBe("26-50");
    expect(getConceptGraphAccuracyBand(50)).toBe("26-50");
    expect(getConceptGraphAccuracyBand(51)).toBe("51-75");
    expect(getConceptGraphAccuracyBand(75)).toBe("51-75");
    expect(getConceptGraphAccuracyBand(76)).toBe("76-100");
    expect(getConceptGraphAccuracyBand(100)).toBe("76-100");
  });

  it("未学習と 0% は異なる区分になる", () => {
    expect(getConceptGraphAccuracyBand(null)).not.toBe(getConceptGraphAccuracyBand(0));
  });
});

describe("getConceptGraphAccuracyFill", () => {
  it("未学習と 0% は異なる塗り色になる", () => {
    expect(getConceptGraphAccuracyFill(null)).toBe(GRAPH_ACCURACY_FILL_UNLEARNED);
    expect(getConceptGraphAccuracyFill(0)).toBe(GRAPH_ACCURACY_FILL_0_25);
    expect(getConceptGraphAccuracyFill(null)).not.toBe(getConceptGraphAccuracyFill(0));
  });

  it("正答率が高いほど濃い青灰色になる", () => {
    expect(getConceptGraphAccuracyFill(100)).toBe(GRAPH_ACCURACY_FILL_76_100);
    expect(getConceptGraphAccuracyFill(0)).not.toBe(getConceptGraphAccuracyFill(100));
  });
});

describe("getConceptGraphAccuracyLabel", () => {
  it("null は未学習、0 は 0%、学習済みはパーセント", () => {
    expect(getConceptGraphAccuracyLabel(null)).toBe("未学習");
    expect(getConceptGraphAccuracyLabel(0)).toBe("0%");
    expect(getConceptGraphAccuracyLabel(84)).toBe("84%");
    expect(getConceptGraphAccuracyLabel(100)).toBe("100%");
  });
});
