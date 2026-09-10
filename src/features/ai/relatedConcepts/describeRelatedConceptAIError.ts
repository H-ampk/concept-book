import { isAIError } from "../errors";

export const describeRelatedConceptAIError = (error: unknown): string => {
  if (isAIError(error)) {
    return error.message;
  }
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return "AI関連候補の取得に失敗しました。";
};
