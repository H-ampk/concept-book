import { describe, expect, it } from "vitest";
import { normalizeConceptSourceAnchorsForBackupImport } from "./learningMaterialImportValidation";

describe("concept source anchor import validation", () => {
  it("範囲外の rect はスキップする", () => {
    const { anchors, skipped } = normalizeConceptSourceAnchorsForBackupImport([
      {
        id: "bad",
        materialId: "m1",
        conceptId: "c1",
        pageIndex: 0,
        rects: [{ x: 0.9, y: 0.1, width: 0.3, height: 0.1 }],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z"
      },
      {
        id: "ok",
        materialId: "m1",
        conceptId: "c1",
        pageIndex: 0,
        rects: [{ x: 0.1, y: 0.1, width: 0.2, height: 0.1 }],
        quotedText: "強化とは",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z"
      }
    ]);
    expect(skipped).toBe(1);
    expect(anchors).toHaveLength(1);
    expect(anchors[0]?.id).toBe("ok");
  });
});
