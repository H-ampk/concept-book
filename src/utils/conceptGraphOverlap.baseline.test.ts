import { describe, expect, it } from "vitest";
import { layoutConceptGraphDeterministically } from "./conceptGraphLayout";
import {
  getConceptGraphOverlapMetrics,
  normalizeOverlapFixtureFlags,
  type ConceptGraphOverlapMetrics
} from "./conceptGraphOverlap";
import {
  createGraphTestConcepts,
  GRAPH_TEST_DEFAULT_AVERAGE_RELATIONS,
  GRAPH_TEST_DEFAULT_SEED
} from "./conceptGraphTestData";

export const OVERLAP_FAR_SCALE = 0.79;
export const OVERLAP_MEDIUM_SCALE = 1;

type FixtureKind = "small" | "medium" | "initial200";

const FIXTURE_COUNTS: Record<FixtureKind, number> = {
  small: 15,
  medium: 50,
  initial200: 200
};

const REPEAT_COUNT = 8;

/**
 * current main を 8 回実測し、完全一致した値。
 * 将来の微小差用に小さな tolerance を明示する（実測のばらつきは 0）。
 */
const BASELINE: Record<
  FixtureKind,
  Record<"far" | "medium", ConceptGraphOverlapMetrics>
> = {
  small: {
    far: {
      nodeNodeOverlapCount: 0,
      labelNodeOverlapCount: 0,
      labelLabelOverlapCount: 3,
      totalOverlapCount: 3
    },
    medium: {
      nodeNodeOverlapCount: 0,
      labelNodeOverlapCount: 4,
      labelLabelOverlapCount: 5,
      totalOverlapCount: 9
    }
  },
  medium: {
    far: {
      nodeNodeOverlapCount: 0,
      labelNodeOverlapCount: 5,
      labelLabelOverlapCount: 1,
      totalOverlapCount: 6
    },
    medium: {
      nodeNodeOverlapCount: 0,
      labelNodeOverlapCount: 9,
      labelLabelOverlapCount: 7,
      totalOverlapCount: 16
    }
  },
  initial200: {
    far: {
      nodeNodeOverlapCount: 0,
      labelNodeOverlapCount: 33,
      labelLabelOverlapCount: 22,
      totalOverlapCount: 55
    },
    medium: {
      nodeNodeOverlapCount: 0,
      labelNodeOverlapCount: 79,
      labelLabelOverlapCount: 56,
      totalOverlapCount: 135
    }
  }
};

export const OVERLAP_TOLERANCE = {
  nodeNodeOverlapCount: 1,
  labelNodeOverlapCount: 2,
  labelLabelOverlapCount: 3
} as const;

const createFixture = (kind: FixtureKind) => {
  const generated = createGraphTestConcepts({
    conceptCount: FIXTURE_COUNTS[kind],
    averageRelations: GRAPH_TEST_DEFAULT_AVERAGE_RELATIONS,
    seed: GRAPH_TEST_DEFAULT_SEED
  });
  const selectedId = generated[0]?.id;
  const favoriteId = generated[1]?.id ?? generated[0]?.id ?? "";
  const concepts = normalizeOverlapFixtureFlags(generated, favoriteId);
  return { concepts, selectedId };
};

const expectWithinBaseline = (
  actual: ConceptGraphOverlapMetrics,
  baseline: ConceptGraphOverlapMetrics
) => {
  expect(actual.nodeNodeOverlapCount).toBeLessThanOrEqual(
    baseline.nodeNodeOverlapCount + OVERLAP_TOLERANCE.nodeNodeOverlapCount
  );
  expect(actual.labelNodeOverlapCount).toBeLessThanOrEqual(
    baseline.labelNodeOverlapCount + OVERLAP_TOLERANCE.labelNodeOverlapCount
  );
  expect(actual.labelLabelOverlapCount).toBeLessThanOrEqual(
    baseline.labelLabelOverlapCount + OVERLAP_TOLERANCE.labelLabelOverlapCount
  );
};

describe("concept graph overlap baseline", () => {
  it.each(["small", "medium", "initial200"] as const)(
    "%s fixture は 8 回同値で、current main baseline を超えない",
    (kind) => {
      const samples = Array.from({ length: REPEAT_COUNT }, () => {
        const { concepts, selectedId } = createFixture(kind);
        const positions = layoutConceptGraphDeterministically(concepts);
        return {
          far: getConceptGraphOverlapMetrics({
            concepts,
            positions,
            globalScale: OVERLAP_FAR_SCALE,
            selectedId
          }),
          medium: getConceptGraphOverlapMetrics({
            concepts,
            positions,
            globalScale: OVERLAP_MEDIUM_SCALE,
            selectedId
          })
        };
      });
      for (const sample of samples) {
        expect(sample).toEqual(samples[0]);
      }
      expectWithinBaseline(samples[0].far, BASELINE[kind].far);
      expectWithinBaseline(samples[0].medium, BASELINE[kind].medium);
    }
  );
});
