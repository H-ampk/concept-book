import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { DataLabAggregateRow } from "../../utils/dataLab/aggregateDataLabLogs";
import { DATA_LAB_EMPTY_LEARNING_MODEL_METRICS } from "../../utils/dataLab/aggregateDataLabLogs";
import { ResearchAnalysisSnapshotTable } from "./ResearchAnalysisSnapshotTable";

const conceptRow = (overrides: Partial<DataLabAggregateRow>): DataLabAggregateRow => ({
  groupBy: "concept",
  key: "k",
  label: "label",
  attemptCount: 1,
  correctCount: 1,
  incorrectCount: 0,
  accuracy: 1,
  averageResponseTimeMs: 1000,
  firstAttemptAt: null,
  lastAttemptAt: null,
  ...DATA_LAB_EMPTY_LEARNING_MODEL_METRICS,
  ...overrides
});

describe("ResearchAnalysisSnapshotTable", () => {
  it("legacy の削除済みConcept label に conceptId を補完して区別する", () => {
    const rows = [
      conceptRow({
        key: "deleted-id-A",
        conceptId: "deleted-id-A",
        label: "削除済みConcept",
        attemptCount: 3
      }),
      conceptRow({
        key: "deleted-id-B",
        conceptId: "deleted-id-B",
        label: "削除済みConcept",
        attemptCount: 1
      })
    ];
    render(<ResearchAnalysisSnapshotTable rows={rows} groupBy="concept" />);
    const table = screen.getByTestId("research-analysis-snapshot-table");
    expect(table).toHaveTextContent("削除済みConcept (deleted-id-A)");
    expect(table).toHaveTextContent("削除済みConcept (deleted-id-B)");
    expect(rows[0]?.label).toBe("削除済みConcept");
    expect(rows[1]?.label).toBe("削除済みConcept");
  });

  it("保存済み title は現在の Concept 状態に関係なくそのまま出す", () => {
    render(
      <ResearchAnalysisSnapshotTable
        rows={[
          conceptRow({
            key: "deleted-id-A",
            conceptId: "deleted-id-A",
            label: "人工知能"
          })
        ]}
        groupBy="concept"
      />
    );
    expect(screen.getByTestId("research-analysis-snapshot-table")).toHaveTextContent("人工知能");
    expect(screen.getByTestId("research-analysis-snapshot-table")).not.toHaveTextContent(
      "削除済みConcept (deleted-id-A)"
    );
  });
});
