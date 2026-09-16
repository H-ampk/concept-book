export type PdfTextItem = {
  str: string;
  width: number;
  height: number;
  transform: number[];
  hasEOL?: boolean;
};

export type PdfTextItemSlice = {
  itemIndex: number;
  rawStart: number;
  rawEnd: number;
  str: string;
  width: number;
  height: number;
  transform: number[];
};

export const isPdfTextItem = (value: unknown): value is PdfTextItem => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const item = value as PdfTextItem;
  return typeof item.str === "string" && Array.isArray(item.transform);
};
