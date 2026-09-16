import type { PdfTextItem, PdfTextItemSlice } from "./pdfTextItem";
import { toConceptSearchKey } from "./toConceptSearchKey";

export type PdfPageTextIndex = {
  raw: string;
  search: string;
  searchToRaw: number[];
  items: PdfTextItemSlice[];
};

const appendSearchChars = (index: PdfPageTextIndex, rawIndex: number, chunk: string) => {
  const key = toConceptSearchKey(chunk);
  for (const ch of key) {
    index.search += ch;
    index.searchToRaw.push(rawIndex);
  }
};

export const buildPdfPageTextIndex = (items: PdfTextItem[]): PdfPageTextIndex => {
  const index: PdfPageTextIndex = {
    raw: "",
    search: "",
    searchToRaw: [],
    items: []
  };
  items.forEach((item, itemIndex) => {
    const str = item.str ?? "";
    const rawStart = index.raw.length;
    index.raw += str;
    for (let i = 0; i < str.length; i += 1) {
      appendSearchChars(index, rawStart + i, str[i] ?? "");
    }
    index.items.push({
      itemIndex,
      rawStart,
      rawEnd: rawStart + str.length,
      str,
      width: item.width || 0,
      height: item.height || 0,
      transform: item.transform
    });
    if (item.hasEOL) {
      const nlIndex = index.raw.length;
      index.raw += "\n";
      appendSearchChars(index, nlIndex, "\n");
    }
  });
  return index;
};
