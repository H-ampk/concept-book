import { describe, expect, it } from "vitest";
import { fingerprintRelatedConceptEmbeddingText } from "./fingerprint";

describe("fingerprintRelatedConceptEmbeddingText", () => {
  it("同一入力なら同一 fingerprint になる", () => {
    const text = "タイトル: 実存主義\n\n定義:\n人間の存在";
    expect(fingerprintRelatedConceptEmbeddingText(text)).toBe(fingerprintRelatedConceptEmbeddingText(text));
  });

  it("title / definition / myInterpretation の変更で fingerprint が変わる", () => {
    const base = "タイトル: 実存主義\n\n定義:\nA\n\n自分の解釈:\nB";
    expect(fingerprintRelatedConceptEmbeddingText(base)).not.toBe(
      fingerprintRelatedConceptEmbeddingText(base.replace("実存主義", "現象学"))
    );
    expect(fingerprintRelatedConceptEmbeddingText(base)).not.toBe(
      fingerprintRelatedConceptEmbeddingText(base.replace("定義:\nA", "定義:\nAA"))
    );
    expect(fingerprintRelatedConceptEmbeddingText(base)).not.toBe(
      fingerprintRelatedConceptEmbeddingText(base.replace("自分の解釈:\nB", "自分の解釈:\nBB"))
    );
  });
});
