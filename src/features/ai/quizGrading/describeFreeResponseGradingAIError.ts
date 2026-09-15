import { isAIError } from "../errors";

const FALLBACK_MESSAGE = "AI採点補助を利用できませんでした。自己評価はそのまま続けられます。";

export const describeFreeResponseGradingAIError = (error: unknown): string => {
  if (isAIError(error) && error.message.trim().length > 0) {
    return `${FALLBACK_MESSAGE}\n${error.message}`;
  }
  if (error instanceof Error && error.message.trim().length > 0) {
    return `${FALLBACK_MESSAGE}\n${error.message}`;
  }
  return FALLBACK_MESSAGE;
};
