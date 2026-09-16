import { describe, expect, it } from "vitest";
import { createEmptyConceptInput, type Concept } from "../../types/concept";
import {
  DATA_LAB_DELETED_CONCEPT_LABEL,
  formatDataLabConceptLabel,
  formatStoredDataLabConceptLabel
} from "./dataLabConceptLabel";

const concept = (overrides: Partial<Concept> = {}): Concept => ({
  ...createEmptyConceptInput(),
  id: "concept-a",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  title: "人工知能",
  ...overrides
});

describe("formatDataLabConceptLabel", () => {
  it("現存 Concept は title を返す", () => {
    const conceptById = new Map([["concept-a", concept()]]);
    expect(formatDataLabConceptLabel("concept-a", conceptById)).toBe("人工知能");
  });

  it("Concept ID なしは Conceptなし", () => {
    expect(formatDataLabConceptLabel(null, new Map())).toBe("Conceptなし");
  });

  it("削除済み Concept は完全な ID を括弧で付ける", () => {
    expect(formatDataLabConceptLabel("deleted-id-A", new Map())).toBe(
      "削除済みConcept (deleted-id-A)"
    );
  });

  it("異なる削除済み ID は異なる label になる", () => {
    const labelA = formatDataLabConceptLabel("deleted-id-A", new Map());
    const labelB = formatDataLabConceptLabel("deleted-id-B", new Map());
    expect(labelA).toBe("削除済みConcept (deleted-id-A)");
    expect(labelB).toBe("削除済みConcept (deleted-id-B)");
  });

  it("UUID も省略せず完全な ID を付ける", () => {
    const id = "123e4567-e89b-12d3-a456-426614174000";
    expect(formatDataLabConceptLabel(id, new Map())).toBe(`削除済みConcept (${id})`);
  });
});

describe("formatStoredDataLabConceptLabel", () => {
  it("legacy snapshot の削除済みConcept に ID を補完する", () => {
    expect(formatStoredDataLabConceptLabel(DATA_LAB_DELETED_CONCEPT_LABEL, "deleted-id-A")).toBe(
      "削除済みConcept (deleted-id-A)"
    );
  });

  it("保存済み title はそのまま維持する", () => {
    expect(formatStoredDataLabConceptLabel("人工知能", "deleted-id-A")).toBe("人工知能");
  });

  it("conceptId が無い削除済みConcept は元 label のまま", () => {
    expect(formatStoredDataLabConceptLabel(DATA_LAB_DELETED_CONCEPT_LABEL, null)).toBe(
      DATA_LAB_DELETED_CONCEPT_LABEL
    );
  });

  it("入力 label を mutation しない", () => {
    const row = { label: DATA_LAB_DELETED_CONCEPT_LABEL, conceptId: "deleted-id-A" };
    const displayed = formatStoredDataLabConceptLabel(row.label, row.conceptId);
    expect(displayed).toBe("削除済みConcept (deleted-id-A)");
    expect(row.label).toBe(DATA_LAB_DELETED_CONCEPT_LABEL);
  });
});
