import { beforeEach, describe, expect, it, vi } from "vitest";

const getDocument = vi.fn();

vi.mock("pdfjs-dist", () => ({
  GlobalWorkerOptions: { workerSrc: "" },
  getDocument: (...args: unknown[]) => getDocument(...args)
}));

vi.mock("pdfjs-dist/build/pdf.worker.min.mjs?url", () => ({
  default: "pdf.worker.min.mjs"
}));

describe("loadPdfDocument", () => {
  beforeEach(() => {
    getDocument.mockReset();
  });

  it("isEvalSupported: false と PDF データを getDocument に渡す", async () => {
    const document = { numPages: 2, getPage: vi.fn() };
    getDocument.mockReturnValue({ promise: Promise.resolve(document) });
    const data = new Uint8Array([0x25, 0x50, 0x44, 0x46]).buffer;

    const { loadPdfDocument } = await import("./loadPdfDocument");
    const loaded = await loadPdfDocument(data);

    expect(getDocument).toHaveBeenCalledWith({
      data,
      isEvalSupported: false
    });
    expect(loaded).toBe(document);
  });

  it("不正な PDF の読み込み失敗をそのまま伝える", async () => {
    getDocument.mockReturnValue({
      promise: Promise.reject(new Error("Invalid PDF structure."))
    });
    const data = new ArrayBuffer(4);

    const { loadPdfDocument } = await import("./loadPdfDocument");
    await expect(loadPdfDocument(data)).rejects.toThrow("Invalid PDF structure.");
  });
});
