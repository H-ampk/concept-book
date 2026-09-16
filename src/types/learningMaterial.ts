export type LearningMaterialType = "pdf";

export type LearningMaterial = {
  id: string;
  contextCardId: string;
  type: LearningMaterialType;
  title: string;
  fileName: string;
  mimeType: "application/pdf";
  fileSize: number;
  pageCount?: number;
  fileHash?: string;
  createdAt: string;
  updatedAt: string;
};

export type LearningMaterialBlobRecord = {
  id: string;
  blob: Blob;
};
