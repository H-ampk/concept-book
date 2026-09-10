import { describe, expect, it } from "vitest";
import { buildAIConceptSnapshot } from "../conceptSnapshot";
import { createEmptyConceptInput, type Concept } from "../../../types/concept";
import { buildRelatedConceptEmbeddingText } from "./buildRelatedConceptEmbeddingText";

const concept = (overrides: Partial<Concept> = {}): Concept => ({
  ...createEmptyConceptInput(),
  id: "concept-1",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  title: "実存主義",
  definition: "人間の存在を先に置く考え方。",
  myInterpretation: "選択の経験として捉える。",
  notes: "秘密のメモ",
  relatedIds: ["concept-2"],
  domainTags: ["哲学"],
  researchTags: ["研究"],
  ...overrides
});

describe("buildRelatedConceptEmbeddingText", () => {
  it("title / definition / myInterpretation を含める", () => {
    const text = buildRelatedConceptEmbeddingText(
      buildAIConceptSnapshot(concept(), { relatedTitles: ["現象学"] })
    );
    expect(text).toContain("タイトル: 実存主義");
    expect(text).toContain("定義:");
    expect(text).toContain("人間の存在を先に置く考え方。");
    expect(text).toContain("自分の解釈:");
    expect(text).toContain("選択の経験として捉える。");
  });

  it("空文字を（なし）として扱う", () => {
    const text = buildRelatedConceptEmbeddingText(
      buildAIConceptSnapshot(concept({ title: "  ", definition: "", myInterpretation: "   " }))
    );
    expect(text).toContain("タイトル: （なし）");
    expect(text).toContain("定義:\n（なし）");
    expect(text).toContain("自分の解釈:\n（なし）");
  });

  it("relatedTitles を含めない", () => {
    const text = buildRelatedConceptEmbeddingText(
      buildAIConceptSnapshot(concept(), { relatedTitles: ["現象学", "解釈学"] })
    );
    expect(text).not.toContain("現象学");
    expect(text).not.toContain("解釈学");
    expect(text).not.toContain("relatedTitles");
  });

  it("notes 等を混入しない", () => {
    const text = buildRelatedConceptEmbeddingText(buildAIConceptSnapshot(concept()));
    expect(text).not.toContain("秘密のメモ");
    expect(text).not.toContain("哲学");
    expect(text).not.toContain("研究");
    expect(text).not.toContain("concept-2");
    expect(text).not.toContain("notes");
    expect(text).not.toContain("domainTags");
  });
});
