import { describe, expect, it } from "vitest";
import { buildConnectorLines } from "./buildConnectorLines";

describe("buildConnectorLines", () => {
  it("highlight と対応 Concept を SVG 相対座標で結ぶ", () => {
    const lines = buildConnectorLines(
      [{ id: "c1", x: 120, y: 80 }],
      [{ id: "c1", x: 400, y: 100 }],
      { left: 20, top: 10 }
    );
    expect(lines).toEqual([
      { id: "c1-120-80", fromX: 100, fromY: 70, toX: 380, toY: 90 }
    ]);
  });

  it("対応 Concept が無い highlight は線を作らない", () => {
    expect(
      buildConnectorLines([{ id: "missing", x: 0, y: 0 }], [{ id: "c1", x: 10, y: 10 }], {
        left: 0,
        top: 0
      })
    ).toEqual([]);
  });
});
