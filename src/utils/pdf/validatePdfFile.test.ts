import { describe, expect, it } from "vitest";
import { looksLikePdfBytes, validatePdfFile } from "./validatePdfFile";

describe("validatePdfFile", () => {
  it("空ファイルを拒否する", async () => {
    const file = new File([], "empty.pdf", { type: "application/pdf" });
    const result = await validatePdfFile(file);
    expect(result.ok).toBe(false);
  });

  it("%PDF ヘッダのないデータを拒否する", async () => {
    const file = new File([new Uint8Array([1, 2, 3, 4, 5, 6])], "fake.pdf", {
      type: "application/pdf"
    });
    const result = await validatePdfFile(file);
    expect(result.ok).toBe(false);
  });

  it("PDF マジックバイトを受け入れる", async () => {
    const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
    expect(looksLikePdfBytes(bytes)).toBe(true);
    const file = new File([bytes], "note.pdf", { type: "application/pdf" });
    const result = await validatePdfFile(file);
    expect(result).toEqual({ ok: true });
  });
});
