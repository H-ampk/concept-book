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
 * Issue #144 時点（直下中央揃え）と Issue #151 改善後の実測。
 * 8 回評価で完全一致。将来の微小差用に小さな tolerance を明示する（実測のばらつきは 0）。
 */
const BASELINE: Record<
  FixtureKind,
  Record<"far" | "medium", ConceptGraphOverlapMetrics>
> = {
  small: {
    far: {
      nodeNodeOverlapCount: 0,
      labelNodeOverlapCount: 0,
      labelLabelOverlapCount: 0,
      totalOverlapCount: 0
    },
    medium: {
      nodeNodeOverlapCount: 0,
      labelNodeOverlapCount: 0,
      labelLabelOverlapCount: 0,
      totalOverlapCount: 0
    }
  },
  medium: {
    far: {
      nodeNodeOverlapCount: 0,
      labelNodeOverlapCount: 0,
      labelLabelOverlapCount: 0,
      totalOverlapCount: 0
    },
    medium: {
      nodeNodeOverlapCount: 0,
      labelNodeOverlapCount: 0,
      labelLabelOverlapCount: 0,
      totalOverlapCount: 0
    }
  },
  initial200: {
    far: {
      nodeNodeOverlapCount: 0,
      labelNodeOverlapCount: 0,
      labelLabelOverlapCount: 0,
      totalOverlapCount: 0
    },
    medium: {
      nodeNodeOverlapCount: 0,
      labelNodeOverlapCount: 5,
      labelLabelOverlapCount: 2,
      totalOverlapCount: 7
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
    "%s fixture は 8 回同値で、Issue #151 baseline を超えない",
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
