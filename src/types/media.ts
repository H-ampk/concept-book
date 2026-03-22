export type MediaKind = "image" | "video";

export type ConceptMediaRef = {
  id: string;
  kind: MediaKind;
  fileName: string;
  caption?: string;
  sortOrder: number;
};

export type MediaRecord = {
  id: string;
  conceptId: string;
  kind: MediaKind;
  blob: Blob;
  mimeType: string;
  fileName: string;
  fileSize: number;
  caption?: string;
  createdAt: string;
  updatedAt: string;
};
