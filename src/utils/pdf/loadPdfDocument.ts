import * as pdfjs from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

export type PdfPageHandle = {
  getViewport: (opts: { scale: number }) => {
    width: number;
    height: number;
    convertToViewportPoint?: (x: number, y: number) => number[];
  };
  render: (opts: {
    canvasContext: CanvasRenderingContext2D;
    viewport: { width: number; height: number };
  }) => { promise: Promise<void> };
  getTextContent: () => Promise<{ items: Array<unknown> }>;
  streamTextContent: () => unknown;
};

export type PdfDocumentHandle = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfPageHandle>;
  destroy?: () => Promise<void>;
};

export const loadPdfDocument = async (data: ArrayBuffer): Promise<PdfDocumentHandle> => {
  const task = pdfjs.getDocument({ data });
  const pdf = await task.promise;
  return pdf as unknown as PdfDocumentHandle;
};

export { pdfjs };
