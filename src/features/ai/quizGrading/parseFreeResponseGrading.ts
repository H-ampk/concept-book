import { isValidQuizSelfEvaluation } from "../../../utils/quiz/quizQuestionType";
import { AIError } from "../errors";
import type { FreeResponseAIGrade } from "./types";

const INVALID_RESPONSE_MESSAGE = "AI採点補助の結果を解析できませんでした。";

const stripThinkBlocks = (text: string): string =>
  text.replace(/<think>[\s\S]*?(<\/think>|$)/gi, "").trim();

const extractJsonObjectText = (text: string): string => {
  const stripped = stripThinkBlocks(text);
  const fenced = stripped.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : stripped).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new AIError("invalid-response", INVALID_RESPONSE_MESSAGE);
  }
  return candidate.slice(start, end + 1);
};

export const parseFreeResponseGrading = (text: string): FreeResponseAIGrade => {
  const stripped = stripThinkBlocks(text);
  const fenced = stripped.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : stripped).trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate) as unknown;
  } catch {
    try {
      parsed = JSON.parse(extractJsonObjectText(candidate)) as unknown;
    } catch (error) {
      if (error instanceof AIError) {
        throw error;
      }
      throw new AIError("invalid-response", INVALID_RESPONSE_MESSAGE, { cause: error });
    }
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new AIError("invalid-response", INVALID_RESPONSE_MESSAGE);
  }

  const record = parsed as Record<string, unknown>;
  if (!isValidQuizSelfEvaluation(record.evaluation)) {
    throw new AIError("invalid-response", INVALID_RESPONSE_MESSAGE);
  }
  if (typeof record.reason !== "string" || record.reason.trim().length === 0) {
    throw new AIError("invalid-response", INVALID_RESPONSE_MESSAGE);
  }

  return {
    evaluation: record.evaluation,
    reason: record.reason.trim()
  };
};
