/**
 * ユーザーが作る単語帳の設定。Concept と文脈カードの複製は持たない。
 * 同期メタデータ（ownerUserId / deletedAt / version）は載せない。
 */
export type VocabularyBook = {
  id: string;
  name: string;
  /** trim 済み・空なし・重複なし。0 件可。 */
  domainTags: string[];
  /** 分野タグが無いレコードを一致対象に含める。文字列タグ「未設定」とは別。 */
  includeUnassigned: boolean;
  createdAt: string;
  updatedAt: string;
};

export type VocabularyBookInput = {
  name: string;
  domainTags: readonly unknown[];
  includeUnassigned: boolean;
};

export type VocabularyBookPatch = {
  name?: string;
  domainTags?: readonly unknown[];
  includeUnassigned?: boolean;
};
