import { describe, expect, it } from "vitest";
import { attachDomainColorsToBackup } from "./domainColors";
import { buildConceptBookZip, parseConceptBookZip } from "./conceptBookZip";
import { validateBackupImportPayload } from "./conceptImportValidation";

describe("conceptBookZip domainColors", () => {
  it("ZIP内 concepts.json にdomainColorsが含まれる", () => {
    const json = JSON.stringify(
      attachDomainColorsToBackup(
        { concepts: [], contextCards: [], quizQuestions: [], quizDecks: [] },
        { 人工知能: "#2563EB" }
      )
    );
    const zipped = buildConceptBookZip(json, []);
    const parsed = parseConceptBookZip(
      zipped.buffer.slice(zipped.byteOffset, zipped.byteOffset + zipped.byteLength)
    );
    const concepts = JSON.parse(parsed.conceptsText) as { domainColors?: Record<string, string> };
    expect(concepts.domainColors).toEqual({ 人工知能: "#2563EB" });
  });

  it("ZIP内 concepts.json のdomainColorsをJSON importと同じルールで扱う", () => {
    const json = JSON.stringify({
      concepts: [],
      contextCards: [],
      quizQuestions: [],
      quizDecks: [],
      domainColors: { 人工知能: "#2563EB", bad: "nope" }
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
    expect(result.domainColors).toEqual({ 人工知能: "#2563EB" });
  });
});
