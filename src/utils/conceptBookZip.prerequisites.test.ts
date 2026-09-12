import { describe, expect, it } from "vitest";
import { buildConceptBookZip, parseConceptBookZip } from "./conceptBookZip";
import { validateBackupImportPayload } from "./conceptImportValidation";

const iso = "2026-01-01T00:00:00.000Z";

const concept = (id: string, prerequisiteIds: string[], relatedIds: string[] = []) => ({
  id,
  title: id,
  definition: "",
  myInterpretation: "",
  domainTags: [] as string[],
  researchTags: [] as string[],
  relatedIds,
  prerequisiteIds,
  source: { book: "", page: "", author: null },
  notes: "",
  status: "draft" as const,
  favorite: false,
  createdAt: iso,
  updatedAt: iso
});

describe("conceptBookZip prerequisite round-trip", () => {
  it("ZIP export → parse → validate で A → B → C の prerequisiteIds が維持される", () => {
    const json = JSON.stringify({
      concepts: [concept("A", []), concept("B", ["A"]), concept("C", ["B"])],
      contextCards: [],
      quizQuestions: [],
      quizDecks: []
    });
    const zipped = buildConceptBookZip(json, []);
    const parsed = parseConceptBookZip(
      zipped.buffer.slice(zipped.byteOffset, zipped.byteOffset + zipped.byteLength)
    );
    const result = validateBackupImportPayload(JSON.parse(parsed.conceptsText));
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.concepts.find((item) => item.id === "B")?.prerequisiteIds).toEqual(["A"]);
    expect(result.concepts.find((item) => item.id === "C")?.prerequisiteIds).toEqual(["B"]);
    expect(result.concepts.find((item) => item.id === "A")?.prerequisiteIds).toEqual([]);
  });
});
