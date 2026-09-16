export type NormalizedRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ConceptSourceAnchor = {
  id: string;
  materialId: string;
  conceptId: string;
  pageIndex: number;
  rects: NormalizedRect[];
  quotedText?: string;
  createdAt: string;
  updatedAt: string;
};
