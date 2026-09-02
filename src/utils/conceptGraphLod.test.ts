import { describe, expect, it } from "vitest";
import {
  FULL_LABEL_SCALE,
  MEDIUM_LABEL_SCALE,
  SMALL_GRAPH_NODE_COUNT,
  shouldShowConceptGraphLabel
} from "./conceptGraphLod";

const LARGE_GRAPH = SMALL_GRAPH_NODE_COUNT + 1;

describe("shouldShowConceptGraphLabel", () => {
  it("40ノード以下はズームアウトしても通常ラベルを表示する", () => {
    expect(
      shouldShowConceptGraphLabel({
        globalScale: 0.1,
        nodeCount: SMALL_GRAPH_NODE_COUNT,
        isSelected: false,
        isFavorite: false
      })
    ).toBe(true);
  });

  it("ノード数40はsmall graph、41はLOD対象", () => {
    const farScale = MEDIUM_LABEL_SCALE - 0.01;
    expect(
      shouldShowConceptGraphLabel({
        globalScale: farScale,
        nodeCount: 40,
        isSelected: false,
        isFavorite: false
      })
    ).toBe(true);
    expect(
      shouldShowConceptGraphLabel({
        globalScale: farScale,
        nodeCount: 41,
        isSelected: false,
        isFavorite: false
      })
    ).toBe(false);
  });

  describe("far (globalScale < 0.8)", () => {
    const globalScale = MEDIUM_LABEL_SCALE - 0.0001;

    it("通常Conceptは非表示", () => {
      expect(
        shouldShowConceptGraphLabel({
          globalScale,
          nodeCount: LARGE_GRAPH,
          isSelected: false,
          isFavorite: false
        })
      ).toBe(false);
    });

    it("お気に入りConceptも非表示", () => {
      expect(
        shouldShowConceptGraphLabel({
          globalScale,
          nodeCount: LARGE_GRAPH,
          isSelected: false,
          isFavorite: true
        })
      ).toBe(false);
    });

    it("選択Conceptは表示", () => {
      expect(
        shouldShowConceptGraphLabel({
          globalScale,
          nodeCount: LARGE_GRAPH,
          isSelected: true,
          isFavorite: false
        })
      ).toBe(true);
    });
  });

  describe("medium (0.8 <= globalScale < 1.5)", () => {
    const globalScale = MEDIUM_LABEL_SCALE;

    it("通常Conceptは非表示", () => {
      expect(
        shouldShowConceptGraphLabel({
          globalScale,
          nodeCount: LARGE_GRAPH,
          isSelected: false,
          isFavorite: false
        })
      ).toBe(false);
    });

    it("お気に入りConceptは表示", () => {
      expect(
        shouldShowConceptGraphLabel({
          globalScale,
          nodeCount: LARGE_GRAPH,
          isSelected: false,
          isFavorite: true
        })
      ).toBe(true);
    });

    it("選択Conceptは表示", () => {
      expect(
        shouldShowConceptGraphLabel({
          globalScale,
          nodeCount: LARGE_GRAPH,
          isSelected: true,
          isFavorite: false
        })
      ).toBe(true);
    });
  });

  describe("near (globalScale >= 1.5)", () => {
    const globalScale = FULL_LABEL_SCALE;

    it("通常Conceptは表示", () => {
      expect(
        shouldShowConceptGraphLabel({
          globalScale,
          nodeCount: LARGE_GRAPH,
          isSelected: false,
          isFavorite: false
        })
      ).toBe(true);
    });

    it("お気に入りConceptは表示", () => {
      expect(
        shouldShowConceptGraphLabel({
          globalScale,
          nodeCount: LARGE_GRAPH,
          isSelected: false,
          isFavorite: true
        })
      ).toBe(true);
    });

    it("選択Conceptは表示", () => {
      expect(
        shouldShowConceptGraphLabel({
          globalScale,
          nodeCount: LARGE_GRAPH,
          isSelected: true,
          isFavorite: false
        })
      ).toBe(true);
    });
  });

  describe("境界値", () => {
    it("0.8 は medium（通常は非表示、お気に入りは表示）", () => {
      expect(
        shouldShowConceptGraphLabel({
          globalScale: 0.8,
          nodeCount: LARGE_GRAPH,
          isSelected: false,
          isFavorite: false
        })
      ).toBe(false);
      expect(
        shouldShowConceptGraphLabel({
          globalScale: 0.8,
          nodeCount: LARGE_GRAPH,
          isSelected: false,
          isFavorite: true
        })
      ).toBe(true);
    });

    it("1.5 は near（通常も表示）", () => {
      expect(
        shouldShowConceptGraphLabel({
          globalScale: 1.5,
          nodeCount: LARGE_GRAPH,
          isSelected: false,
          isFavorite: false
        })
      ).toBe(true);
    });

    it("medium 上限直前は通常ラベルを出さない", () => {
      expect(
        shouldShowConceptGraphLabel({
          globalScale: FULL_LABEL_SCALE - 0.0001,
          nodeCount: LARGE_GRAPH,
          isSelected: false,
          isFavorite: false
        })
      ).toBe(false);
    });
  });

  it("選択中はノード数・倍率に関係なく常に表示する", () => {
    expect(
      shouldShowConceptGraphLabel({
        globalScale: 0.01,
        nodeCount: 10_000,
        isSelected: true,
        isFavorite: false
      })
    ).toBe(true);
  });
});
