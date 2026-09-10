import type { AIConceptSnapshot } from "../conceptSnapshot";

const textOrNone = (value: string | undefined): string => {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : "（なし）";
};

/**
 * Embedding 用テキスト。title / definition / myInterpretation のみ。
 * relatedTitles や notes などは含めない。
 */
export const buildRelatedConceptEmbeddingText = (snapshot: AIConceptSnapshot): string => {
  const title = snapshot.title.trim();
  const definition = snapshot.definition?.trim() ?? "";
  const myInterpretation = snapshot.myInterpretation?.trim() ?? "";

  const lines = [`タイトル: ${title.length > 0 ? title : "（なし）"}`, "", "定義:", textOrNone(definition), "", "自分の解釈:", textOrNone(myInterpretation)];
  return lines.join("\n");
};
