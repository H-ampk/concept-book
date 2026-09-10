import type { AIMessage } from "../types";
import type { AIConceptSnapshot } from "../conceptSnapshot";

export type RelatedConceptAnalysisCandidate = {
  id: string;
  title: string;
  definition?: string;
  myInterpretation?: string;
  similarity: number;
};

const optionalField = (value: string | undefined): string => {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : "（なし）";
};

const roundSimilarity = (value: number): number => Math.round(value * 10000) / 10000;

export const RELATED_CONCEPT_ANALYSIS_SYSTEM_PROMPT = [
  "あなたはConceptBookの関連概念アシスタントです。",
  "対象Conceptと候補Conceptだけを比較し、JSONオブジェクトだけを返してください。",
  "candidate list に存在しない ID を existing に含めないでください。",
  "新しい既存Concept IDを生成してはいけません。",
  "関連性が弱い候補は existing から除外して構いません。",
  "関連理由は短く、断定しすぎないでください。",
  "ConceptBookの正式データを変更する提案はしないでください。",
  "未登録Concept候補は必要な場合のみ少数だけ new に提案してください。",
  "confidence や確信度は出力しないでください。",
  "出力形式:",
  '{"existing":[{"id":"concept_xxx","reason":"短い関連理由"}],"new":[{"title":"未登録タイトル","reason":"短い関連理由"}]}'
].join("\n");

export const buildRelatedConceptAnalysisMessages = (params: {
  target: Pick<AIConceptSnapshot, "title" | "definition" | "myInterpretation">;
  candidates: readonly RelatedConceptAnalysisCandidate[];
}): AIMessage[] => {
  const payload = {
    target: {
      title: params.target.title,
      definition: optionalField(params.target.definition),
      myInterpretation: optionalField(params.target.myInterpretation)
    },
    candidates: params.candidates.map((candidate) => ({
      id: candidate.id,
      title: candidate.title,
      definition: optionalField(candidate.definition),
      myInterpretation: optionalField(candidate.myInterpretation),
      similarity: roundSimilarity(candidate.similarity)
    }))
  };

  return [
    { role: "system", content: RELATED_CONCEPT_ANALYSIS_SYSTEM_PROMPT },
    {
      role: "user",
      content: [
        "次の対象Conceptと候補Conceptを比較し、指定のJSONだけを返してください。",
        "similarity は Embedding の参考値であり、正しさの確率ではありません。",
        JSON.stringify(payload)
      ].join("\n")
    }
  ];
};
