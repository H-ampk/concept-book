import { describe, expect, it } from "vitest";
import {
  buildConfusionKnnEdges,
  buildConfusionProfiles,
  buildDirectConfusionEdges,
  cosineSimilaritySparse,
  DEFAULT_CONFUSION_K,
  DIRECT_CONFUSION_LINE_WIDTH_MAX,
  DIRECT_CONFUSION_LINE_WIDTH_MIN,
  getDirectConfusionLineWidth,
  type DirectConfusionEdge
} from "./conceptGraphConfusion";
import type { ConfusionPairStat } from "./quizStats";

const pair = (
  selectedConceptId: string | null,
  correctConceptId: string | null,
  count: number
): ConfusionPairStat => ({ selectedConceptId, correctConceptId, count });

const profile = (entries: [string, number][]): Map<string, number> => new Map(entries);

describe("buildDirectConfusionEdges", () => {
  it("通常ペアを無向エッジにする", () => {
    const input = [pair("B", "A", 2)];
    const valid = new Set(["A", "B"]);
    expect(buildDirectConfusionEdges(input, valid)).toEqual<DirectConfusionEdge[]>([
      { source: "A", target: "B", count: 2 }
    ]);
    expect(input[0]).toEqual(pair("B", "A", 2));
  });

  it("逆方向を統合して count を合計する", () => {
    expect(
      buildDirectConfusionEdges([pair("A", "B", 2), pair("B", "A", 3)], new Set(["A", "B"]))
    ).toEqual([{ source: "A", target: "B", count: 5 }]);
  });

  it("方向付き stat の confusionCount も合算できる", () => {
    expect(
      buildDirectConfusionEdges(
        [
          { selectedConceptId: "B", correctConceptId: "A", confusionCount: 2 },
          { selectedConceptId: "A", correctConceptId: "B", confusionCount: 3 }
        ],
        new Set(["A", "B"])
      )
    ).toEqual([{ source: "A", target: "B", count: 5 }]);
  });

  it("null ID のペアは除外する", () => {
    expect(
      buildDirectConfusionEdges(
        [pair(null, "B", 1), pair("A", null, 4), pair("A", "B", 1)],
        new Set(["A", "B"])
      )
    ).toEqual([{ source: "A", target: "B", count: 1 }]);
  });

  it("削除済み ID を除外する", () => {
    expect(
      buildDirectConfusionEdges(
        [pair("A", "C", 2), pair("A", "B", 1)],
        new Set(["A", "B"])
      )
    ).toEqual([{ source: "A", target: "B", count: 1 }]);
  });

  it("self loop は除外する", () => {
    expect(
      buildDirectConfusionEdges([pair("A", "A", 3), pair("A", "B", 1)], new Set(["A", "B"]))
    ).toEqual([{ source: "A", target: "B", count: 1 }]);
  });

  it("source / target は lexical に決定的である", () => {
    const edges = buildDirectConfusionEdges(
      [pair("z", "m", 1), pair("a", "c", 1)],
      new Set(["a", "c", "m", "z"])
    );
    expect(edges.map((edge) => `${edge.source}-${edge.target}`)).toEqual(["a-c", "m-z"]);
  });
});

describe("getDirectConfusionLineWidth", () => {
  it("count が増えるほど線幅が小さくならない", () => {
    const widths = [1, 2, 3, 4, 7, 8, 100].map(getDirectConfusionLineWidth);
    for (let i = 1; i < widths.length; i += 1) {
      expect(widths[i]).toBeGreaterThanOrEqual(widths[i - 1]!);
    }
    expect(getDirectConfusionLineWidth(2)).toBeGreaterThan(getDirectConfusionLineWidth(1));
    expect(getDirectConfusionLineWidth(8)).toBeGreaterThan(getDirectConfusionLineWidth(3));
  });

  it("極端に大きい count でも上限を超えない", () => {
    expect(getDirectConfusionLineWidth(1)).toBeGreaterThanOrEqual(DIRECT_CONFUSION_LINE_WIDTH_MIN);
    expect(getDirectConfusionLineWidth(1_000_000)).toBeLessThanOrEqual(
      DIRECT_CONFUSION_LINE_WIDTH_MAX
    );
    expect(getDirectConfusionLineWidth(1_000_000)).toBe(DIRECT_CONFUSION_LINE_WIDTH_MAX);
  });
});

describe("buildConfusionProfiles", () => {
  it("correct を行、selected を列にした疎ベクトルを作る", () => {
    const profiles = buildConfusionProfiles(
      [pair("B", "A", 5), pair("C", "A", 2), pair("B", "D", 1)],
      new Set(["A", "B", "C", "D"])
    );
    expect(Object.fromEntries(profiles.get("A") ?? [])).toEqual({ B: 5, C: 2 });
    expect(Object.fromEntries(profiles.get("D") ?? [])).toEqual({ B: 1 });
    expect(profiles.has("B")).toBe(false);
  });

  it("null・削除済み・self を除外する", () => {
    const profiles = buildConfusionProfiles(
      [
        pair(null, "A", 1),
        pair("B", null, 1),
        pair("gone", "A", 2),
        pair("A", "A", 9),
        pair("B", "A", 1)
      ],
      new Set(["A", "B"])
    );
    expect(Object.fromEntries(profiles.get("A") ?? [])).toEqual({ B: 1 });
  });
});

describe("cosineSimilaritySparse", () => {
  it("同一ベクトルは 1", () => {
    expect(cosineSimilaritySparse(profile([["X", 2], ["Y", 1]]), profile([["X", 2], ["Y", 1]]))).toBe(
      1
    );
  });

  it("直交ベクトルは 0", () => {
    expect(cosineSimilaritySparse(profile([["X", 2]]), profile([["Y", 2]]))).toBe(0);
  });

  it("空ベクトルを含む場合は 0 で NaN を返さない", () => {
    expect(cosineSimilaritySparse(new Map(), profile([["X", 1]]))).toBe(0);
    expect(cosineSimilaritySparse(profile([["X", 1]]), new Map())).toBe(0);
    expect(Number.isNaN(cosineSimilaritySparse(new Map(), new Map()))).toBe(false);
  });
});

describe("buildConfusionKnnEdges", () => {
  const profiles = new Map<string, Map<string, number>>([
    ["A", profile([["X", 10], ["Y", 5]])],
    ["B", profile([["X", 8], ["Y", 4]])],
    ["C", profile([["Z", 10]])],
    ["D", profile([["X", 1]])]
  ]);

  it("誤答パターンが近い A-B が近傍になる", () => {
    const edges = buildConfusionKnnEdges(profiles, { k: DEFAULT_CONFUSION_K });
    const ab = edges.find((edge) => edge.source === "A" && edge.target === "B");
    expect(ab).toBeDefined();
    expect(ab?.similarity).toBeGreaterThan(0.9);
    expect(edges.some((edge) => edge.source === "A" && edge.target === "C")).toBe(false);
  });

  it("k=1 では A の最近傍として A-B が残る", () => {
    const edges = buildConfusionKnnEdges(profiles, { k: 1 });
    expect(edges.some((edge) => edge.source === "A" && edge.target === "B")).toBe(true);
    expect(edges.some((edge) => edge.source === "A" && edge.target === "C")).toBe(false);
  });

  it("similarity 0 は採用しない", () => {
    const edges = buildConfusionKnnEdges(profiles, { k: 3 });
    expect(edges.every((edge) => edge.similarity > 0)).toBe(true);
    expect(edges.some((edge) => edge.source === "C" && edge.target === "A")).toBe(false);
  });

  it("A→B と B→A を1本の無向辺にする", () => {
    const edges = buildConfusionKnnEdges(profiles, { k: 3 });
    const ab = edges.filter(
      (edge) =>
        (edge.source === "A" && edge.target === "B") ||
        (edge.source === "B" && edge.target === "A")
    );
    expect(ab).toHaveLength(1);
  });

  it("空 profile の多数 Concept を総当たりしない", () => {
    const large = new Map<string, Map<string, number>>();
    for (let i = 0; i < 4000; i += 1) {
      large.set(`empty-${i}`, new Map());
    }
    large.set("A", profile([["X", 10], ["Y", 5]]));
    large.set("B", profile([["X", 8], ["Y", 4]]));
    const started = performance.now();
    const edges = buildConfusionKnnEdges(large, { k: 3 });
    const elapsed = performance.now() - started;
    expect(edges).toEqual([
      expect.objectContaining({ source: "A", target: "B" })
    ]);
    expect(elapsed).toBeLessThan(200);
  });
});
