import { describe, expect, it } from "vitest";
import { validateBackupImportPayload, validateConceptImportPayload } from "./conceptImportValidation";

const iso = "2026-01-01T00:00:00.000Z";

const canonicalConcept = (overrides: Record<string, unknown> = {}) => ({
  id: "A",
  title: "A",
  definition: "",
  myInterpretation: "",
  domainTags: [] as string[],
  researchTags: [] as string[],
  relatedIds: [] as string[],
  source: { book: "", page: "", author: null },
  notes: "",
  status: "draft" as const,
  favorite: false,
  createdAt: iso,
  updatedAt: iso,
  ...overrides
});

describe("concept import validation prerequisites", () => {
  it("legacy concept に prerequisiteIds が無くても [] に正規化する", () => {
    const result = validateConceptImportPayload([
      canonicalConcept({ id: "A", title: "A", relatedIds: ["B"] })
    ]);
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.concepts[0]?.prerequisiteIds).toEqual([]);
    expect(result.concepts[0]?.relatedIds).toEqual(["B"]);
  });

  it("legacy backup object でも prerequisiteIds を relatedIds から作らない", () => {
    const result = validateBackupImportPayload({
      concepts: [canonicalConcept({ id: "A", relatedIds: ["B"] })]
    });
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.concepts[0]?.prerequisiteIds).toEqual([]);
    expect(result.concepts[0]?.relatedIds).toEqual(["B"]);
  });

  it("self / duplicate を除去し、payload 内に無い ID はこの段階では残す", () => {
    const result = validateConceptImportPayload([
      canonicalConcept({
        id: "A",
        title: "A",
        prerequisiteIds: [" B ", "B", "", "A", "missing"]
      })
    ]);
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.concepts[0]?.prerequisiteIds).toEqual(["B", "missing"]);
  });

  it("canonical backup の prerequisiteIds を維持する", () => {
    const result = validateBackupImportPayload({
      concepts: [
        canonicalConcept({ id: "A" }),
        canonicalConcept({ id: "B", title: "B", prerequisiteIds: ["A"] })
      ]
    });
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.concepts.find((concept) => concept.id === "B")?.prerequisiteIds).toEqual(["A"]);
  });
});
