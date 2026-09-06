import { describe, expect, it } from "vitest";
import type { Concept } from "../types/concept";
import { FAR_LABEL_MAX_CHARS, LABEL_ELLIPSIS, MEDIUM_LABEL_SCALE } from "./conceptGraphLod";
import { layoutConceptGraphDeterministically } from "./conceptGraphLayout";
import {
  estimateConceptGraphLabelScreenWidth,
  getConceptGraphOverlapItems,
  getConceptGraphOverlapMetrics,
  normalizeOverlapFixtureFlags
} from "./conceptGraphOverlap";
import { createGraphTestConcepts } from "./conceptGraphTestData";

const FAR_SCALE = 0.79;
const MEDIUM_SCALE = 1;

const makeConcept = (
  id: string,
  title: string,
  flags?: { favorite?: boolean; relatedIds?: string[] }
): Concept => ({
  id,
  title,
  definition: "d",
  myInterpretation: "",
  domainTags: ["人工知能"],
  researchTags: [],
  relatedIds: flags?.relatedIds ?? [],
  source: { book: "", page: "", author: null },
  notes: "",
  status: "active",
  favorite: flags?.favorite ?? false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
});

const LONG_TITLE = "社会的アイデンティティ理論";

describe("getConceptGraphOverlapMetrics 固定座標", () => {
  it("node-node が重なる", () => {
    const concepts = [makeConcept("a", "A"), makeConcept("b", "B")];
    const metrics = getConceptGraphOverlapMetrics({
      concepts,
      positions: [
        { id: "a", x: 0, y: 0 },
        { id: "b", x: 1, y: 0 }
      ],
      globalScale: MEDIUM_SCALE
    });
    expect(metrics.nodeNodeOverlapCount).toBe(1);
  });

  it("node-node が重ならない", () => {
    const concepts = [makeConcept("a", "A"), makeConcept("b", "B")];
    const metrics = getConceptGraphOverlapMetrics({
      concepts,
      positions: [
        { id: "a", x: 0, y: 0 },
        { id: "b", x: 80, y: 0 }
      ],
      globalScale: MEDIUM_SCALE
    });
    expect(metrics.nodeNodeOverlapCount).toBe(0);
  });

  it("label-node が重なる", () => {
    const concepts = [makeConcept("a", "AAAAAAAAAAAA"), makeConcept("b", "B")];
    const metrics = getConceptGraphOverlapMetrics({
      concepts,
      positions: [
        { id: "a", x: 0, y: 0 },
        { id: "b", x: 0, y: 18 }
      ],
      globalScale: MEDIUM_SCALE
    });
    expect(metrics.labelNodeOverlapCount).toBeGreaterThan(0);
  });

  it("自分自身の label-node を除外する", () => {
    const concepts = [makeConcept("a", "A")];
    const metrics = getConceptGraphOverlapMetrics({
      concepts,
      positions: [{ id: "a", x: 0, y: 0 }],
      globalScale: MEDIUM_SCALE
    });
    expect(metrics.labelNodeOverlapCount).toBe(0);
    expect(metrics.nodeNodeOverlapCount).toBe(0);
    expect(metrics.labelLabelOverlapCount).toBe(0);
  });

  it("label-label が重なる", () => {
    const concepts = [makeConcept("a", "AAAAAAAAAAAA"), makeConcept("b", "BBBBBBBBBBBB")];
    const metrics = getConceptGraphOverlapMetrics({
      concepts,
      positions: [
        { id: "a", x: 0, y: 0 },
        { id: "b", x: 4, y: 0 }
      ],
      globalScale: MEDIUM_SCALE
    });
    expect(metrics.labelLabelOverlapCount).toBe(1);
  });

  it("far 長文が短縮される", () => {
    const concepts = [makeConcept("a", LONG_TITLE)];
    const { labels } = getConceptGraphOverlapItems({
      concepts,
      positions: [{ id: "a", x: 0, y: 0 }],
      globalScale: FAR_SCALE
    });
    const truncated = `${LONG_TITLE.slice(0, FAR_LABEL_MAX_CHARS)}${LABEL_ELLIPSIS}`;
    const expectedWidth = estimateConceptGraphLabelScreenWidth(truncated, 7);
    const actualWidth = labels[0].right - labels[0].left;
    expect(actualWidth).toBeLessThan(
      estimateConceptGraphLabelScreenWidth(LONG_TITLE, 7) + 2
    );
    expect(actualWidth).toBeGreaterThan(expectedWidth);
  });

  it("selected は far でも全文", () => {
    const concepts = [makeConcept("a", LONG_TITLE), makeConcept("b", "B")];
    const selected = getConceptGraphOverlapItems({
      concepts,
      positions: [
        { id: "a", x: 0, y: 0 },
        { id: "b", x: 200, y: 0 }
      ],
      globalScale: FAR_SCALE,
      selectedId: "a"
    });
    const normal = getConceptGraphOverlapItems({
      concepts: [makeConcept("a", LONG_TITLE)],
      positions: [{ id: "a", x: 0, y: 0 }],
      globalScale: FAR_SCALE
    });
    const selectedWidth = selected.labels[0].right - selected.labels[0].left;
    const normalWidth = normal.labels[0].right - normal.labels[0].left;
    expect(selectedWidth).toBeGreaterThan(normalWidth);
  });

  it("favorite は far でも全文", () => {
    const concepts = [makeConcept("a", LONG_TITLE, { favorite: true })];
    const favorite = getConceptGraphOverlapItems({
      concepts,
      positions: [{ id: "a", x: 0, y: 0 }],
      globalScale: FAR_SCALE
    });
    const normal = getConceptGraphOverlapItems({
      concepts: [makeConcept("a", LONG_TITLE)],
      positions: [{ id: "a", x: 0, y: 0 }],
      globalScale: FAR_SCALE
    });
    expect(favorite.labels[0].right - favorite.labels[0].left).toBeGreaterThan(
      normal.labels[0].right - normal.labels[0].left
    );
  });
});

describe("overlap metric は悪化を検出できる", () => {
  it("同一点付近の bad layout は node-node / label-node / label-label が増える", () => {
    const concepts = [
      makeConcept("a", LONG_TITLE),
      makeConcept("b", LONG_TITLE),
      makeConcept("c", LONG_TITLE)
    ];
    const good = getConceptGraphOverlapMetrics({
      concepts,
      positions: [
        { id: "a", x: 0, y: 0 },
        { id: "b", x: 120, y: 0 },
        { id: "c", x: 0, y: 120 }
      ],
      globalScale: MEDIUM_SCALE
    });
    const bad = getConceptGraphOverlapMetrics({
      concepts,
      positions: [
        { id: "a", x: 0, y: 0 },
        { id: "b", x: 0.4, y: 0.2 },
        { id: "c", x: 0, y: 11 }
      ],
      globalScale: MEDIUM_SCALE
    });

    expect(bad.nodeNodeOverlapCount).toBeGreaterThan(good.nodeNodeOverlapCount);
    expect(bad.labelNodeOverlapCount).toBeGreaterThan(good.labelNodeOverlapCount);
    expect(bad.labelLabelOverlapCount).toBeGreaterThan(good.labelLabelOverlapCount);
  });
});

describe("layoutConceptGraphDeterministically", () => {
  it("同じ fixture を複数回実行しても座標が一致する", () => {
    const concepts = createGraphTestConcepts({ conceptCount: 20, seed: 103, averageRelations: 4 });
    const first = layoutConceptGraphDeterministically(concepts);
    const second = layoutConceptGraphDeterministically(concepts);
    expect(first).toEqual(second);
    expect(first.every((node) => Number.isFinite(node.x) && Number.isFinite(node.y))).toBe(true);
  });
});

describe("normalizeOverlapFixtureFlags", () => {
  it("favorite を1件に正規化する", () => {
    const concepts = createGraphTestConcepts({ conceptCount: 20, seed: 103 });
    const favoriteId = concepts[1]?.id ?? "";
    const normalized = normalizeOverlapFixtureFlags(concepts, favoriteId);
    expect(normalized.filter((concept) => concept.favorite)).toHaveLength(1);
    expect(normalized.find((concept) => concept.favorite)?.id).toBe(favoriteId);
  });
});

describe("MEDIUM_LABEL_SCALE との対応", () => {
  it("far 代表値 0.79 は medium 未満である", () => {
    expect(FAR_SCALE).toBeLessThan(MEDIUM_LABEL_SCALE);
  });
});
