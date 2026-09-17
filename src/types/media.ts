export type MediaKind = "image" | "video";

export type ConceptMediaRef = {
  id: string;
  kind: MediaKind;
  fileName: string;
  caption?: string;
  sortOrder: number;
};

/** ConceptFormModal 内の下書き。配列順が最終 sortOrder。 */
export type ConceptMediaDraftItem =
  | {
      type: "existing";
      mediaId: string;
      kind: MediaKind;
      fileName: string;
      caption?: string;
    }
  | {
      type: "new";
      clientId: string;
      file: File;
      kind: MediaKind;
      fileName: string;
      caption?: string;
      objectUrl: string;
    };

/** IndexedDB へ atomic commit する入力。配列順が最終 sortOrder。 */
export type ConceptMediaCommitItem =
  | {
      type: "existing";
      mediaId: string;
      caption?: string;
    }
  | {
      type: "new";
      file: File;
      caption?: string;
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
